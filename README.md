# Cross-Review MCP

**Get a second opinion from competing AIs.**

Your AI assistant has blind spots. Every model does. Cross-review sends your content to multiple LLMs with deliberately critical prompts, then synthesizes where they agree something is wrong.

Issues that multiple models independently flag are far more likely to be real problems. Issues only one model flags get marked as "needs verification." You get structured verdicts instead of hallucinated confidence.

## Install (2 minutes)

You need at least two API keys from different providers. The default setup uses OpenAI and Google:

- [OpenAI](https://platform.openai.com/api-keys) — GPT-5.2
- [Google AI Studio](https://aistudio.google.com/apikey) — Gemini 3 Flash (free tier)

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": ["-y", "cross-review-mcp"],
      "env": {
        "OPENAI_API_KEY": "your-openai-key",
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

Restart Claude Desktop. Done.

### Claude Code

```bash
claude mcp add cross-review -- npx -y cross-review-mcp \
  -e OPENAI_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key
```

### Cursor / Windsurf / Other MCP Clients

Same JSON config as Claude Desktop, adapted to your client's MCP settings location. Cross-review doesn't care which MCP host runs it — Claude, Cursor, Windsurf, or anything else that speaks MCP.

## Try it

Once installed, tell your AI assistant:

> "Use cross_review to check this for flaws: Our platform scales infinitely with zero downtime and no additional cost."

You'll get back something like this:

```
CROSS-LLM PEER REVIEW
════════════════════════════════════════

VERDICT: REVISE

Consensus Issues:
  "scales infinitely" — All models flag this as physically
  impossible. No system scales without bound. (CRITICAL, HIGH confidence)

  "zero downtime" — Consensus overclaim.
  Even 99.999% uptime is not zero. (MAJOR, HIGH confidence)

  "no additional cost" — Scaling always has cost
  implications (compute, storage, bandwidth). (MAJOR, HIGH confidence)

────────────────────────────────────────
Cost: ~$0.04 | 4 models | Standard scrutiny
```

The key insight: when multiple models independently spot the same problem, that consensus is the signal you can trust.

## Add more models

The default setup uses GPT-5.2 + Gemini 3 Flash. You can add more reviewers by setting `CROSS_REVIEW_MODELS` in your env config:

```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": ["-y", "cross-review-mcp"],
      "env": {
        "OPENAI_API_KEY": "your-openai-key",
        "GEMINI_API_KEY": "your-gemini-key",
        "MISTRAL_API_KEY": "your-mistral-key",
        "OPENROUTER_API_KEY": "your-openrouter-key",
        "CROSS_REVIEW_MODELS": "[\"gpt-5.2\",\"gemini-flash\",\"mistral\",\"llama\"]"
      }
    }
  }
}
```

### Available models

| Shorthand | Model | Provider | Cost (per 1M input) | Key needed |
|-----------|-------|----------|---------------------|------------|
| `gpt-5.2` | GPT-5.2 | OpenAI | $1.75 | `OPENAI_API_KEY` |
| `gpt-5.2-instant` | GPT-5.2 Instant | OpenAI | $0.80 | `OPENAI_API_KEY` |
| `gpt-4o` | GPT-4o (legacy) | OpenAI | $2.50 | `OPENAI_API_KEY` |
| `gemini-3.1-pro` | Gemini 3.1 Pro | Google | $1.25 | `GEMINI_API_KEY` |
| `gemini-3-pro` | Gemini 3 Pro | Google | $1.25 | `GEMINI_API_KEY` |
| `gemini-flash` | Gemini 3 Flash | Google | $0.10 | `GEMINI_API_KEY` |
| `gemini-2.5-flash` | Gemini 2.5 Flash | Google | $0.15 | `GEMINI_API_KEY` |
| `deepseek` | DeepSeek V3 | DeepSeek | $0.14 | `DEEPSEEK_API_KEY` |
| `deepseek-r1` | DeepSeek R1 | DeepSeek | $0.55 | `DEEPSEEK_API_KEY` |
| `mistral` | Mistral Large | Mistral | $2.00 | `MISTRAL_API_KEY` |
| `llama` | Llama 3.3 70B | OpenRouter | Free | `OPENROUTER_API_KEY` |
| `qwen` | Qwen3 32B | OpenRouter | Free | `OPENROUTER_API_KEY` |

Free API keys: [Google AI Studio](https://aistudio.google.com/apikey) (Gemini), [DeepSeek](https://platform.deepseek.com) (free credits), [Mistral](https://console.mistral.ai) (experiment tier), [OpenRouter](https://openrouter.ai) (free models, no credit card).

### Custom providers

Any OpenAI-compatible API works. Pass a full config object instead of a shorthand:

```json
"CROSS_REVIEW_MODELS": "[\"gemini-flash\", {\"id\":\"my-model\",\"name\":\"My Model\",\"provider\":\"openai-compatible\",\"model\":\"org/model-name\",\"baseUrl\":\"https://api.example.com/v1\",\"apiKeyEnv\":\"MY_API_KEY\"}]"
```

### Budget-friendly setups

Two free models (no credit card needed):
```
"CROSS_REVIEW_MODELS": "[\"gemini-flash\",\"llama\"]"
```

Three models under $0.02 per review:
```
"CROSS_REVIEW_MODELS": "[\"gemini-flash\",\"deepseek\",\"llama\"]"
```

## What it does (and doesn't do)

**Does:**
- Send your content to multiple LLMs for adversarial review
- Classify issues by severity (Critical / Major / Minor) and confidence (High / Medium / Low)
- Synthesize a consensus verdict: Proceed, Revise, or Abort
- Track token usage and cost per review

**Does not:**
- Access your files, filesystem, or any local resources
- Open network ports (communicates over stdio; outbound HTTPS goes only to the configured LLM APIs)
- Store or log any content you review
- Execute any code from reviewed content
- Send your API keys anywhere except to the respective providers

See [SECURITY.md](SECURITY.md) for the full security posture.

## Options

### Scrutiny levels

| Level | What it does | Use when |
|-------|-------------|----------|
| `quick` | Fast surface scan | Checking drafts |
| `standard` | Balanced review (default) | Most content |
| `adversarial` | Assumes content is flawed | Important documents |
| `redteam` | Actively tries to break arguments | Critical decisions |

### Content types

Tell it what you're reviewing for domain-specific checks:

`general` · `code` · `proposal` · `paper` · `legal` · `medical` · `financial`

### Severity filter

Show only issues above a threshold: `minor` (all), `major`, or `critical`.

### Example with all options

> "Use cross_review on this code with adversarial scrutiny, content_type code, min_severity major"

### Tools

| Tool | What it does |
|------|-------------|
| `cross_review` | Run a review |
| `list_models` | Show active reviewers and available shorthands |
| `list_scrutiny_levels` | Show scrutiny level details |
| `list_content_types` | Show content type descriptions |

## Cost

Each review costs approximately $0.01–0.07 per model depending on content length and scrutiny level. With the default 2-model setup, most reviews are under $0.03. The 4-model test suite (GPT-5.2 + Gemini Flash + Mistral + Llama) averaged $0.06 per review. Cost is shown in every response.

## How it works

1. Your content is sent to all configured models simultaneously with adversarial prompts calibrated per content type
2. Each model independently identifies issues with severity ratings and explicit confidence levels
3. A consensus pass compares the reviews: issues flagged by multiple models are weighted higher than single-model flags
4. An arbitrator synthesizes a final verdict. The arbitrator is the model that made fewer HIGH-confidence claims in its review — biasing the final judgment toward the more cautious reviewer

The adversarial prompts require models to distinguish between what they *know* is wrong (HIGH confidence) and what they *suspect* might be wrong (MEDIUM/LOW). This reduces false positives compared to naive "find problems" prompting.

## FAQ

**Why not just ask one AI to review twice?**
Same model, same blind spots. Different models have different failure modes. When they independently agree something is wrong, that's a much stronger signal than any single opinion.

**Is my content sent to third parties?**
Yes — to whichever LLM APIs you configure. Their standard API data policies apply. Don't submit secrets, credentials, or classified content without reviewing their terms. Note: free models on OpenRouter and DeepSeek may use your prompts for training.

**What if I only have one API key?**
It runs, but you lose cross-model consensus (which is the main value). At least two different providers recommended.

**Can I use it from Gemini / Cursor / other clients?**
Yes. Cross-review is an MCP server — it works with any MCP-compatible client.

## License

MIT — [BoxSight LLC](https://boxsight.ai)

## Contributing

Issues and PRs welcome. If you find a bug, please include the error message and your Node.js version.
