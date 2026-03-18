# cross-review-mcp v0.6.2

**Get expert advice from 5 AI models at the same time.**

Instead of asking ChatGPT OR Gemini, ask **both + 3 others** in parallel. See what they agree on. See where they differ.

```
You:  "Why does my app crash on startup?"
 -> [OpenAI, Gemini, DeepSeek, Mistral, OpenRouter] (all answering at once)
 -> 5 expert perspectives + consensus verdict in ~3 seconds
```

## Documentation

Visual, interactive documentation — no engineering degree required:

- **[Documentation Home](https://keijot.github.io/cross-review-mcp/)** — Landing page with animated architecture diagram
- **[User Guide](https://keijot.github.io/cross-review-mcp/guide.html)** — Install, configure, use — written so anyone can follow
- **[Architecture](https://keijot.github.io/cross-review-mcp/architecture.html)** — System design with SVG diagrams and data flow
- **[Project Status](https://keijot.github.io/cross-review-mcp/status.html)** — Honest visual status of every component

---

## Quick Start

### 1. Install

```bash
npm install -g cross-review-mcp
```

### 2. Create `.env`

```bash
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy-...
DEEPSEEK_API_KEY=sk-...          # optional
MISTRAL_API_KEY=...              # optional
OPENROUTER_API_KEY=sk-or-v1-...  # optional
```

You need at least 2 API keys. More models = better consensus.

### 3. Add to Claude Desktop

```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": ["-y", "cross-review-mcp"]
    }
  }
}
```

Or run from source:
```json
{
  "mcpServers": {
    "cross-review": {
      "command": "node",
      "args": ["/path/to/cross-review-mcp/dist/index.js"]
    }
  }
}
```

Or connect to a remote server (see [Remote Deployment](#remote-deployment)):
```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": ["mcp-remote", "http://your-server:6280/mcp", "--allow-http"]
    }
  }
}
```

---

## Tools

### `review_content`
Submit code or text for cross-LLM peer review.

```
Input:  content + reviewType (security|performance|correctness|style|general)
Output: Per-model reviews + consensus verdict
```

**New in v0.6.2:** Optional `models` parameter for cost control:
- `"fast"` — cheapest 2 models
- `"balanced"` — 3 models
- `"thorough"` — all models (default)
- `["openai", "gemini"]` — specific models by ID

### `get_dev_guidance`
Hit a blocker? Get instant advice from multiple AIs with consensus.

```
Input:  error + technology + environment + attempts
Output: Root cause + immediate fix + per-model perspectives + confidence
```

### `get_cache_stats`
Cache hit rate, entries, evictions.

### `get_cost_summary`
Per-provider spend, daily/monthly totals, budget alerts.

### `benchmark_models`
Per-model performance leaderboard from historical data:
- Avg & P95 latency, error rate, tokens/request
- Cost per request, total spend
- Reliability score (0-100) combining success rate, latency, and output quality
- Models ranked by reliability

---

## What's New in v0.6.2

### Session ID Header Timing Fix
Fixed HTTP StreamableHTTPServerTransport to set session ID headers **before** `handleRequest()` is called. This ensures the client receives `x-mcp-session-id` in the initial response instead of after streaming begins.

**Impact:** Enables proper HTTP MCP client integration (e.g., Claude Code with `"type": "http"`).

### Remote HTTP Transport (Production Ready)
Cross-review MCP can now be deployed as a remote HTTP server with:
- Systemd auto-restart on Linux
- Live dashboard at `/` with SSE event streaming
- MCP endpoint at `/mcp` supporting POST/GET/DELETE
- Health check at `/health`

### Previous v0.6.0 Features

#### Semantic Consensus
The consensus algorithm uses Jaccard similarity to cluster diagnoses that mean the same thing but are worded differently. "Port in use", "port occupied", and "port already taken" all cluster together instead of being counted as separate diagnoses.

#### Per-Request Model Selection
Control cost per request. A quick question doesn't need 5 models:
```json
{ "content": "simple question", "reviewType": "general", "models": "fast" }
```

#### HTTP Authentication
Secure the HTTP endpoint with a bearer token:
```bash
node dist/index.js --mode http --auth-token my-secret
# or
AUTH_TOKEN=my-secret npm run serve
```
All routes require `Authorization: Bearer my-secret`. Dashboard accessible at `/?token=my-secret`. Health endpoint is always open.

#### Health Check
```bash
curl http://localhost:6280/health
```
```json
{
  "status": "ok",
  "uptime": 3600,
  "providers": { "openai": "up", "gemini": "up", "deepseek": "down" },
  "version": "0.6.2"
}
```
Use for Docker `HEALTHCHECK`, load balancers, monitoring.

#### Config-Based Provider Costs
Provider pricing is now in `llmapi.config.json`, not hardcoded. Adding a new provider is zero-code:
```json
{
  "reviewers": [
    {
      "id": "anthropic",
      "provider": "openai-compatible",
      "model": "claude-sonnet-4-6",
      "baseUrl": "https://api.anthropic.com/v1"
    }
  ],
  "costs": {
    "models": {
      "anthropic": { "input_per_1m": 3, "output_per_1m": 15 }
    }
  }
}
```

---

## Server Modes

| Mode | Command | Description |
|------|---------|-------------|
| `stdio` | `npm start` | Default. Local Claude Desktop via stdin/stdout. |
| `http` | `npm run serve` | HTTP server with dashboard + MCP endpoint. |
| `both` | `npm run serve:both` | Both transports simultaneously. |

### CLI Flags

```bash
node dist/index.js --mode http --port 6280 --host 0.0.0.0 --auth-token SECRET
```

| Flag | Default | Description |
|------|---------|-------------|
| `--mode` | `stdio` | `stdio`, `http`, or `both` |
| `--port` | `6280` | HTTP server port |
| `--host` | `0.0.0.0` | Bind address |
| `--auth-token` | none | Bearer token for HTTP auth (or `AUTH_TOKEN` env var) |

---

## Live Dashboard

Run in `http` or `both` mode, then open `http://localhost:6280`.

- Real-time request feed (SSE, no polling)
- Per-model stats (requests, avg time, tokens, error rate)
- Cost tracking (today / month)
- Cache performance

### HTTP Endpoints

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/` | GET | Yes* | Live dashboard |
| `/health` | GET | No | Health check (always open) |
| `/api/stats` | GET | Yes | JSON stats |
| `/api/events` | GET | Yes | SSE stream |
| `/mcp` | POST/GET/DELETE | Yes | MCP StreamableHTTP transport |

*Dashboard also accepts `/?token=SECRET` query param.

---

## Remote Deployment

> **Important:** Claude Code supports `"type": "http"` for direct HTTP MCP servers. For Claude Desktop, use `mcp-remote` to bridge to a remote HTTP server.

### Step 1: Run the server on a remote machine

```bash
# Install and build
git clone https://github.com/KEIJOT/cross-review-mcp.git
cd cross-review-mcp && npm install && npm run build

# Create .env with API keys
cat > .env << 'EOF'
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
EOF

# Run as a systemd service (recommended)
sudo tee /etc/systemd/system/cross-review-mcp.service << 'EOF'
[Unit]
Description=Cross-Review MCP Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cross-review-mcp
EnvironmentFile=/path/to/cross-review-mcp/.env
ExecStart=/usr/bin/node dist/index.js --mode http --port 6280 --host 0.0.0.0
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now cross-review-mcp

# Verify it's running
curl http://localhost:6280/health
```

### Step 2: Connect Claude Code (Direct HTTP)

```json
{
  "mcpServers": {
    "cross-review": {
      "type": "http",
      "url": "http://your-server:6280/mcp"
    }
  }
}
```

### Step 2 (Alternative): Connect Claude Desktop via `mcp-remote`

```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": ["mcp-remote", "http://your-server:6280/mcp", "--allow-http"]
    }
  }
}
```

`mcp-remote` is a lightweight bridge that runs locally, speaks stdio to Claude Desktop, and forwards to your remote HTTP server. The `--allow-http` flag is required for non-HTTPS URLs (LAN use). For production over the internet, use HTTPS instead.

### With authentication

```bash
# On the server, add auth:
# In .env, add: AUTH_TOKEN=my-secret
# Or: node dist/index.js --mode http --auth-token my-secret
```

**For Claude Code:**
```json
{
  "mcpServers": {
    "cross-review": {
      "type": "http",
      "url": "http://your-server:6280/mcp",
      "headers": {
        "Authorization": "Bearer my-secret"
      }
    }
  }
}
```

**For Claude Desktop (via mcp-remote):**
```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://your-server:6280/mcp",
        "--allow-http",
        "--header", "Authorization: Bearer my-secret"
      ]
    }
  }
}
```

### Docker

```bash
docker build -t cross-review-mcp .
docker run -p 6280:6280 \
  -e OPENAI_API_KEY=... \
  -e GEMINI_API_KEY=... \
  -e AUTH_TOKEN=secret \
  cross-review-mcp --mode http
