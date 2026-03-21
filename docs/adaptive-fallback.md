# Adaptive Model Fallback

**Added:** v0.7.1 (2026-03-20)
**Files:** `src/executor.ts`, `src/config.ts`, `src/types.ts`

## Overview

When a model fails during a cross-review request — due to token limits, empty responses, or provider errors — the executor automatically finds and retries against a working replacement model instead of marking the slot as failed. This maximizes the number of useful perspectives returned per request.

## How It Works

### 1. Failure Classification

Every failure is classified into one of five categories before fallback is attempted:

| Reason | Trigger | Example |
|--------|---------|---------|
| `token_limit` | 0 output tokens with >0 input tokens | Prompt exceeded model's context window |
| `rate_limit` | Error contains "rate" or "429" | Provider rate limit hit |
| `empty_response` | Error contains "Empty response" | Model returned nothing |
| `network` | Retryable network error | ECONNRESET, 502, timeout |
| `unknown` | None of the above | Unrecognized error |

```typescript
type FailureReason = 'token_limit' | 'rate_limit' | 'empty_response' | 'network' | 'unknown';
```

### 2. Proactive Skip (Pre-flight Check)

Before making any API call, the executor estimates the token count of the prompt and compares it against the model's `contextLength` from config:

```
estimatedTokens = Math.ceil(prompt.length / 4)
threshold = contextLength * 0.8
```

If `estimatedTokens > threshold`, the model is skipped immediately — no API call is made. This saves time and avoids wasting quota on a request that would fail.

The proactive skip goes straight to fallback selection, same as a reactive failure would.

### 3. Fallback Selection

When fallback is triggered (either proactively or after retry exhaustion):

1. **Search** — Calls `findReplacement()` from `model-discovery.ts`, which searches the OpenRouter model catalog for candidates with `minContextLength >= estimatedTokens * 2`
2. **Test** — Tests up to 3 candidates with a live API call to verify they respond
3. **Guard** — Rejects any candidate already in `activeProviders` for this request (no duplicates)
4. **Retry** — Creates a temporary OpenRouter-backed provider and retries the original prompt
5. **Tag** — Marks the response with `fallbackFrom: originalModelId`

If no replacement is found or all candidates fail, the original error is preserved (same behavior as before this feature).

### 4. Fallback Triggers

Fallback is attempted at three points in the execution flow:

| Point | Condition | Reason |
|-------|-----------|--------|
| Pre-flight | Estimated tokens > 80% of context window | `token_limit` |
| Post-retry (empty) | Model returned 0 output tokens after all retries | Classified by `classifyFailure()` |
| Post-retry (error) | Model threw error after all retries | Classified by `classifyFailure()` |

## Configuration

Each reviewer can declare its context window size:

```json
{
  "id": "nemotron",
  "provider": "openai-compatible",
  "model": "nvidia/nemotron-3-super-120b-a12b:free",
  "baseUrl": "https://openrouter.ai/api/v1",
  "contextLength": 262144,
  "timeout_ms": 30000
}
```

If `contextLength` is omitted, the proactive skip is disabled for that model (reactive fallback still works).

**Requirement:** `OPENROUTER_API_KEY` must be set in the environment for fallback to work, since replacements are sourced from the OpenRouter catalog.

## Response Shape

When fallback occurs, the `LLMResponse` includes:

```typescript
{
  modelId: "nvidia/nemotron-3-super-120b-a12b:free",  // replacement model
  fallbackFrom: "nemotron",                             // original model ID
  content: "...",                                        // actual response
  inputTokens: 9201,
  outputTokens: 342,
  // ... other standard fields
}
```

The `fallbackFrom` field is `undefined` when no fallback occurred.

## Logging

All fallback events are logged at `warn` level:

```
[executor] nemotron: proactive skip — estimated 9201 tokens > 80% of 4096 context window
[executor] nemotron -> fallback -> nvidia/nemotron-3-super-120b-a12b:free (reason: token_limit, tokens: 9201)
```

If no replacement is found:
```
[executor] nemotron: no fallback replacement found (reason: token_limit)
```

## Constraints

- Does **not** modify `model-discovery.ts` or `consensus-algorithm.ts`
- Does **not** change the external API shape of `ReviewExecutor.execute()`
- No new dependencies added
- Fallback provider is always OpenRouter (temporary, not persisted)
- Zero-token detection applies to fallback responses too — a replacement that returns empty is discarded

## Testing

```bash
# Unit tests (no API keys needed)
npm test

# Integration smoke test (requires API keys in .env)
# Temporarily set nemotron contextLength to 4096, then:
node smoke-test-fallback.mjs
# Reset contextLength to 262144 after testing
```
