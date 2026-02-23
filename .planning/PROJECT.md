# Cross-Review MCP

## What This Is

An MCP server that sends content to multiple AI models with adversarial review prompts and synthesizes consensus verdicts. Used by Claude Desktop, Claude Code, Cursor, and other MCP clients for cross-LLM peer review of proposals, code, and documents.

## Core Value

Multi-model adversarial review with consensus synthesis — no single model's biases go unchallenged.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing v0.4.0 codebase. -->

- Multi-provider support (OpenAI, Gemini, OpenAI-compatible)
- Configurable reviewers via CROSS_REVIEW_MODELS env var
- 4 scrutiny levels (quick, standard, adversarial, redteam)
- 7 content types (general, paper, code, proposal, legal, medical, financial)
- Parallel model review execution
- Consensus arbitration (most cautious model)
- Token tracking and cost estimation
- KNOWN_PROVIDERS registry with shorthand IDs
- MCP tool registration (cross_review, list_models, list_scrutiny_levels, list_content_types)
- Severity filtering (min_severity parameter)
- npm publishable as `cross-review-mcp`

### Active

<!-- Current scope: v0.4.1 Pre-Publish Hardening -->

- [ ] Structured consensus error reporting (not silent undefined)
- [ ] Robust verdict parsing (handle markdown formatting variants)
- [ ] API key validation on startup (fail fast)
- [ ] Zod schema validation for reviewer config (security)
- [ ] Content size pre-flight check (warn >50K, reject >100K tokens)
- [ ] Robust HIGH-confidence counting regex for arbitrator selection

### Out of Scope

<!-- Explicit boundaries for v0.4.1 -->

- Rate limiting — Deferred, left to MCP server/client layer
- Result caching — Adds complexity, low value for current usage patterns
- Streaming for large results — Not blocking any current use case
- Review history/audit logging — Future milestone
- Webhook/async callbacks — Future milestone
- Live token pricing — Static rates sufficient, stale pricing is minor
- Regex/string performance — Nanoseconds vs 30s API calls, not meaningful

## Context

- v0.4.0 shipped with multi-provider support and configurable reviewers
- Codebase mapped in .planning/codebase/ (7 documents, 1302 lines)
- CONCERNS.md identified 6 actionable issues for publish readiness
- All fixes are internal engine hardening — no new features, no API changes
- Existing tests: smoke.test.js (14 assertions), test-live.mjs (3 scenarios, 4 models)

## Constraints

- **Backwards compatibility**: No breaking changes to MCP tool interface or CrossReviewResult type
- **Dependencies**: Only use existing deps (openai, @google/generative-ai, zod, @modelcontextprotocol/sdk)
- **Testing**: All fixes must have passing tests before merge

## Current Milestone: v0.4.1 Pre-Publish Hardening

**Goal:** Fix all actionable issues from CONCERNS.md to make the package publish-ready.

**Target fixes:**
- Silent consensus fallback
- Verdict parsing brittleness
- API key validation on startup
- Config schema validation with Zod
- Content size warning
- Consensus arbitrator regex

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skip rate limiting for v0.4.1 | Left to MCP layer, not engine concern | -- Pending |
| Skip result caching | Adds complexity, reviews should be fresh | -- Pending |
| Use Zod for config validation | Already a dependency, not yet used at runtime | -- Pending |

---
*Last updated: 2026-02-23 after v0.4.1 milestone initialization*