```

### Dashboard

The live dashboard is always available at `http://your-server:6280` when running in HTTP mode — no extra setup needed.

---

## Architecture

```
Client (Claude Desktop / Claude Code / CLI / HTTP)
  -> MCP Server (stdio or StreamableHTTP)
    -> ReviewExecutor (model selection + parallel dispatch)
      -> [OpenAI | Gemini | DeepSeek | Mistral | OpenRouter]
    -> Consensus Algorithm (Jaccard similarity clustering)
    -> Cache (LRU, disk persistence)
    -> Cost Manager (per-model tracking, daily alerts)
    -> EventBus -> Dashboard (SSE)
```

All models execute in parallel. Same latency as asking 1 model, 5x the perspectives.

---

## Configuration

### `llmapi.config.json`

Reviewers, costs, and execution strategy are configured here:

```json
{
  "reviewers": [
    { "id": "openai", "provider": "openai", "model": "gpt-5.2" },
    { "id": "gemini", "provider": "gemini", "model": "gemini-2.0-flash" },
    { "id": "deepseek", "provider": "openai-compatible", "model": "deepseek-chat", "baseUrl": "https://api.deepseek.com/v1" }
  ],
  "costs": {
    "models": {
      "openai": { "input_per_1m": 3, "output_per_1m": 15 },
      "gemini": { "input_per_1m": 0.075, "output_per_1m": 0.3 },
      "deepseek": { "input_per_1m": 1.4, "output_per_1m": 4.2 }
    }
  },
  "execution": { "strategy": "wait_all" }
}
```

