# Quick Start — cross-review-mcp v0.5.0

5-minute setup guide to run multi-provider consensus reviews.

## 🎯 Visual Overview

```
┌─────────────────────────────────────────────────────────┐
│         YOUR CODE OR DOCUMENT                           │
│         "Review this code..."                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   CROSS-REVIEW-MCP v0.5.0   │
        └────────┬───────────┬────────┘
                 │           │
        ┌────────▼──┐   ┌────▼───────┐
        │ OpenAI    │   │   Gemini    │
        │ GPT-5.2   │   │   Flash     │
        └────────┬──┘   └────┬───────┘
                 │           │
                 └─────┬─────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │   CONSENSUS RESULT          │
        │   • Cost: $0.0049           │
        │   • Time: 1,250ms           │
        │   • Tokens: 298             │
        └─────────────────────────────┘
```

---

## Installation

```bash
npm install cross-review-mcp
```

## 📊 Configuration

Create `llmapi.config.json` in your project root:

```json
{
  "reviewers": [
    {
      "id": "openai",
      "name": "GPT-5.2",
      "provider": "openai",
      "model": "gpt-5.2",
      "timeout_ms": 30000,
      "execution_order": 1
    },
    {
      "id": "gemini",
      "name": "Gemini Flash",
      "provider": "gemini",
      "model": "gemini-2.0-flash",
      "timeout_ms": 30000,
      "execution_order": 2
    }
  ],
  "execution": {
    "strategy": "wait_all",
    "allow_partial_results": true
  },
  "costs": {
    "models": {
      "openai": {
        "input_per_1m": 3,
        "output_per_1m": 15
      },
      "gemini": {
        "input_per_1m": 0.075,
        "output_per_1m": 0.3
      }
    }
  },
  "tracking": {
    "enabled": true,
    "log_file": ".llmapi_usage.json"
  }
}
```

## 🔑 Set API Keys (Environment Variables)

```bash
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
```

**IMPORTANT:** Never hardcode keys in config files. Use environment variables only.

---

## 💻 Basic Usage

```typescript
import { ReviewExecutor } from 'cross-review-mcp';
import { loadConfig } from 'cross-review-mcp';
import { TokenTracker } from 'cross-review-mcp';

const config = loadConfig();
const tracker = new TokenTracker();
const executor = new ReviewExecutor(config, tracker);

const result = await executor.execute({
  content: 'Review this code for security issues...',
  contentHash: 'abc123def456',
  strategy: 'wait_all',
});

console.log(result);
```

---

## 📈 Understanding the Output (ReviewResult)

The `ReviewResult` object contains **all your statistics**:

### Structure

```typescript
{
  // Individual model responses
  reviews: {
    "openai": {
      modelId: "openai",
      content: "Review text...",
      inputTokens: 342,          // ← VISIBLE
      outputTokens: 156,         // ← VISIBLE
      executionTimeMs: 1250,     // ← VISIBLE
      finishReason: "stop"
    },
    "gemini": { /* ... */ }
  },

  // Consensus & agreements
  consensus: {
    agreements: ["Vulnerability found"],
    disagreements: { "severity": { "openai": "critical", "gemini": "high" } }
  },
  
  // TOTAL METRICS
  executionTimeMs: 1542,         // ← TOTAL TIME
  totalCost: 0.0058             // ← TOTAL COST
}
```

### Real Example Output

```json
{
  "reviews": {
    "openai": {
      "modelId": "openai",
      "content": "Your code has SQL injection vulnerability...",
      "inputTokens": 342,
      "outputTokens": 156,
      "executionTimeMs": 1250,
      "finishReason": "stop"
    },
    "gemini": {
      "modelId": "gemini",
      "content": "The code lacks input validation...",
      "inputTokens": 289,
      "outputTokens": 184,
      "executionTimeMs": 1540,
      "finishReason": "stop"
    }
  },
  "consensus": {
    "agreements": [
      "SQL injection risk",
      "Missing input validation"
    ],
    "disagreements": {
      "severity": {
        "openai": "critical",
        "gemini": "high"
      }
    }
  },
  "executionTimeMs": 1542,
  "totalCost": 0.0058
}
```

### Accessing Stats in Code

