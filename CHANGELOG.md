# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] — 2026-03-19

### Added
- **Model Discovery & Hot-Swap** — 4 new MCP tools for managing LLM providers at runtime:
  - `search_models` — Search OpenRouter's 300+ model catalog (filter by name, free/paid, context length)
  - `test_model` — Probe any model with a test request (returns latency, tokens, content)
  - `swap_model` — Test-then-replace a reviewer's model in `llmapi.config.json`
  - `find_replacement` — Auto-search, parallel-test candidates, recommend the best replacement
- **Zero-token detection** — Models returning 0 output tokens + empty content are now retried once, then marked as failures instead of phantom successes. Prevents ghost providers from degrading consensus.
- **Transient retry** — Single retry with 2s delay for network errors and 5xx server errors. No retry for 4xx (auth, rate limit).
- **`apiKeyEnv` config field** — Reviewers can specify which env var holds their API key, enabling multiple reviewers to share one key (e.g., two OpenRouter-backed models using `OPENROUTER_API_KEY`).
- **Enriched query logs** — `verdict`, `verdictSummary`, `cacheHit`, and per-model `modelResults` array now flow through events into query log entries.
- **`/api/query-logs/models` endpoint** — Per-model success rate, avg latency, avg input/output tokens derived from enriched logs.
- **Session ID passthrough** — MCP session IDs flow from HTTP transport through executor to query logs (no longer "unknown").
- **`docs/model-discovery.md`** — Comprehensive guide covering model search, testing, swapping, and configuration.

### Changed
- OpenRouter provider: fixed `max_completion_tokens` → `max_tokens` for non-OpenAI compatible APIs
- OpenRouter provider: added required `HTTP-Referer` and `X-Title` headers
- Provider response parsing is now null-safe (graceful handling of missing `choices`/`usage` fields)
- Health endpoint now respects `apiKeyEnv` when checking provider status
- Default config updated: replaced dead DeepSeek (402) and deprecated Llama 3.1 with working free models (Nemotron Super 120B, OpenRouter Free Router)

### Fixed
- OpenRouter returning 0 tokens / empty responses — root cause was `max_completion_tokens` parameter not supported by OpenAI-compatible APIs
- Verdict and consensus data missing from query logs (`verdict` and `verdictSummary` were always undefined)
- Cache hits indistinguishable from regular requests in logs (now tagged with `cacheHit: true`)
- Session ID always "unknown" in query logs

## [0.6.2] — 2026-03-18

### Changed
- Fixed session ID header timing for HTTP StreamableHTTPServerTransport
- Changed MCP client config from "type": "sse" to "type": "http"
- Added JSON error response for unknown routes

### Fixed
- Session ID not returned to client in initial POST /mcp response
- Client could not establish SSE stream due to missing session ID in headers

### Deployed
- Linux systemd service created and auto-restart enabled

## [0.6.0] — 2026-03-15

### Added
- **Semantic consensus** — Jaccard similarity clustering replaces exact-string matching. "Port in use" and "port occupied" now correctly cluster together.
- **Per-request model selection** — `models` parameter on `review_content` and `get_dev_guidance`. Supports presets (`"fast"`, `"balanced"`, `"thorough"`) or explicit model ID arrays.
- **HTTP authentication** — `--auth-token` CLI flag or `AUTH_TOKEN` env var. Bearer token required on all HTTP routes when set. Dashboard accessible via `/?token=xxx`.
- **Health check endpoint** — `GET /health` returns server status, provider availability, uptime, version. Always unauthenticated for load balancer/Docker health checks.
- **Config-based provider costs** — CostManager reads pricing from `llmapi.config.json` instead of hardcoded values. Adding a new provider with custom costs is now zero-code.
- **Model benchmarking** — `benchmark_models` tool reports per-model avg/P95 latency, error rate, tokens/request, cost efficiency, and reliability ranking from historical data.

### Changed
- Bumped version to 0.6.0
- Consensus algorithm now uses word-level Jaccard similarity (threshold 0.35) to cluster semantically similar diagnoses before voting
- Executor sorts providers by config cost for `"fast"` and `"balanced"` presets
- CostManager falls back to hardcoded defaults only when config costs are absent

### Tests
- 136 offline tests passing (102 smoke + 34 integration)
- 31 E2E tests passing with real API keys
- New tests for: Jaccard similarity, semantic clustering, config-based costs, health endpoint, auth middleware, model selection presets, model benchmarking

## [0.5.0] — 2026-03-15

### Added
- Complete TypeScript rewrite with modular architecture
- Multi-provider support: OpenAI, Google Gemini, DeepSeek (OpenAI-compatible)
- Provider factory pattern for extensibility
- Zod validation for type safety
- Token tracking and cost estimation
- Error resilience (partial results on provider failure)
- Complete documentation suite (13+ guides)
- `.github/workflows/` for CI/CD
- Architecture diagrams and flow documentation
- Status badges and release automation
- GitHub topics for discoverability

### Changed
- Migrated from Python-first to TypeScript-first codebase
- Improved provider abstraction layer
- Enhanced error messages and logging
- Better token usage tracking across all models
- Updated README with v0.5 features

### Fixed
- Markdown-resilient verdict parsing (handles Mistral bold markers)
- Token estimation accuracy
- Cost calculation per model

### Documented
- QUICK_START.md
- INSTALLATION.md
- CONFIGURATION.md
- CLI_REFERENCE.md
- ARCHITECTURE.md
- SETUP_OPENAI.md
- SETUP_GEMINI.md
- SETUP_DEEPSEEK.md
- PROVIDER_COMPARISON.md
- TESTING.md
- DEBUGGING.md
- FAQ.md
- MCP_INTEGRATION.md

## [0.4.1] — 2026-02-24

### Added
- CLAUDE.md for Claude Code users
- Production hardening (security, license, contributing guidelines)
- Enhanced error handling

### Fixed
- Mistral markdown heading parsing

## [0.4.0] — 2026-02-23

### Added
- Initial MCP server implementation
- Multi-model support (OpenAI, Gemini)
- Consensus building across reviewers
- Adversarial prompt templates
- Token usage tracking