API keys are loaded from environment variables: `{REVIEWER_ID}_API_KEY` (e.g., `OPENAI_API_KEY`).

### Provider Types

| Type | SDK | Use For |
|------|-----|---------|
| `openai` | OpenAI SDK | OpenAI models |
| `gemini` | Google Generative AI | Gemini models |
| `openai-compatible` | OpenAI SDK + custom baseUrl | DeepSeek, Mistral, OpenRouter, Groq, Together, etc. |

---

## Testing

```bash
npm run test          # 102 smoke tests (no API keys needed)
npm run test:all      # 136 offline tests (smoke + integration)
npm run test:e2e      # 31 E2E tests (requires API keys in .env)
```

---

## Performance

| Operation | Time | Cost |
|-----------|------|------|
| 5 models (thorough) | 3-5s | $0.01-0.05 |
| 3 models (balanced) | 3-5s | $0.005-0.02 |
| 2 models (fast) | 2-3s | $0.002-0.01 |
| Cached response | <1ms | $0.00 |

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/KEIJOT/cross-review-mcp.git
cd cross-review-mcp
npm install
npm run build
npm run test:all
```

---

## License

MIT

---

**GitHub:** https://github.com/KEIJOT/cross-review-mcp
**npm:** https://www.npmjs.com/package/cross-review-mcp
