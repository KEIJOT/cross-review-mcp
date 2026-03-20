---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types.ts
  - src/config.ts
  - src/executor.ts
autonomous: true
requirements: [FALLBACK-1, FALLBACK-2, FALLBACK-3, FALLBACK-4, FALLBACK-5]
must_haves:
  truths:
    - "Model that fails due to token limit gets replaced by a fallback model"
    - "Proactive skip fires when estimated tokens > 80% of context window"
    - "Response includes fallbackFrom field identifying original model"
    - "No fallback attempted if replacement already in activeProviders"
    - "All existing smoke tests pass unchanged"
  artifacts:
    - path: "src/types.ts"
      provides: "LLMResponse with fallbackFrom field"
      contains: "fallbackFrom"
    - path: "src/config.ts"
      provides: "ReviewerConfig with contextLength field"
      contains: "contextLength"
    - path: "src/executor.ts"
      provides: "Failure classification, proactive skip, adaptive fallback"
      contains: "classifyFailure"
  key_links:
    - from: "src/executor.ts"
      to: "src/model-discovery.ts"
      via: "findReplacement() import"
      pattern: "findReplacement"
    - from: "src/executor.ts"
      to: "src/providers.ts"
      via: "createProvider() for fallback instantiation"
      pattern: "createProvider"
---

<objective>
Add adaptive in-flight fallback to ReviewExecutor. When a model fails (token limit, empty response, provider error), classify the failure, attempt to find a replacement via model-discovery, and retry transparently. Also add proactive pre-flight skip when estimated tokens exceed 80% of a model's context window.

Purpose: Eliminate wasted review slots when models fail, improving review completeness without changing the external API.
Output: Modified executor.ts with fallback logic, updated types.ts and config.ts with new fields.
</objective>

<execution_context>
@/Users/keijotuominen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/keijotuominen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/executor.ts
@src/types.ts
@src/config.ts
@src/providers.ts
@src/model-discovery.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/types.ts:
```typescript
export interface LLMResponse {
  modelId: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  error?: string;
  executionTimeMs: number;
}
```

From src/config.ts:
```typescript
export const ReviewerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  provider: z.enum(['openai', 'gemini', 'openai-compatible']),
  model: z.string().min(1),
  timeout_ms: z.number().int().min(1000).default(60000),
  slack_time_ms: z.number().int().min(0).default(0),
  execution_order: z.number().int().min(1).default(1),
  baseUrl: z.string().optional(),
  apiKeyEnv: z.string().optional(),
});
```

From src/providers.ts:
```typescript
export function createProvider(config: ReviewerConfig, apiKey: string): LLMProvider;
```

From src/model-discovery.ts:
```typescript
export async function findReplacement(
  reviewerId: string,
  options: {
    freeOnly?: boolean;
    minContextLength?: number;
    maxCandidates?: number;
    configPath?: string;
  }
): Promise<{
  candidates: Array<TestResult & { model: DiscoveredModel }>;
  recommended: (TestResult & { model: DiscoveredModel }) | null;
}>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fallbackFrom to LLMResponse and contextLength to ReviewerConfig</name>
  <files>src/types.ts, src/config.ts</files>
  <action>
In src/types.ts, add `fallbackFrom?: string;` to the LLMResponse interface (after `error?: string;`). This field holds the original model ID when a response came from a fallback model.

In src/config.ts, add `contextLength: z.number().int().min(0).optional()` to the ReviewerConfigSchema object. This allows reviewer configs to declare their context window size (in tokens) for the proactive skip check. When not set, proactive skip is not applied for that model.

These are the only changes to these two files. Do not modify any other types or schemas.
  </action>
  <verify>
    <automated>cd /Users/keijotuominen/PROJECTS/LLMAPI && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>LLMResponse has fallbackFrom optional string field. ReviewerConfigSchema has contextLength optional integer field. Project compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add failure classification, proactive skip, and adaptive fallback to executor</name>
  <files>src/executor.ts</files>
  <action>
Add the following to src/executor.ts. DO NOT modify model-discovery.ts or consensus-algorithm.ts. DO NOT change the external API shape of ReviewExecutor.execute().

**A. Imports** -- Add at top:
- Import `findReplacement` from `./model-discovery.js`
- Import `DiscoveredModel` type from `./model-discovery.js` (for typing)

**B. FailureReason type and classifyFailure function** -- Add after the existing `isRetryable` function:

```typescript
type FailureReason = 'token_limit' | 'rate_limit' | 'empty_response' | 'network' | 'unknown';

