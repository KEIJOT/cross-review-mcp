---
phase: 02-validation-and-safety
plan: 03
subsystem: api
tags: [validation, safety, content-size, token-estimation, tdd, cost-protection]

# Dependency graph
requires:
  - phase: 02-01
    provides: validateConfiguration() and CrossReviewResult interface in engine.ts
  - phase: 02-02
    provides: Zod config validation and resolveReviewers() in engine.ts
provides:
  - estimateTokens() exported from src/engine.ts — rough ~4 chars/token estimate
  - TOKEN_WARN_THRESHOLD (50K) and TOKEN_REJECT_THRESHOLD (100K) named constants
  - Content size pre-flight in review() — throws before any API call on >100K tokens (SAFE-02)
  - warning field on CrossReviewResult — set for >50K token content (SAFE-01)
  - TDD tests for SAFE-01 and SAFE-02 in test/smoke.test.js
affects: [any consumer of review() or CrossReviewResult]

# Tech tracking
tech-stack:
  added: []
  patterns: [pre-flight validation before expensive operations, optional backwards-compatible result fields, named threshold constants]

key-files:
  created: []
  modified:
    - src/engine.ts
    - test/smoke.test.js

key-decisions:
  - "estimateTokens uses Math.ceil(length/4) heuristic — simple, no tokenizer dependency, sufficient for cost gating"
  - "Rejection throws before review() touches any API client — zero wasted work on oversized content"
  - "warning field is optional on CrossReviewResult — backwards-compatible, undefined for normal content"
  - "Thresholds defined as named constants (TOKEN_WARN_THRESHOLD, TOKEN_REJECT_THRESHOLD) — no magic numbers"

patterns-established:
  - "Pre-flight size gate: estimate tokens → throw if over hard limit, set warning if over soft limit"
  - "Optional result annotation: warning field absent for clean results, present only when needed"

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 02 Plan 03: Content Size Guards Summary

**estimateTokens() and two-tier content size gate in review() — warns at ~50K tokens (SAFE-01) and rejects at ~100K tokens (SAFE-02) before any API call is made**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-23T13:28:03Z
- **Completed:** 2026-02-23T13:29:46Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `estimateTokens(text)` exported from `src/engine.ts` — returns `Math.ceil(text.length / 4)`, a standard GPT tokenizer approximation, sufficient for pre-flight gating
- `TOKEN_WARN_THRESHOLD = 50_000` and `TOKEN_REJECT_THRESHOLD = 100_000` defined as named constants (no magic numbers)
- `review()` now runs size check at the very top before any API call setup — throws with a descriptive error on content estimated above ~100K tokens (SAFE-02)
- `warning` field populated for content estimated above ~50K tokens — review proceeds, but cost/timeout risk is surfaced to the caller (SAFE-01)
- `CrossReviewResult.warning?: string` added as optional backwards-compatible field — undefined for normal-sized content, present only when triggered
- 8 new TDD tests covering all 5 scenarios; 74/74 tests pass (66 pre-existing + 8 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for content size guards** - `2b72c2f` (test)
2. **Task 2: GREEN — Implement token estimation and size guards in review()** - `96667f7` (feat)

_Note: TDD tasks have two commits (test → feat)_

## Files Created/Modified

- `src/engine.ts` — Added `estimateTokens()` export, `TOKEN_WARN_THRESHOLD`/`TOKEN_REJECT_THRESHOLD` constants, size pre-flight in `review()`, `warning?` field on `CrossReviewResult`
- `test/smoke.test.js` — Added `estimateTokens` import, 8 new assertions in "Content Size Guards" section (5 test cases, 3 have 2 assertions each)

## Decisions Made

- `estimateTokens` uses `Math.ceil(text.length / 4)` — matches the project's "nanoseconds vs 30s API calls" philosophy: no tokenizer library needed, character-based heuristic is standard practice and good enough for threshold gating
- Rejection throws synchronously before any `initClients` lookup or `Promise.all` — zero wasted work on oversized content
- `warning` is optional on `CrossReviewResult` (not always present) — keeps the response clean for the normal case, consistent with the existing `consensus?` optional pattern
- Thresholds as named constants rather than inline numbers — readable, maintainable, easy to tune

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Content size guards complete (SAFE-01, SAFE-02)
- All validation-and-safety plans (02-01, 02-02, 02-03) are complete
- Phase 02 fully done — no more plans in this phase
- No blockers

---
*Phase: 02-validation-and-safety*
*Completed: 2026-02-23*

## Self-Check: PASSED

- src/engine.ts: FOUND
- test/smoke.test.js: FOUND
- 02-03-SUMMARY.md: FOUND
- Commit 2b72c2f (RED): FOUND
- Commit 96667f7 (GREEN): FOUND
