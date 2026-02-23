# Cross-Review MCP

## What This Is

An MCP server that sends content to multiple AI models with adversarial review prompts and synthesizes consensus verdicts. Used by Claude Desktop, Claude Code, Cursor, and other MCP clients for cross-LLM peer review of proposals, code, and documents. Hardened with startup validation, config schema enforcement, and content safety guards.

## Core Value

Multi-model adversarial review with consensus synthesis — no single model's biases go unchallenged.

## Requirements

### Validated

<!-- Shipped and confirmed valuable -->

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
- ✓ Structured consensus error reporting — v0.4.1
- ✓ Robust verdict parsing (markdown formatting variants) — v0.4.1
- ✓ API key validation on startup (fail fast) — v0.4.1
- ✓ Zod schema validation for reviewer config — v0.4.1
- ✓ Content size pre-flight check (warn >50K, reject >100K tokens) — v0.4.1
- ✓ Robust HIGH-confidence counting regex — v0.4.1

### Active

<!-- Next milestone scope — to be defined via /gsd:new-milestone -->

(None yet — define with next milestone)

### Out of Scope

- Rate limiting — Deferred, left to MCP server/client layer
- Result caching — Adds complexity, low value for current usage patterns
- Streaming for large results — Not blocking any current use case
- Review history/audit logging — Future milestone
- Webhook/async callbacks — Future milestone
- Live token pricing — Static rates sufficient, stale pricing is minor
- Regex/string performance — Nanoseconds vs 30s API calls, not meaningful

## Context

- v0.4.1 shipped with all CONCERNS.md issues resolved
- Codebase: 1,108 LOC TypeScript (engine.ts, index.ts, prompts.ts)
- Test suite: 74 assertions in smoke.test.js, all passing
- Tech stack: TypeScript, MCP SDK, OpenAI SDK, Google Generative AI, Zod
- No breaking changes from v0.4.0 — all fixes are internal hardening
- Ready for npm publish

## Constraints

- **Backwards compatibility**: No breaking changes to MCP tool interface or CrossReviewResult type
- **Dependencies**: Only use existing deps (openai, @google/generative-ai, zod, @modelcontextprotocol/sdk)
- **Testing**: All fixes must have passing tests before merge

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skip rate limiting for v0.4.1 | Left to MCP layer, not engine concern | ✓ Good — keeps engine focused |
| Skip result caching | Adds complexity, reviews should be fresh | ✓ Good — no user demand |
| Use Zod for config validation | Already a dependency, not yet used at runtime | ✓ Good — catches config errors at startup |
| Error sentinel pattern for consensus | error field present = attempted-and-failed; undefined = not requested | ✓ Good — clear semantics |
| Strip `**` before regex matching | Simpler than optional groups, handles all bold variants | ✓ Good — single preprocessing step |
| validateConfiguration returns {valid, errors} | Does not throw — lets caller control exit strategy | ✓ Good — clean startup gate |
| resolveReviewers throws on invalid input | No silent fallback to defaults — callers must handle | ✓ Good — prevents silent misconfiguration |
| HTTPS enforcement via Zod .refine() | url() validates format, refine() enforces protocol | ✓ Good — clean composition |
| estimateTokens uses Math.ceil(length/4) | No tokenizer dependency, sufficient for threshold gating | ✓ Good — simple and effective |
| Rejection throws before any API call | Zero wasted work on oversized content | ✓ Good — cost protection |

---
*Last updated: 2026-02-23 after v0.4.1 milestone*
