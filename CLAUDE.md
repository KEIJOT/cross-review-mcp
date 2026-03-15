# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cross-Review MCP — an MCP server that sends user content to multiple LLMs with adversarial prompts, then synthesizes consensus on what's actually wrong. Published to npm as `cross-review-mcp`.

## Commands

```bash
npm run build          # tsc → dist/
npm run dev            # tsc --watch
npm run test           # build + run test/smoke.test.js (30 assertions, no API keys needed)
npm start              # start MCP server (stdio transport, default)
npm run serve          # HTTP mode: dashboard + remote MCP on port 6280
npm run serve:both     # stdio + HTTP simultaneously
npm run inspect        # MCP protocol inspector/debugger
```

Live API tests (require API keys in `.env`):
```bash
node test/test-live.mjs      # end-to-end with real API calls
node test/test-single.mjs    # single reviewer test
node test/test-keys.mjs      # validate API key configuration
```

## Architecture

Core source files in `src/`:

- **`src/index.ts`** — Entry point. Parses `--mode`/`--port`/`--host` CLI flags. Exports `registerTools()` factory shared by stdio and HTTP transports. Manages console suppression for stdio mode.
- **`src/executor.ts`** — `ReviewExecutor`. Sends requests to all providers in parallel, emits events to `eventBus` as each model completes (not after Promise.all).
- **`src/events.ts`** — Typed `EventBus` (EventEmitter subclass). Events: `request:start`, `model:complete`, `request:complete`. In-memory ring buffer (100 entries) for dashboard history.
- **`src/server.ts`** — Express HTTP server. Routes: `GET /` (dashboard), `GET /api/stats`, `GET /api/events` (SSE), `POST|GET|DELETE /mcp` (StreamableHTTP transport with per-session Server instances).
- **`src/dashboard.ts`** — Embedded HTML/CSS/JS dashboard as template literal. Connects via SSE for live updates.
- **`src/config.ts`** — Configuration loading + Zod validation.
- **`src/providers.ts`** — Provider abstraction (OpenAI, Gemini, OpenAI-compatible).
- **`src/dev-guidance.ts`** — Developer guidance tool. Formats problems, parses multi-model responses, feeds consensus algorithm.
- **`src/consensus-algorithm.ts`** — Consensus synthesis from multiple model perspectives.
- **`src/cache.ts`** — LRU cache with TTL, disk persistence.
- **`src/cost-manager.ts`** — Per-model cost tracking, daily/monthly thresholds, disk persistence.
- **`src/benchmark.ts`** — Model performance benchmarking tool. Compares speed, accuracy, and cost across configured models.

### Data flow

1. MCP client calls tool via stdio or HTTP transport
2. `registerTools()` routes to appropriate handler
3. ReviewExecutor sends to all providers in parallel, emitting `model:complete` events as each resolves
4. Consensus algorithm synthesizes results
5. Dashboard receives events via SSE in real-time
6. Returns structured result with per-model critiques, consensus, token counts, and cost

### Server modes

- `--mode stdio` (default) — stdin/stdout transport, console suppressed
- `--mode http` — Express server with dashboard + StreamableHTTP MCP endpoint
- `--mode both` — stdio + HTTP simultaneously (different I/O channels, no conflict)

### Provider abstraction

- `provider: "openai"` — OpenAI SDK directly
- `provider: "gemini"` — Google Generative AI SDK
- `provider: "openai-compatible"` — OpenAI SDK with custom `baseUrl` (DeepSeek, Mistral, OpenRouter, etc.)

Clients are cached per provider/baseURL. Model shorthands (e.g., `"gpt-5.2"`, `"gemini-flash"`, `"deepseek"`) are defined in `KNOWN_PROVIDERS` in engine.ts.

## Key patterns

- **ESM throughout** — `.js` extensions in imports, `"type": "module"` in package.json
- **Partial success** — one failed reviewer doesn't abort the run; errors captured per-model in `ReviewResult.status`
- **Error sentinel in consensus** — `consensus.error` means attempted-and-failed; `undefined` consensus means not requested
- **Markdown-resilient parsing** — verdict/severity regex strips `**` bold markers before matching (Mistral wraps headings in bold)
- **Token estimation** — `Math.ceil(text.length / 4)` for pre-flight size checks, no tokenizer dependency
- **Cost tracking** — `MODEL_COSTS` map in engine.ts has per-1M-token rates; costs aggregated across all API calls

## Configuration

Reviewers configured via `CROSS_REVIEW_MODELS` env var — accepts JSON array of shorthand strings (`["gpt-5.2","gemini-flash"]`) or full `ReviewerConfig` objects. Validated with Zod at startup. API keys loaded from env vars specified in each provider's `apiKeyEnv` field.

## Planning docs

Project planning lives in `.planning/` — includes `PROJECT.md` (requirements/decisions), `ROADMAP.md`, `STATE.md`, and detailed architecture docs in `.planning/codebase/`.
