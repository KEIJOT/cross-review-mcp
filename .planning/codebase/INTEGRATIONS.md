# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**LLM Providers:**
- **OpenAI** - GPT-5.2, GPT-5.2-instant, GPT-4o models
  - SDK/Client: `openai` npm package (4.0.0)
  - Auth: `OPENAI_API_KEY` environment variable
  - Implementation: `src/engine.ts` lines 166-176 (OpenAI client initialization)
  - API: REST endpoint via openai client library

- **Google Gemini** - Gemini 3.1 Pro, Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Flash
  - SDK/Client: `@google/generative-ai` npm package (0.21.0)
  - Auth: `GEMINI_API_KEY` environment variable
  - Implementation: `src/engine.ts` lines 177-179 (Gemini client initialization)
  - API: REST endpoint via generative-ai client library

- **DeepSeek** (OpenAI-compatible) - DeepSeek V3, DeepSeek R1
  - SDK/Client: `openai` npm package (generic OpenAI-compatible client)
  - Auth: `DEEPSEEK_API_KEY` environment variable
  - Base URL: `https://api.deepseek.com`
  - Implementation: `src/engine.ts` lines 166-176 (shared OpenAI-compatible handler)
  - Known configs: `src/engine.ts` lines 83-84 (KNOWN_PROVIDERS)

- **Mistral** (OpenAI-compatible) - Mistral Large
  - SDK/Client: `openai` npm package (generic OpenAI-compatible client)
  - Auth: `MISTRAL_API_KEY` environment variable
  - Base URL: `https://api.mistral.ai/v1`
  - Implementation: `src/engine.ts` lines 166-176 (shared OpenAI-compatible handler)
  - Known configs: `src/engine.ts` line 86 (KNOWN_PROVIDERS)

- **OpenRouter** (OpenAI-compatible) - Llama 3.3 70B, Qwen3 32B (free tier)
  - SDK/Client: `openai` npm package (generic OpenAI-compatible client)
  - Auth: `OPENROUTER_API_KEY` environment variable
  - Base URL: `https://openrouter.ai/api/v1`
  - Implementation: `src/engine.ts` lines 166-176 (shared OpenAI-compatible handler)
  - Known configs: `src/engine.ts` lines 88-89 (KNOWN_PROVIDERS)
  - Note: Free models may use prompts for training

## Model Configuration

**Supported Provider Types:**
- `openai` - Direct OpenAI API integration
- `gemini` - Direct Google Gemini API integration
- `openai-compatible` - Any OpenAI-compatible API (DeepSeek, Mistral, OpenRouter, custom)

**Configuration:**
- Reviewers configured via `CROSS_REVIEW_MODELS` environment variable (optional)
- Format: JSON array of model IDs (shorthands) or full `ReviewerConfig` objects
- Default reviewers (if env var not set): GPT-5.2 + Gemini 3 Flash
- Shorthand shorthands defined in `src/engine.ts` lines 72-90 (KNOWN_PROVIDERS)

**Token Pricing:**
- Pricing tracked in `src/engine.ts` lines 120-139 (MODEL_COSTS)
- USD per 1M tokens for input/output
- Used for cost estimation in review results
- Covers OpenAI, Google Gemini, DeepSeek, Mistral, and free OpenRouter models

## Data Flow

**Review Process:**
1. User submits content via `cross_review` MCP tool in `src/index.ts` lines 29-88
2. Engine parallelizes review requests to all configured models
3. Each model receives adversarial prompt built with `buildAdversarialPrompt()` from `src/prompts.ts` lines 47-107
4. Model responses collected with token usage metadata
5. Consensus building (optional) via arbitrator model using `buildConsensusPrompt()` from `src/prompts.ts` lines 170-225
6. Final result aggregates all reviews, consensus, and cost estimation

**Asynchronous:**
- All LLM API calls made with `await` pattern in `src/engine.ts` lines 215-219 (review promises)
- Consensus building awaited after reviews complete: `src/engine.ts` lines 225-240
- Timeout handling: relies on underlying SDK timeout behavior (no custom timeout implemented)

## Error Handling

**Failed API Calls:**
- Caught in try-catch block at `src/engine.ts` lines 289-356
- Failed reviews marked as `status: "error"` with error message
- Consensus building gracefully returns undefined if arbitrator fails: `src/engine.ts` lines 388-459
- Missing API keys logged to stderr but don't prevent execution: `src/engine.ts` lines 161-164

**Validation:**
- Input parameters validated with Zod schemas in `src/index.ts` lines 32-58
- Model configuration parsing with fallback to defaults: `src/engine.ts` lines 92-116

## MCP Integration

**Protocol:**
- Model Context Protocol (MCP) server implementation
- Transport: stdio (standard input/output)
- Framework: @modelcontextprotocol/sdk 1.0.0

**Entry Point:**
- `src/index.ts` lines 255-264 - Server startup via StdioServerTransport
- Server listens for tool calls over stdio, dispatches to CrossReviewEngine

**Tools Exposed:**
- `cross_review` - Main review tool with parameters: content, scrutiny_level, content_type, include_consensus, min_severity
- `list_models` - Lists active reviewers and available model shorthands
- `list_scrutiny_levels` - Lists scrutiny level configurations
- `list_content_types` - Lists available content type handlers

## Environment Configuration

**Required env vars:**
- At minimum: `OPENAI_API_KEY` OR `GEMINI_API_KEY` (need at least one for default setup)
- For custom models: corresponding provider API keys matching CROSS_REVIEW_MODELS

**Loading:**
- Environment variables loaded via Node.js `process.env`
- Optional dotenv support (dotenv package available but not auto-loaded by default)
- `.env` file exists but contents not exposed in code analysis (permissions denied)

**API Key References:**
- OpenAI: `process.env.OPENAI_API_KEY` (checked at `src/engine.ts` lines 156)
- Gemini: `process.env.GEMINI_API_KEY` (checked at `src/engine.ts` lines 158)
- Dynamic lookup: reviewer.apiKeyEnv at `src/engine.ts` lines 153-159

## Webhook & Callbacks

**Incoming:**
- Not applicable - this is a tool provider, not a service receiving webhooks

**Outgoing:**
- No webhook support - only one-way HTTP requests to configured LLM APIs
- No persistence of review results - ephemeral per-request processing
- No callbacks to external services

## Data Privacy & Security

**What is sent to external APIs:**
- Content being reviewed (user-provided text)
- Prompts requesting adversarial critique
- All sent to configured LLM provider APIs as per their data policies

**What is NOT sent:**
- API keys (only to respective provider)
- Other users' data
- System credentials or environment variables (except configured API keys to their respective services)

**Logging:**
- User content NOT logged persistently
- Errors logged to stderr for debugging (console.error)
- Token usage tracked in response (for cost estimation)
- No local storage of review history

See `SECURITY.md` for comprehensive security posture details.

---

*Integration audit: 2026-02-23*
