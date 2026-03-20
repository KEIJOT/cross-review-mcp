---
phase: quick-2
plan: "01"
subsystem: executor
tags: [fallback, resilience, model-discovery, token-limit, proactive-skip]
dependency_graph:
  requires: [src/model-discovery.ts, src/providers.ts, src/config.ts, src/types.ts]
  provides: [adaptive-fallback, proactive-skip, failure-classification]
  affects: [src/executor.ts]
tech_stack:
  added: []
  patterns: [adaptive-fallback, failure-classification, proactive-context-check]
key_files:
  created: []
  modified:
    - src/types.ts
    - src/config.ts
    - src/executor.ts
decisions:
  - "Use OPENROUTER_API_KEY exclusively for fallback providers since findReplacement searches OpenRouter catalog"
  - "estimatedInputTokens computed once before retry loop and reused in both proactive skip and post-failure fallback paths"
  - "slack_time_ms and execution_order defaults added to tempConfig to satisfy ReviewerConfig type shape"
metrics:
  duration: 8min
  completed: 2026-03-20
---

# Phase quick-2 Plan 01: Adaptive In-Flight Fallback Summary

**One-liner:** Transparent model fallback in ReviewExecutor — proactive context-window skip + post-failure retry via OpenRouter discovery, with `fallbackFrom` tagging on substituted responses.

## What Was Built

Added adaptive fallback logic to `ReviewExecutor` across three files:

1. `src/types.ts` — Added `fallbackFrom?: string` to `LLMResponse` to track when a response came from a substitute model.

2. `src/config.ts` — Added `contextLength?: number` (optional int) to `ReviewerConfigSchema` so reviewer configs can declare their model's context window for proactive skip.

3. `src/executor.ts` — Four additions:
   - `classifyFailure(error, outputTokens, inputTokens): FailureReason` — maps failure signals to `token_limit | rate_limit | empty_response | network | unknown`
   - `estimateTokens(text): number` — `Math.ceil(length / 4)` pre-flight token estimate
   - Proactive skip block (before the retry loop) — if `estimatedInputTokens > contextLength * 0.8`, attempts fallback immediately rather than wasting the API call
   - `attemptFallback()` private method — calls `findReplacement(freeOnly, minContextLength)`, guards against replacement already in `activeProviders`, creates a temporary OpenRouter provider, sends the request, zero-token checks the result, and tags the response with `fallbackFrom: originalId`

Both post-retry failure paths (zero-token detection and catch block) now attempt fallback before writing the error response.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fallbackFrom to LLMResponse and contextLength to ReviewerConfig | 0785974 | src/types.ts, src/config.ts |
| 2 | Add failure classification, proactive skip, and adaptive fallback to executor | 997678f | src/executor.ts |

## Verification

- `npm run build` — clean TypeScript compilation, no errors
- `npm test` — 102/102 assertions pass (smoke tests unaffected as fallback only fires on real API failures)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tempConfig missing required ReviewerConfig fields**
- **Found during:** Task 2 (TypeScript build error)
- **Issue:** `createProvider()` requires `slack_time_ms` and `execution_order` which are schema-defaulted but structurally required in the inferred type. The plan's `tempConfig` snippet omitted them.
- **Fix:** Added `slack_time_ms: 0` and `execution_order: 1` to `tempConfig` in `attemptFallback()`
- **Files modified:** src/executor.ts
- **Commit:** 997678f

## Self-Check: PASSED

- src/types.ts: FOUND
- src/config.ts: FOUND
- src/executor.ts: FOUND
- commit 0785974: FOUND
- commit 997678f: FOUND
