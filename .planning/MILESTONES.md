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

## v0.4.1 — Pre-Publish Hardening (active)

**Started:** 2026-02-23
**Goal:** Fix all actionable issues from CONCERNS.md for publish readiness
