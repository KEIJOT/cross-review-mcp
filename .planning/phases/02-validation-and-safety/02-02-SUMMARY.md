---
phase: 02-validation-and-safety
plan: 02
subsystem: api
tags: [validation, zod, configuration, env-vars, security, https, tdd]

# Dependency graph
requires:
  - phase: 02-01
    provides: resolveReviewers() exported from engine.ts, ReviewerConfig interface
  - phase: 01-engine-robustness
    provides: engine.ts structure and KNOWN_PROVIDERS map
provides:
  - ReviewerConfigSchema (Zod schema) in src/engine.ts — validates full reviewer config objects
  - ReviewerConfigArraySchema in src/engine.ts — validates array of shorthands or full objects
  - resolveReviewers() throws on invalid input instead of silently falling back to defaults
  - HTTPS enforcement for custom baseUrl via Zod .refine()
  - TDD tests for VALID-03, VALID-04, VALID-05 in test/smoke.test.js
affects: [02-03, any phase touching resolveReviewers or CROSS_REVIEW_MODELS]

# Tech tracking
tech-stack:
  added: []
  patterns: [Zod schema validation at parse time, throw-on-invalid instead of silent fallback, HTTPS enforcement via .refine()]

key-files:
  created: []
  modified:
    - src/engine.ts
    - src/index.ts
    - test/smoke.test.js

key-decisions:
  - "resolveReviewers() throws instead of falling back to defaults — callers must handle errors explicitly (no silent corruption)"
  - "ZodError wrapped into human-readable multi-line message: CROSS_REVIEW_MODELS validation failed with per-field issue list"
  - "HTTPS enforcement uses .refine() on the baseUrl field rather than a regex — url() validates format, refine() enforces protocol"
  - "Union type (string | ReviewerConfigSchema) reports 'Invalid input' for Zod union mismatches — test assertions updated to accept 'invalid' alongside 'string|expected|type'"
  - "index.ts wraps resolveReviewers in try/catch at startup — exits with code 1 and prints error to stderr"

patterns-established:
  - "Throw-on-invalid pattern: validation errors become thrown exceptions callers must handle (not logged+swallowed)"
  - "Zod schema co-located with the TypeScript interface it validates"

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 02 Plan 02: Zod Config Validation Summary

**Zod schema validates CROSS_REVIEW_MODELS at parse time — malformed JSON, wrong types, HTTP baseUrl, and missing required fields all throw descriptive errors instead of silently falling back to defaults (VALID-03, VALID-04, VALID-05)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-23T13:23:55Z
- **Completed:** 2026-02-23T13:28:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- `ReviewerConfigSchema` and `ReviewerConfigArraySchema` defined in `src/engine.ts` using Zod — validates id (string), name (optional string), provider (enum), model (string), baseUrl (HTTPS-only URL), apiKeyEnv (optional string)
- `resolveReviewers()` rewrites to throw on JSON parse failure and on Zod validation failure — no more `console.error + return DEFAULT_REVIEWERS` silent fallback
- baseUrl enforces HTTPS via `.refine((url) => url.startsWith("https://"))` — HTTP URLs produce `"baseUrl must use HTTPS"` message (VALID-04)
- ZodError formatted into multi-line human-readable message with `path: message` per issue
- `src/index.ts` startup wraps `resolveReviewers` in try/catch — exits with code 1 and descriptive error printed to stderr
- 14 new TDD tests covering VALID-03, VALID-04, VALID-05; 66/66 tests pass (52 pre-existing + 14 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for Zod config validation** - `7513957` (test)
2. **Task 2: GREEN — Add Zod schema and enforce validation in resolveReviewers** - `683d950` (feat)

_Note: TDD tasks have two commits (test → feat)_

## Files Created/Modified
- `src/engine.ts` — Added `import { z } from "zod"`, `ReviewerConfigSchema`, `ReviewerConfigArraySchema`, rewrote `resolveReviewers()` to throw on invalid input
- `src/index.ts` — Wrapped `resolveReviewers()` call in try/catch with `process.exit(1)` on error
- `test/smoke.test.js` — Added `resolveReviewers` import, 14 new assertions in "Zod Config Validation" section

## Decisions Made
- `resolveReviewers()` now throws instead of silently falling back — callers are forced to handle invalid configs rather than silently proceeding with defaults
- ZodError wrapped into human-readable format — raw Zod output is technical, the wrapped message leads with "CROSS_REVIEW_MODELS validation failed:" so users know immediately what to fix
- HTTPS enforcement uses `.refine()` not regex — cleaner composition: `z.string().url()` handles URL format, `.refine()` handles protocol requirement
- `index.ts` startup catch block exits with code 1 — startup gate mirrors the API key validation gate established in 02-01

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test assertion pattern to match actual Zod union error message**
- **Found during:** Task 2 (GREEN phase, first test run)
- **Issue:** Test assertion `/string|expected|type/i` did not match Zod's union error message "Invalid input" — this is correct Zod behavior for union type mismatches, not a bug in the schema
- **Fix:** Added "invalid" to the assertion regex pattern: `/string|expected|type|invalid/i`
- **Files modified:** `test/smoke.test.js`
- **Verification:** 66/66 tests pass after fix
- **Committed in:** `683d950` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test assertion tightness)
**Impact on plan:** Minimal — assertion was overly narrow for Zod's union error wording. Fix is correct and test intent preserved.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Zod config validation complete (VALID-03, VALID-04, VALID-05)
- API key validation complete (VALID-01, VALID-02) from 02-01
- Ready for 02-03 (next plan in validation-and-safety phase)
- No blockers

---
*Phase: 02-validation-and-safety*
*Completed: 2026-02-23*

## Self-Check: PASSED

- src/engine.ts: FOUND
- src/index.ts: FOUND
- test/smoke.test.js: FOUND
- 02-02-SUMMARY.md: FOUND
- Commit 7513957 (RED): FOUND
- Commit 683d950 (GREEN): FOUND
