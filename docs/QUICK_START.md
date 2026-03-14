# Quick Start — cross-review-mcp v0.5.0

5-minute setup guide to run multi-provider consensus reviews.

## Installation

```bash
npm install cross-review-mcp
# or use with npx directly (see Desktop Setup below)
```

## Configuration

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

## Set API Keys (Environment Variables)

```bash
export OPENAI_API_KEY="your-key-here"
export GEMINI_API_KEY="your-key-here"
```

**IMPORTANT:** Never hardcode keys in config files. Use environment variables only.

## Basic Usage

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

## Understanding the Output (ReviewResult)

The `ReviewResult` object returned includes **comprehensive statistics**:

```typescript
interface ReviewResult {
  // Individual model responses
  reviews: {
    [modelId: string]: {
      modelId: string;
      content: string;
      inputTokens: number;      // ← Tokens SENT to model
      outputTokens: number;     // ← Tokens RETURNED by model
      finishReason: 'stop' | 'length' | 'error' | 'timeout';
      error?: string;
      executionTimeMs: number;  // ← How long the request took
    }
  };

  // Consensus details
  consensus: {
    agreements: string[];
    disagreements: Record<string, any>;
  };

  // Aggregate timing
  executionTimeMs: number;      // ← Total review duration

  // Financial tracking
  totalCost: number;            // ← USD cost of this review
}
```

## Example: Stats Output

```json
{
  "reviews": {
    "openai": {
      "modelId": "openai",
      "content": "Security issue: SQL injection...",
      "inputTokens": 342,
      "outputTokens": 156,
      "finishReason": "stop",
      "executionTimeMs": 1250
    },
    "gemini": {
      "modelId": "gemini",
      "content": "The code has input validation issues...",
      "inputTokens": 289,
      "outputTokens": 184,
      "finishReason": "stop",
      "executionTimeMs": 1540
    }
  },
  "consensus": {
    "agreements": [
      "SQL injection vulnerability present",
      "No input sanitization"
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

## Accessing Stats in Code

```typescript
const result = await executor.execute(request);

// Per-model breakdown
for (const [modelId, response] of Object.entries(result.reviews)) {
  console.log(`${modelId}:`);
  console.log(`  Tokens IN:  ${response.inputTokens}`);
  console.log(`  Tokens OUT: ${response.outputTokens}`);
  console.log(`  Time: ${response.executionTimeMs}ms`);
}

// Totals
console.log(`Total Cost: $${result.totalCost.toFixed(4)}`);
console.log(`Total Duration: ${result.executionTimeMs}ms`);
```

## Token Usage Estimates

### Cost Calculation
Costs are calculated based on your configured price per 1M tokens:

```
Input Cost = (inputTokens / 1,000,000) × input_price_per_1m
Output Cost = (outputTokens / 1,000,000) × output_price_per_1m
Total = Sum across all models
```

### Default Pricing (from config)
- **OpenAI GPT-5.2**: $3/1M input, $15/1M output
- **Gemini Flash**: $0.075/1M input, $0.3/1M output

### Typical Review Costs
- **Security Review**: 300–500 input tokens, 100–200 output tokens = ~$0.006–0.015
- **Architecture Review**: 500–800 input tokens, 200–400 output tokens = ~$0.012–0.040
- **Code Review**: 200–400 input tokens, 50–150 output tokens = ~$0.003–0.010

## Execution Strategies

### `wait_all` (default)
Waits for all models to respond. Slowest but captures full consensus.

```json
{
  "execution": {
    "strategy": "wait_all"
  }
}
```

### `fastest_2`
Completes as soon as 2 models finish. Faster, partial consensus.

```json
{
  "execution": {
    "strategy": "fastest_2"
  }
}
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

## Monitoring & Logging

All reviews are logged to `.llmapi_usage.json` (JSON Lines format):

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

## Claude Desktop Integration

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

## Troubleshooting

### "OPENAI_API_KEY is undefined"
```bash
# Make sure environment var is set
echo $OPENAI_API_KEY

# If empty, add to ~/.zshrc or ~/.bash_profile
export OPENAI_API_KEY="sk-..."
source ~/.zshrc
```

### "Config file not found"
```bash
# Create llmapi.config.json in your working directory
# Or load from a specific path:
loadConfig('/Users/you/myconfig.json')
```

### High token counts
Check your input content—longer inputs consume more tokens.
Consider breaking large reviews into smaller requests.

---

**Questions?** See [ARCHITECTURE.md](ARCHITECTURE.md) for system design and [FAQ.md](FAQ.md) for common issues.
