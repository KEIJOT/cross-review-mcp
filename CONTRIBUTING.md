# Contributing to cross-review-mcp

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/KEIJOT/cross-review-mcp.git
cd cross-review-mcp
npm install
npm run build
```

## Development

```bash
npm run dev              # Watch mode (recompiles on save)
npm run test             # Smoke tests (79 assertions, no API keys needed)
npm run test:integration # Integration tests (22 assertions, no API keys needed)
npm run test:all         # All offline tests (101 assertions)
npm run serve            # Start HTTP server with dashboard on port 6280
npm run serve:both       # stdio + HTTP simultaneously
```

### Running E2E Tests (requires API keys)

Create a `.env` file from the example and add your keys:
```bash
cp .env.example .env
# Edit .env with your API keys
node test/e2e.test.mjs
```

The E2E test gracefully skips if no keys are found.

## Project Structure

```
src/
  index.ts              Entry point, tool registration, --mode/--port/--host flags
  executor.ts           ReviewExecutor - parallel providers, cache, cost tracking
  providers.ts          OpenAI, Gemini, OpenAI-compatible implementations
  config.ts             Configuration loading + Zod validation
  types.ts              TypeScript interfaces
  consensus-algorithm.ts  Multi-model consensus synthesis
  dev-guidance.ts       Developer guidance tool
  events.ts             EventBus for live dashboard updates (SSE)
  server.ts             Express HTTP server (dashboard + StreamableHTTP MCP)
  dashboard.ts          Embedded HTML/CSS/JS dashboard
  cache.ts              LRU cache with TTL and disk persistence
  cost-manager.ts       Per-model cost tracking with thresholds
  logger.ts             Structured JSON logging (stderr)
  tracking.ts           Token usage log file
  cli.ts                CLI tool (cross-review command)
test/
  smoke.test.js         Unit tests (offline)
  integration.test.js   Integration tests (offline)
  e2e.test.mjs          E2E tests (requires API keys)
```

## Making Changes

1. Create a branch from `main`
2. Make your changes in `src/`
3. Run `npm run build` to verify compilation
4. Run `npm run test:all` to verify all 101 tests pass
5. If adding new functionality, add tests
6. Open a pull request

## Code Style

- ESM throughout (`.js` extensions in imports, `"type": "module"`)
- TypeScript strict mode
- No external test framework - plain Node.js assertions
- Prefer additive changes that don't break existing behavior
- Structured logging via `src/logger.ts` (writes to stderr, not stdout)
- Console suppression in stdio mode to avoid MCP protocol interference

## Adding a New Provider

1. Add a new class in `src/providers.ts` implementing `LLMProvider`
2. Add a case in `createProvider()` factory function
3. Add reviewer entry in `llmapi.config.json`
4. Add cost rates in `src/cost-manager.ts` `MODEL_COSTS` map
5. Test with `node test/e2e.test.mjs`

## Adding a New Tool

1. Add tool schema in `registerTools()` in `src/index.ts`
2. Add handler case in the `CallToolRequestSchema` switch
3. Add tests in `test/smoke.test.js`
4. Update README.md with tool documentation

## Reporting Issues

Use GitHub Issues: https://github.com/KEIJOT/cross-review-mcp/issues

Include:
- Node.js version (`node --version`)
- OS and environment
- Error message and stack trace
- Steps to reproduce

## Code of Conduct

Be respectful. We build tools for critical thinking.

## License

MIT
