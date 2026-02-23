# Milestones

## v0.4.0 — Multi-Provider Support (shipped)

**Shipped:** 2026-02-22

**Delivered:**
- Multi-provider review engine (OpenAI, Gemini, OpenAI-compatible)
- Configurable reviewers via CROSS_REVIEW_MODELS env var
- KNOWN_PROVIDERS registry (GPT-5.2, Gemini Flash, DeepSeek, Mistral, Llama, Qwen)
- Parallel review execution with consensus arbitration
- 4 scrutiny levels, 7 content types
- Token tracking and cost estimation
- MCP tools: cross_review, list_models, list_scrutiny_levels, list_content_types
- npm publishable as cross-review-mcp

**Last phase:** 0 (pre-GSD)

---

## v0.4.1 — Pre-Publish Hardening

**Shipped:** 2026-02-23
**Phases:** 1-2 (2 phases, 5 plans, 10 tasks)
**Git range:** `028d00d`..`0e900e3`
**LOC:** 1,108 TypeScript (2,037 insertions, 97 deletions)

**Delivered:** All 6 actionable issues from CONCERNS.md resolved — engine hardened for npm publish.

**Key accomplishments:**
- Structured consensus error reporting — buildConsensus() returns `{error}` objects instead of silent undefined
- Markdown-aware verdict/confidence parsing — handles bold, case, whitespace variants from LLM output
- Startup API key validation — validateConfiguration() fails fast with model name + env var error messages
- Zod schema for reviewer config — rejects malformed JSON, wrong types, non-HTTPS URLs at parse time
- Content size guards — warns at ~50K tokens, rejects at ~100K tokens before any API call

**Archive:** `milestones/v0.4.1-ROADMAP.md`, `milestones/v0.4.1-REQUIREMENTS.md`

---

