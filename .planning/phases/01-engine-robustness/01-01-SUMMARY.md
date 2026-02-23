---
phase: 01-engine-robustness
plan: 01
subsystem: api
tags: [typescript, error-handling, tdd, consensus, engine]

# Dependency graph
requires: []
provides:
  - Structured consensus error field (consensus.error) in CrossReviewResult
  - buildConsensus() always returns a result — never silently returns undefined
  - Callers can distinguish failed consensus from not-requested consensus via error field
affects:
  - 01-02 (next plan in phase — may use consensus error state)
  - Any consumer of CrossReviewResult.consensus

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-error-objects-over-undefined, tdd-red-green, nullable-vs-error-sentinel]

key-files:
  created: []
  modified:
    - src/engine.ts
    - test/smoke.test.js

key-decisions:
  - "consensus.error uses error sentinel pattern: error field present means attempted-and-failed; consensus undefined means not requested — avoids ambiguity"
  - "buildConsensus() return type changed from union-with-undefined to always-return — forces callers to handle result, prevents silent failures"
  - "verdict defaults to 'revise' on failure — conservative default that prompts caller to act rather than silently proceed"

patterns-established:
  - "Error objects over undefined: functions that can fail return structured {error} objects rather than undefined, enabling callers to diagnose root cause"
  - "TDD for contract changes: type changes verified by RED tests before GREEN implementation, ensuring correctness"

# Metrics
duration: 15min
completed: 2026-02-23
---

# Phase 1 Plan 01: Consensus Error Reporting Summary

**`buildConsensus()` now returns structured `{error}` objects instead of undefined, with human-readable failure reasons covering three failure paths: no client, no fallback client, and API call exception.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-23T00:00:00Z
- **Completed:** 2026-02-23
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended `CrossReviewResult.consensus` with optional `error?: string` field (backwards-compatible)
- Replaced all three `return undefined` paths in `buildConsensus()` with structured error objects
- Added `else` branch in `review()` for `successfulReviews.length < 2` case, populating `consensus.error` instead of leaving `consensus` undefined
- 5 new TDD tests covering ERR-01 and ERR-02 scenarios; all 22 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add consensus error type and write failing tests** - `028d00d` (test — RED phase)
2. **Task 2: Implement structured error reporting in buildConsensus and review** - `c012ccf` (feat — GREEN phase)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD tasks have test commit (RED) then feat commit (GREEN)._

## Files Created/Modified
- `src/engine.ts` - Extended `CrossReviewResult.consensus` type with `error?` field; changed `buildConsensus()` return to never return `undefined`; added structured error returns in 3 failure paths; added `else` branch in `review()` for insufficient reviews
- `test/smoke.test.js` - Added 5 consensus error tests (ERR-01/ERR-02 coverage); fixed import paths from `../src/*.js` to `../dist/*.js`

## Decisions Made
- Used `verdict: "revise"` as the default failure verdict — conservative choice that prompts the caller to act rather than silently proceed or abort
- Changed `buildConsensus()` to never return `undefined`: forces explicit handling of errors at call site rather than silent null-propagation
- Kept `consensus?: ...` outer optionality on `CrossReviewResult` — when `includeConsensus: false`, field stays `undefined` (not requested); when `includeConsensus: true`, field is always populated (success or error)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed smoke test import paths from `../src/*.js` to `../dist/*.js`**
- **Found during:** Task 1 (adding failing tests)
- **Issue:** Test file imported directly from `../src/prompts.js` and `../src/engine.js`, which are TypeScript source files — Node.js cannot resolve them. Test script runs `npm run build && node test/smoke.test.js`, so compiled output is in `dist/`
- **Fix:** Changed imports to `../dist/prompts.js` and `../dist/engine.js`
- **Files modified:** `test/smoke.test.js`
- **Verification:** Build succeeds, Node resolves modules correctly, existing 17 tests pass
- **Committed in:** `028d00d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — the test script was completely broken before this change. No scope creep.

## Issues Encountered
- None beyond the import path fix above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- ERR-01 and ERR-02 requirements satisfied
- `CrossReviewResult.consensus.error` field available for Plan 02 and any other consumers
- No blockers for Plan 02

---
*Phase: 01-engine-robustness*
*Completed: 2026-02-23*

## Self-Check: PASSED

- src/engine.ts: FOUND
- test/smoke.test.js: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit 028d00d (Task 1): FOUND
- Commit c012ccf (Task 2): FOUND
- error? field in CrossReviewResult.consensus: FOUND
- No silent `return undefined` in buildConsensus: PASS
- successfulReviews else branch: FOUND
- All 22 tests pass: CONFIRMED