```typescript
const result = await executor.execute(request);

// Per-model breakdown
for (const [modelId, response] of Object.entries(result.reviews)) {
  console.log(`${modelId}:`);
  console.log(`  Input Tokens:  ${response.inputTokens}`);
  console.log(`  Output Tokens: ${response.outputTokens}`);
  console.log(`  Duration:      ${response.executionTimeMs}ms`);
}

// Total metrics
console.log(`Total Cost: $${result.totalCost.toFixed(4)}`);
console.log(`Total Time: ${result.executionTimeMs}ms`);
```

---

## 💰 Token Pricing Explained

### Cost Calculation Formula

```
Input Cost  = (inputTokens / 1,000,000) × input_price_per_1m
Output Cost = (outputTokens / 1,000,000) × output_price_per_1m
Total Cost  = Sum across all models
```

### Example

```
OpenAI (GPT-5.2):
  Input:  342 tokens × ($3 / 1M) = $0.001026
  Output: 156 tokens × ($15 / 1M) = $0.00234
  Subtotal: $0.003366

Gemini (Flash):
  Input:  289 tokens × ($0.075 / 1M) = $0.000022
  Output: 184 tokens × ($0.3 / 1M) = $0.000055
  Subtotal: $0.000077

TOTAL COST: $0.0034 for one review
```

### Typical Review Costs

```
Security Review (code, small):
  Tokens: 300 input + 150 output
  Cost: ~$0.0045

API Design Review (endpoint analysis):
  Tokens: 500 input + 200 output
  Cost: ~$0.0065

Architecture Review (system design):
  Tokens: 700 input + 300 output
  Cost: ~$0.0095
```

---

## 🎯 Execution Strategies

### `wait_all` (Default)
Waits for all models to respond. Slowest but captures full consensus.

```json
{
  "execution": {
    "strategy": "wait_all"
  }
}
```

**Timeline**: 
```
Model 1: ████████████████████ 1,250ms
Model 2: ████████████████████████ 1,540ms
TOTAL:                          1,540ms ✓ (both complete)
```

### `fastest_2`
Returns as soon as 2 models finish. Faster, partial consensus.

```json
{
  "execution": {
    "strategy": "fastest_2"
  }
}
```

**Timeline**:
```
Model 1: ████████████████████ 1,250ms ✓ (complete)
Model 2: ████████████████████████ 1,540ms
TOTAL:                          1,250ms (return early)
```

### `wait_max_30s`
Returns whatever responses arrived within 30 seconds.

```json
{
  "execution": {
    "strategy": "wait_max_30s"
  }
}
```

---

## 📊 View Interactive Stats Dashboard

See real metrics from 5 production test cases:

**→ [**Open Interactive Dashboard**](../cross-review-v0.5.0-stats.html)**

Features:
- Metric cards (reviews, duration, cost, tokens)
- Performance charts
- Cost breakdown visualization
- Model comparison cards
- JSON export

**Download and open in your browser** (no internet needed!)

---

## 📝 Monitoring & Logging

All reviews logged to `.llmapi_usage.json` (JSON Lines format):

```bash
cat .llmapi_usage.json | jq
```

Each line is a review event:
```json
{
  "timestamp": "2026-03-15T12:34:56.789Z",
  "content_hash": "abc123",
  "execution_strategy": "wait_all",
  "total_cost_usd": 0.0058,
  "models": ["openai", "gemini"]
}
```

---

## 🖥️ Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cross-review": {
      "command": "npx",
      "args": ["-y", "cross-review-mcp"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

Then restart Claude Desktop.

---

## ❓ Troubleshooting

### "OPENAI_API_KEY is undefined"
```bash
# Verify env var is set
echo $OPENAI_API_KEY

# If empty, add to ~/.zshrc
export OPENAI_API_KEY="sk-..."
source ~/.zshrc
```

### "Config file not found"
```bash
# Create llmapi.config.json in current directory
# Or load from specific path:
loadConfig('/Users/you/myconfig.json')
```

### High token counts
Longer inputs = more tokens. Consider breaking large reviews into smaller requests.

### Slow response times
Normal: 950ms–1,810ms per review (median 1,250ms). Network latency dominates.

---

## 📚 Next Steps

- **See real stats**: [Open Dashboard](../cross-review-v0.5.0-stats.html)
- **Understand metrics**: Read [STATS_DASHBOARD.md](STATS_DASHBOARD.md)
- **Production checklist**: Review [VALIDATION_REPORT.md](../VALIDATION_REPORT.md)
- **v0.6.0 features**: Check [v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)

---

**Last Updated**: 2026-03-15  
**Status**: ✅ Production Ready
