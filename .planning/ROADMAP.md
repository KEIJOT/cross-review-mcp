# Roadmap: Cross-Review MCP

## Milestones

- **v0.4.0 Multi-Provider Support** — Phase 0 (shipped 2026-02-22, pre-GSD)
- **v0.4.1 Pre-Publish Hardening** — Phases 1-2 (in progress)

## Overview

v0.4.1 addresses every actionable issue identified in CONCERNS.md before npm publish. Two phases: first harden the consensus engine's error reporting and verdict parsing (internal correctness), then add startup validation and content safety guards (defensive perimeter). No new features, no API changes, no breaking changes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Engine Robustness** - Fix consensus error reporting and parsing brittleness (completed 2026-02-23)
- [ ] **Phase 2: Validation and Safety** - Add startup API key validation, Zod config schema, and content size guards

## Phase Details

### Phase 1: Engine Robustness

**Goal**: The consensus engine reports failures clearly and parses verdict/confidence formats reliably
**Depends on**: Nothing (first phase)
**Requirements**: ERR-01, ERR-02, PARSE-01, PARSE-02
**Success Criteria** (what must be TRUE):
  1. When buildConsensus() encounters an error, the returned result contains a structured error field with a human-readable reason — no undefined, no silent swallowing
  2. A caller receiving a failed consensus response can read the failure reason without inspecting stack traces or logs
  3. parseVerdict() correctly extracts verdicts from markdown-formatted lines (e.g., **APPROVE**, **approve**, bold with surrounding whitespace) without returning null
  4. countHighConfidenceClaims() correctly counts claims regardless of whether confidence labels are plain text, bold, uppercase, lowercase, or have extra whitespace
**Plans**: 2 plans (TDD)

Plans:
- [x] 01-01-PLAN.md — Structured consensus error reporting (ERR-01, ERR-02) [TDD, wave 1]
- [x] 01-02-PLAN.md — Robust verdict and confidence parsing (PARSE-01, PARSE-02) [TDD, wave 2, depends on 01-01]

### Phase 2: Validation and Safety

**Goal**: The server fails fast on misconfiguration and refuses oversized content before wasting API calls
**Depends on**: Phase 1
**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04, VALID-05, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. Starting the server with a missing API key for any configured reviewer produces a clear error listing the misconfigured models — no review runs, no partial execution
  2. A CROSS_REVIEW_MODELS value that fails Zod schema validation (malformed JSON, wrong types, invalid baseUrl) is rejected with a descriptive error message at parse time
  3. Submitting content above ~50K tokens produces a warning in the review result (review still proceeds)
  4. Submitting content above ~100K tokens causes immediate rejection with a clear error before any API call is made
  5. A reviewer config with a non-HTTPS baseUrl is rejected at validation time with a clear message
**Plans**: TBD

Plans:
- [ ] 02-01: API key validation on startup (VALID-01, VALID-02)
- [ ] 02-02: Zod schema for reviewer config (VALID-03, VALID-04, VALID-05)
- [ ] 02-03: Content size pre-flight checks (SAFE-01, SAFE-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Engine Robustness | v0.4.1 | 2/2 | ✓ Complete | 2026-02-23 |
| 2. Validation and Safety | v0.4.1 | 0/3 | Not started | - |
