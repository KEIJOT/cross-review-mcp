# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

