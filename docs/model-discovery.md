# Model Discovery & Swap Guide

Cross-Review MCP includes built-in tools for discovering, testing, and swapping LLM provider models. This is useful when:

- A provider's API key runs out of credits
- A model is deprecated or discontinued
- You want to try free alternatives to reduce costs
- A model is consistently slow or returning empty responses
- You want to explore what's available

## Quick Start

### Via MCP Tools (Claude, Cursor, etc.)

The following MCP tools are available in your AI assistant:

#### 1. Search for models

```
search_models({ query: "llama", freeOnly: true })
```

Searches OpenRouter's catalog of 300+ models. Filter by name, free/paid, and context length.

#### 2. Test a specific model

```
test_model({ modelId: "nvidia/nemotron-3-super-120b-a12b:free" })
```

Sends a probe request and returns latency, token counts, and the model's response.

#### 3. Swap a reviewer's model

```
swap_model({
  reviewerId: "openrouter",
  newModelId: "nvidia/nemotron-3-super-120b-a12b:free",
  newName: "Nemotron Super 120B"
})
```

Tests the new model, then updates `llmapi.config.json`. The old model is replaced.

#### 4. Auto-find a replacement

```
find_replacement({ reviewerId: "openrouter", freeOnly: true })
```

Searches for candidates, tests them all in parallel, and recommends the best one by reliability and speed.

## Configuration

### Reviewer Config Fields

Each reviewer in `llmapi.config.json` has these fields:

```json
{
  "id": "nemotron",
  "name": "Nemotron Super 120B",
  "provider": "openai-compatible",
  "model": "nvidia/nemotron-3-super-120b-a12b:free",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKeyEnv": "OPENROUTER_API_KEY",
  "timeout_ms": 30000,
  "execution_order": 3
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier. Used for cost tracking, logs, and API key lookup |
| `name` | No | Display name shown in dashboard and results |
| `provider` | Yes | `"openai"`, `"gemini"`, or `"openai-compatible"` |
| `model` | Yes | Model identifier (provider-specific) |
| `baseUrl` | No | API endpoint. Required for `openai-compatible` providers |
| `apiKeyEnv` | No | Override env var name for API key. Default: `${ID}_API_KEY` |
| `timeout_ms` | No | Request timeout in milliseconds (default: 60000) |
| `execution_order` | No | Ordering hint (lower = higher priority) |

### API Key Resolution

By default, the system looks for `${REVIEWER_ID}_API_KEY` in environment variables:

- `id: "openai"` → `OPENAI_API_KEY`
- `id: "gemini"` → `GEMINI_API_KEY`
- `id: "nemotron"` → `NEMOTRON_API_KEY`

Use `apiKeyEnv` to override this. This is useful when multiple reviewers share the same API key (e.g., two models routed through OpenRouter):

```json
{
  "id": "nemotron",
  "apiKeyEnv": "OPENROUTER_API_KEY"
}
```

## Provider Types

### Direct Providers

These connect directly to the model provider's API:

| Provider | `provider` value | `baseUrl` | API Key Env |
|----------|-----------------|-----------|-------------|
| OpenAI | `"openai"` | Not needed | `OPENAI_API_KEY` |
| Google Gemini | `"gemini"` | Not needed | `GEMINI_API_KEY` |
| DeepSeek | `"openai-compatible"` | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` |
| Mistral | `"openai-compatible"` | `https://api.mistral.ai/v1` | `MISTRAL_API_KEY` |

### OpenRouter (Aggregator)

OpenRouter provides access to 300+ models through a single API key and endpoint. Many models are available for free.

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKeyEnv": "OPENROUTER_API_KEY"
}
```

**Free tier limits:**
- 50 requests/day without purchased credits
- 1000 requests/day with 10+ purchased credits
- 20 requests/minute per free model

**Free model naming:** Free model IDs end with `:free` (e.g., `nvidia/nemotron-3-super-120b-a12b:free`). The special `openrouter/free` meta-model auto-routes to an available free model.

## Common Workflows

### Replacing a model that ran out of credits

```
# 1. Check what's failing
benchmark_models()

# 2. Find free alternatives
search_models({ freeOnly: true, minContextLength: 32000, maxResults: 10 })

# 3. Test a candidate
test_model({ modelId: "nvidia/nemotron-3-super-120b-a12b:free" })

# 4. Swap it in
swap_model({
  reviewerId: "deepseek",
  newModelId: "nvidia/nemotron-3-super-120b-a12b:free",
  newName: "Nemotron Super 120B",
  baseUrl: "https://openrouter.ai/api/v1"
})
```

### Auto-find the best free replacement

```
find_replacement({ reviewerId: "deepseek", freeOnly: true, maxCandidates: 5 })
```

This will:
1. Search OpenRouter for free models with 32k+ context
2. Test the top 5 candidates in parallel
3. Return results ranked by reliability and speed
4. Recommend the best one

### Adding a new provider slot

Edit `llmapi.config.json` directly to add a new entry to the `reviewers` array:

```json
{
  "id": "qwen",
  "name": "Qwen3 Coder",
  "provider": "openai-compatible",
  "model": "qwen/qwen3-coder:free",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKeyEnv": "OPENROUTER_API_KEY",
  "timeout_ms": 30000,
  "execution_order": 6
}
```

Add the corresponding cost entry:

```json
"costs": {
  "models": {
    "qwen": { "input_per_1m": 0, "output_per_1m": 0 }
  }
}
```

### Switching from free to paid

When you add credits to a provider, swap back to the paid model:

```
swap_model({
  reviewerId: "nemotron",
  newModelId: "deepseek-chat",
  newName: "DeepSeek V3",
  baseUrl: "https://api.deepseek.com/v1"
})
```

Then update `apiKeyEnv` in the config (or remove it to use the default `NEMOTRON_API_KEY` → `DEEPSEEK_API_KEY` lookup).

## Zero-Token Detection

The executor automatically detects and handles "ghost" responses — models that return HTTP 200 but with empty content and 0 output tokens. This commonly happens with:

- Free tier rate limiting (OpenRouter returns 200 with empty body)
- Deprecated models that still accept requests
- Provider outages that return placeholder responses

When detected:
1. The response is retried once (2 second delay)
2. If still empty, it's marked as a **failure** (not a phantom success)
3. The failure is logged with the error `"Empty response from model"`
4. Consensus is built from the remaining successful models only

## Troubleshooting

### Model returns empty responses

1. Run `test_model({ modelId: "..." })` to verify
2. Check if it's a rate limit: free models on OpenRouter have strict limits
3. Try `find_replacement()` to auto-discover alternatives

### "No API key found" error

1. Check env var name: default is `${ID}_API_KEY` (uppercased)
2. Add `apiKeyEnv` to the reviewer config to specify a custom env var
3. For OpenRouter-backed models, set `"apiKeyEnv": "OPENROUTER_API_KEY"`

### Multiple reviewers sharing one API key

Use `apiKeyEnv` on each reviewer to point to the same env var:

```json
{ "id": "nemotron", "apiKeyEnv": "OPENROUTER_API_KEY", ... },
{ "id": "openrouter", "apiKeyEnv": "OPENROUTER_API_KEY", ... }
```

Both will use the `OPENROUTER_API_KEY` value.

### `max_completion_tokens` vs `max_tokens`

The provider automatically uses the correct parameter:
- **Native OpenAI** (`api.openai.com`): `max_completion_tokens`
- **All other providers**: `max_tokens`

This is handled automatically — no configuration needed.
