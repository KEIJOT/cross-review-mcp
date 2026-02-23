---
phase: 02-validation-and-safety
plan: 01
subsystem: api
tags: [validation, startup, configuration, env-vars, fast-fail]

# Dependency graph
requires:
  - phase: 01-engine-robustness
    provides: ReviewerConfig interface and resolveReviewers() that returns reviewer list
provides:
  - validateConfiguration() exported from src/engine.ts — validates all reviewer API keys at startup
  - Startup fast-fail in src/index.ts — exits with code 1 and clear error listing if any keys missing
  - TDD tests for VALID-01 and VALID-02 scenarios (10 new tests in test/smoke.test.js)
affects: [02-02, 02-03, any phase touching ReviewerConfig or startup sequence]

# Tech tracking
tech-stack:
  added: []
  patterns: [fail-fast validation, structured error return (valid/errors tuple), startup gate before engine init]

key-files:
  created: []
  modified:
    - src/engine.ts
    - src/index.ts
    - test/smoke.test.js

key-decisions:
  - "validateConfiguration() returns structured { valid, errors } result — does not throw — lets caller decide on exit strategy"
  - "Error messages include model name, model id, AND env var name — user knows both what is misconfigured and what to set"
  - "Provider fallback in validation mirrors initClients() logic — openai defaults to OPENAI_API_KEY, gemini to GEMINI_API_KEY"
  - "Placed validateConfiguration() before resolveReviewers() in engine.ts to match logical dependency order"

patterns-established:
  - "Startup validation gate: validate → if invalid, print errors and process.exit(1) before creating engine"
  - "Structured error return pattern: { valid: boolean; errors: string[] } for validation functions"

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 02 Plan 01: API Key Validation Summary

**Startup-time API key validation via exported `validateConfiguration()` that fails fast with model names and env var names in error messages (VALID-01, VALID-02)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-23T13:20:30Z
- **Completed:** 2026-02-23T13:21:51Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- `validateConfiguration(reviewers)` exported from `src/engine.ts` — checks each reviewer's API key against `process.env`, returns `{ valid: boolean; errors: string[] }`
- Each error message includes model name, model id, and env var name so user immediately knows what to fix
- `src/index.ts` calls `validateConfiguration` after `resolveReviewers` and before `new CrossReviewEngine` — exits with code 1 on failure
- 10 new TDD tests covering VALID-01 (missing keys detected, mixed valid/invalid) and VALID-02 (error messages contain model name and env var name)
- 52/52 tests pass (42 pre-existing + 10 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for validateConfiguration** - `08c9867` (test)
2. **Task 2: GREEN — Implement validateConfiguration and wire into startup** - `584e764` (feat)

_Note: TDD tasks have two commits (test → feat)_

## Files Created/Modified
- `src/engine.ts` — Added `validateConfiguration()` export (real implementation replacing stub after GREEN)
- `src/index.ts` — Added import of `validateConfiguration`, startup validation gate with process.exit(1)
- `test/smoke.test.js` — Added import of `validateConfiguration`, 10 new API Key Validation tests

## Decisions Made
- `validateConfiguration()` returns structured `{ valid, errors }` — does not throw — lets `index.ts` control the exit strategy cleanly
- Error messages are human-readable and include both the model name (what is broken) and the env var name (what to set) — satisfies VALID-02 fully
- Provider fallback logic in `validateConfiguration` mirrors `initClients()` — openai defaults to `OPENAI_API_KEY`, gemini to `GEMINI_API_KEY`, openai-compatible requires explicit `apiKeyEnv`
- openai-compatible reviewers without `apiKeyEnv` get a descriptive error rather than silently skipping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- API key validation is complete and wired at startup
- Ready for 02-02 (next plan in validation-and-safety phase)
- No blockers

---
*Phase: 02-validation-and-safety*
*Completed: 2026-02-23*

## Self-Check: PASSED

- src/engine.ts: FOUND
- src/index.ts: FOUND
- test/smoke.test.js: FOUND
- 02-01-SUMMARY.md: FOUND
- Commit 08c9867 (RED): FOUND
- Commit 584e764 (GREEN): FOUND
