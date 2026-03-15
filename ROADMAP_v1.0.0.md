# cross-review-mcp v1.0.0 Roadmap (Updated 2026-03-15)

## Current Status: Near v1.0 Release

**Server:** Running v0.5.2 with 4 tools, stdio + HTTP dual transport
**Dashboard:** Live web dashboard with real-time SSE at port 6280
**Remote:** StreamableHTTP transport for network MCP connections
**Tests:** 79 assertions passing (smoke + unit tests)

---

## Phase 1: Core Feature Completion

- [x] MCP server architecture (working)
- [x] `review_content` tool
- [x] `get_dev_guidance` tool (HERO FEATURE)
- [x] `get_cache_stats` tool
- [x] `get_cost_summary` tool
- [x] Consensus algorithm (src/consensus-algorithm.ts)
- [x] Developer guidance logic (src/dev-guidance.ts wired)
- [x] Error handling & retry logic (src/error-handling.ts)
- [x] `.env.example` configuration template
- [x] README with innovation story
- [x] `.gitignore` for secrets
- [x] Wire consensus algorithm into `get_dev_guidance`
- [x] Add structured logging (JSON format via src/logger.ts)
- [x] Wire CacheManager into `review_content` results
- [x] Wire CostManager to track per-provider token usage
- [x] Cache invalidation strategy (LRU eviction + TTL)
- [x] Graceful degradation (skip missing API keys)
- [ ] **Test `get_dev_guidance` end-to-end with real API calls**

---

## Phase 2: Production Hardening

### Testing
- [x] Unit tests for consensus algorithm (unanimous, split, scoring, paradigm shift)
- [x] Unit tests for CacheManager (hit/miss, eviction, TTL, clear, stats)
- [x] Unit tests for CostManager (track, accumulate, multi-model, report, reset)
- [x] Unit tests for EventBus (emit/receive, ring buffer, uptime)
- [x] Unit tests for Logger (configure, reconfigure)
- [ ] Integration tests with mock LLM responses
- [ ] E2E test: Full workflow from error to guidance
- [ ] Inspector smoke test (verify tools respond)

### Documentation
- [x] API documentation (each tool + parameters in README)
- [x] Deployment guide (stdio, HTTP, remote in README + USER_GUIDE)
- [x] Troubleshooting guide (USER_GUIDE)
- [x] Example: Solving "PORT IS IN USE" error
- [ ] Contributing guide

### Features
- [x] CLI tool: `cross-review dev <error>` (src/cli.ts)
- [x] Monthly cost report generation (CostManager.getMonthlyReport)
- [x] Live web dashboard (src/dashboard.ts + src/server.ts)
- [x] HTTP transport for remote access (StreamableHTTP)
- [x] Dual transport mode (stdio + HTTP simultaneously)
- [ ] Model performance benchmarking

---

## Phase 3: Distribution

### Claude Desktop Integration
- [x] stdio transport config documented
- [x] StreamableHTTP `url` config documented
- [ ] Publish to Claude MCP registry
- [ ] One-click install from Claude.ai

### Packaging
- [x] npm package configured (package.json ready)
- [ ] npm package publish
- [ ] GitHub release with changelog
- [ ] Docker image build & push
- [ ] Dockerfile

---

## Phase 4: Enhancements (v2.0, Future)

### Developer Experience
- [ ] VS Code extension (right-click error -> Get Guidance)
- [x] Web dashboard (review history, cost analytics) -- DONE
- [ ] GitHub issue integration (auto-comment guidance)
- [ ] Slack bot (ask guidance from Slack)

### Advanced Features
- [ ] Learning from past solutions (knowledge base)
- [ ] Team collaboration features
- [ ] API rate limiting per user
- [ ] Model voting preferences per team

---

## v1.0.0 Launch Checklist

**Core Features:**
- [x] `get_dev_guidance` tool fully functional
- [x] Consensus algorithm implemented
- [x] Error handling & retry logic
- [x] Caching & cost tracking wired into executor
- [x] All 4 tools working end-to-end
- [x] Live web dashboard
- [x] Remote MCP access via HTTP

**Quality:**
- [x] 79 unit/smoke tests passing
- [x] All error cases handled gracefully (graceful degradation)
- [x] Structured JSON logging
- [ ] Real API key E2E testing passed
- [ ] Inspector integration verified

**Documentation:**
- [x] README complete with examples
- [x] API docs for all tools
- [x] Deployment instructions (stdio, HTTP, remote)
- [x] Troubleshooting guide
- [x] Technical architecture guide

**Distribution:**
- [x] Claude Desktop integration documented (stdio + HTTP)
- [x] npm package ready to publish
- [ ] Docker image tested
- [ ] GitHub release created

---

## Remaining Items for v1.0.0

1. **E2E test with real API keys** -- validate actual LLM responses parse correctly
2. **Integration tests with mock LLM** -- test executor flow without API calls
3. **npm publish** -- `npm publish` to registry
4. **GitHub release** -- tag v1.0.0 with changelog
5. **Dockerfile** -- for containerized deployment
6. **Contributing guide** -- for open source contributors