function classifyFailure(error: string, outputTokens: number, inputTokens: number): FailureReason {
  if (outputTokens === 0 && inputTokens > 0) return 'token_limit';
  if (/rate|429/i.test(error)) return 'rate_limit';
  if (/empty response/i.test(error)) return 'empty_response';
  if (isRetryable(error)) return 'network';
  return 'unknown';
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

**C. Proactive skip in the per-model promise** -- Inside the `promises` map callback (line ~176), BEFORE the retry loop, add a pre-flight check:

```typescript
// Proactive skip: if estimated tokens > 80% of model's context window, skip to fallback
const reviewer = this.config.reviewers.find(r => r.id === id);
const contextLength = reviewer?.contextLength;
const estimatedInputTokens = estimateTokens(request.content);

if (contextLength && estimatedInputTokens > contextLength * 0.8) {
  log('warn', 'executor', `${id}: proactive skip — estimated ${estimatedInputTokens} tokens > 80% of ${contextLength} context window`);
  // Fall through to fallback logic below
  const fallbackResponse = await this.attemptFallback(id, 'token_limit', estimatedInputTokens, request, activeProviders, requestId, modelStart);
  if (fallbackResponse) {
    responses.set(id, fallbackResponse);
    // Emit model:complete for the fallback
    eventBus.emitModelComplete({
      requestId,
      modelId: fallbackResponse.modelId,
      timestamp: new Date().toISOString(),
      success: true,
      inputTokens: fallbackResponse.inputTokens,
      outputTokens: fallbackResponse.outputTokens,
      executionTimeMs: fallbackResponse.executionTimeMs || (Date.now() - modelStart),
    });
    return;
  }
  // No fallback available -- write error
  const errorResponse: LLMResponse = {
    modelId: id,
    content: '',
    inputTokens: 0,
    outputTokens: 0,
    finishReason: 'error',
    error: `Proactive skip: prompt too large for context window (${estimatedInputTokens}/${contextLength} tokens)`,
    executionTimeMs: Date.now() - modelStart,
  };
  responses.set(id, errorResponse);
  eventBus.emitModelComplete({
    requestId,
    modelId: id,
    timestamp: new Date().toISOString(),
    success: false,
    inputTokens: 0,
    outputTokens: 0,
    executionTimeMs: Date.now() - modelStart,
    error: errorResponse.error,
  });
  return;
}
```

**D. Adaptive fallback after post-retry failure** -- In both failure paths (zero-token detection final attempt at ~line 200, and catch block final attempt at ~line 250), BEFORE writing the error response, attempt fallback:

Replace the pattern of immediately writing errorResponse with:

```typescript
// Attempt adaptive fallback
const reason = classifyFailure(lastError || emptyError, response?.outputTokens ?? 0, response?.inputTokens ?? 0);
const fallbackResponse = await this.attemptFallback(id, reason, estimateTokens(request.content), request, activeProviders, requestId, modelStart);
if (fallbackResponse) {
  responses.set(id, fallbackResponse);
  eventBus.emitModelComplete({
    requestId,
    modelId: fallbackResponse.modelId,
    timestamp: new Date().toISOString(),
    success: true,
    inputTokens: fallbackResponse.inputTokens,
    outputTokens: fallbackResponse.outputTokens,
    executionTimeMs: fallbackResponse.executionTimeMs || (Date.now() - modelStart),
  });
  return;
}
// No fallback -- write original error
```

Then keep the existing error response code as the fallthrough.

**E. Add attemptFallback private method** to ReviewExecutor class:

```typescript
private async attemptFallback(
  originalId: string,
  reason: FailureReason,
  estimatedTokens: number,
  request: ReviewRequest,
  activeProviders: Map<string, LLMProvider>,
  requestId: string,
  modelStart: number,
): Promise<LLMResponse | null> {
  try {
    const result = await findReplacement(originalId, {
      freeOnly: true,
      minContextLength: estimatedTokens * 5,
      maxCandidates: 3,
    });

    if (!result.recommended) {
      log('warn', 'executor', `${originalId}: no fallback replacement found (reason: ${reason})`);
      return null;
    }

    const replacementId = result.recommended.model.id;

    // Don't use a model that's already active in this request
    if (activeProviders.has(replacementId)) {
      log('warn', 'executor', `${originalId}: fallback ${replacementId} already in active providers, skipping`);
      return null;
    }

    // Find API key for the replacement (use OpenRouter key since findReplacement searches OpenRouter)
    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      log('warn', 'executor', `${originalId}: no OPENROUTER_API_KEY for fallback provider`);
      return null;
    }

    // Create temporary provider for the replacement
    const tempConfig = {
      id: replacementId,
      provider: 'openai-compatible' as const,
      model: replacementId,
      baseUrl: 'https://openrouter.ai/api/v1',
      timeout_ms: 60000,
    };
    const tempProvider = createProvider(tempConfig, apiKey);

    log('warn', 'executor', `${originalId} -> fallback -> ${replacementId} (reason: ${reason}, tokens: ${estimatedTokens})`);

    const response = await tempProvider.sendRequest(request.content, '');

    // Zero-token check on fallback too
    if (response.outputTokens === 0 && (!response.content || response.content.trim() === '')) {
      log('warn', 'executor', `${originalId}: fallback ${replacementId} also returned empty`);
      return null;
    }

    // Tag with fallback origin
    return {
      ...response,
      modelId: replacementId,
      fallbackFrom: originalId,
      executionTimeMs: Date.now() - modelStart,
    };
  } catch (error) {
    log('warn', 'executor', `${originalId}: fallback attempt failed: ${String(error).slice(0, 100)}`);
    return null;
  }
}
```

IMPORTANT constraints:
- Do NOT change the return type of execute() (ReviewResult is unchanged)
- Do NOT modify model-discovery.ts
- Do NOT add new npm dependencies
- The fallbackFrom field flows naturally through the existing ReviewResult.reviews record since LLMResponse now has it
  </action>
  <verify>
    <automated>cd /Users/keijotuominen/PROJECTS/LLMAPI && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>
- classifyFailure() function exists and correctly classifies token_limit, rate_limit, empty_response, network, unknown
- Proactive skip fires when estimateTokens(content) > 80% of reviewer.contextLength
- attemptFallback() calls findReplacement, creates temporary provider, retries, tags response with fallbackFrom
- No fallback if replacement already in activeProviders
- All fallback events logged at warn level with format: "${originalId} -> fallback -> ${replacementId} (reason: ${reason}, tokens: ${estimatedTokens})"
- npm test passes (all 30 assertions)
  </done>
</task>

</tasks>

<verification>
```bash
cd /Users/keijotuominen/PROJECTS/LLMAPI && npm test
```
All 30 existing smoke test assertions must pass. The fallback logic only activates on real API failures, so smoke tests (which mock/stub) should be unaffected.
</verification>

<success_criteria>
- npm test passes with all 30 assertions
- npm run build succeeds with no TypeScript errors
- LLMResponse type includes fallbackFrom optional field
- ReviewerConfig includes contextLength optional field
- executor.ts contains classifyFailure, estimateTokens, and attemptFallback
- Proactive skip logs at warn level when tokens exceed 80% of context window
- Fallback attempts log at warn level with original and replacement model IDs
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-adaptive-in-flight-fallback-to-execu/2-SUMMARY.md`
</output>
