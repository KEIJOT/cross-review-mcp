# GSD: Adaptive Model Fallback for LLMAPI (v1.0.0, 2026-03-20)

## Objective

Add adaptive in-flight fallback to the LLMAPI executor. When a model fails due to token limits, empty response, or provider error, automatically find and retry against a working replacement model rather than marking the slot as failed.

## Context

- Project: `/Users/keijotuominen/PROJECTS/LLMAPI/`
- Primary file to modify: `src/executor.ts`
- Supporting file (already complete, no changes needed): `src/model-discovery.ts`
- Python: not relevant — this is TypeScript/Node
- Do NOT create virtual environments

## Current Behavior

In `executor.ts`, when a model returns empty content (token limit hit) or throws an error after retries, it writes an error `LLMResponse` and moves on. The slot is wasted.

## Required Behavior

### 1. Failure taxonomy

Before triggering fallback, classify the failure type:

```typescript
type FailureReason = 'token_limit' | 'rate_limit' | 'empty_response' | 'network' | 'unknown';

function classifyFailure(error: string, outputTokens: number, inputTokens: number): FailureReason {
  if (outputTokens === 0 && inputTokens > 0) return 'token_limit';
  if (error.includes('rate') || error.includes('429')) return 'rate_limit';
  if (error.includes('Empty response')) return 'empty_response';
  if (isRetryable(error)) return 'network';
  return 'unknown';
}
```

### 2. Proactive prompt length check

Before sending to any model, estimate token count and compare against the model's known context window from config. If prompt exceeds 80% of context window, skip that model immediately and go straight to fallback selection — do not attempt and fail.

Add to `resolveProviders` or as a pre-flight check in `execute`:

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // conservative estimate
}
```

Read `contextLength` from the reviewer config (`config.reviewers[].contextLength` — add this field to the ReviewerConfig type if not present).

### 3. Adaptive fallback inside execute()

After a model fails (post-retry), instead of immediately writing an error response:

1. Call `findReplacement(id, { freeOnly: true, minContextLength: estimatedTokens * 5 })` from `model-discovery.ts`
2. If a working replacement is found and it is not already in `activeProviders`:
   - Instantiate a temporary provider for the replacement model using `createProvider`
   - Retry the request against the replacement
   - Log: `${id} failed (${reason}), fell back to ${replacement.model.id}`
   - Tag the response with `modelId = replacement.model.id` and add a `fallbackFrom: id` field
3. If no replacement found, write the error response as before

### 4. Add `fallbackFrom` to LLMResponse type

In `src/types.ts`, add optional field:

```typescript
fallbackFrom?: string; // original model ID if this response came from a fallback
```

### 5. Logging

Every fallback event must log at `warn` level:
```
[executor] ${originalId} → fallback → ${replacementId} (reason: ${reason}, tokens: ${inputTokens})
```

## Acceptance Criteria

1. A prompt that previously caused a model to return empty (token limit) now returns a response from a fallback model
2. The fallback model ID appears in the response with `fallbackFrom` set to the original
3. No fallback is attempted if the replacement model is already in `activeProviders`
4. Proactive skip fires when estimated tokens > 80% of model's context window
5. All existing tests pass: `npm test`

## What NOT to change

- Do not modify `model-discovery.ts`
- Do not modify `consensus-algorithm.ts`
- Do not change the external API shape of `ReviewExecutor.execute()`
- Do not add new dependencies

## Test

After implementation, verify with:
```bash
cd /Users/keijotuominen/PROJECTS/LLMAPI
npm test
```

If tests pass, run a manual smoke test by sending a very long prompt (>4000 words) to a small-context model and confirm fallback fires in the logs.
