# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cross-Review MCP — an MCP server that sends user content to multiple LLMs with adversarial prompts, then synthesizes consensus on what's actually wrong. Published to npm as `cross-review-mcp`.

## Commands

```bash
npm run build          # tsc → dist/
npm run dev            # tsc --watch
npm run test           # build + run test/smoke.test.js (74 assertions, no API keys needed)
npm start              # start MCP server (stdio transport)
npm run inspect        # MCP protocol inspector/debugger
```

Live API tests (require API keys in `.env`):
```bash
node test/test-live.mjs      # end-to-end with real API calls
node test/test-single.mjs    # single reviewer test
node test/test-keys.mjs      # validate API key configuration
```

## Architecture

Three source files, ~1100 LOC total:

- **`src/index.ts`** — MCP server setup, tool registration (`cross_review`, `list_models`, `list_scrutiny_levels`, `list_content_types`), input validation via Zod, result formatting with severity filtering
- **`src/engine.ts`** — `CrossReviewEngine` class. Manages provider clients (OpenAI, Gemini, OpenAI-compatible), runs all reviewers in parallel via `Promise.all()`, selects the most cautious model as consensus arbitrator, tracks token usage and cost estimation
- **`src/prompts.ts`** — Prompt templates. 4 scrutiny levels (quick/standard/adversarial/redteam), 7 content types (general/paper/code/proposal/legal/medical/financial), confidence calibration rules

### Data flow

1. MCP client calls `cross_review` tool → Zod validates inputs
2. Engine checks content size (warn >50K tokens, reject >100K)
3. Builds adversarial prompt from scrutiny level + content type
4. All reviewers called in parallel
5. If `includeConsensus` and ≥2 successful reviews: arbitrator (model with fewest HIGH-confidence claims) synthesizes verdict (proceed/revise/abort)
6. Returns structured result with per-model critiques, consensus, token counts, and cost

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
