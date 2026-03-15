# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

