# Stats Dashboard Generator

Visual insights into review execution, costs, and model performance.

## Overview

The cross-review-mcp system provides rich execution statistics that can be visualized in multiple ways:

1. **Console Output** — Real-time during execution
2. **JSON Export** — Programmatic access  
3. **HTML Dashboard** — Visual exploration
4. **Time Series** — Historical tracking

## Console Stats Example

```
📈 EXECUTION METRICS
  Total Test Cases: 5
  Total Duration: 7650ms
  Avg Duration/Test: 1530ms

💰 TOKEN USAGE & COSTS
  Input Tokens: 2,156
  Output Tokens: 892
  Total Cost: $0.0237
  Cost/Test: $0.00474

⚡ PERFORMANCE BREAKDOWN
  Test 1: Security Analysis    ████████ 1250ms
  Test 2: API Design          █████████ 1540ms
  Test 3: Performance Review   ██████ 950ms
  Test 4: Data Privacy        ███████ 1100ms
  Test 5: Architecture        ████████ 1810ms

🎯 MODEL CONSENSUS
  openai              5 reviews | Avg: 1290ms
  gemini              5 reviews | Avg: 1450ms
```

## HTML Dashboard Template

Create an interactive dashboard by generating HTML from results:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cross-review Stats Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #667eea;
    }

    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .metric-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }

    .metric-card.cost {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }

    .metric-card.time {
      background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
    }

    .metric-card.tokens {
      background: linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%);
    }

    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .metric-label {
      font-size: 12px;
      color: white;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .chart-section {
      margin-bottom: 40px;
    }

    .chart-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .bar-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .bar-label {
      width: 150px;
      font-size: 12px;
      font-weight: 500;
    }

    .bar {
      flex: 1;
      height: 30px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .model-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .model-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .model-name {
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }

    .model-stat {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
      margin: 4px 0;
    }

    .timestamp {
      text-align: right;
      font-size: 12px;
      color: #999;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 cross-review Stats Dashboard v0.5.0</h1>
    <div class="subtitle">Production Execution Metrics & Analytics</div>

    <!-- Summary Metrics -->
    <div class="grid">
      <div class="metric-card">
        <div class="metric-label">Total Reviews</div>
        <div class="metric-value">5</div>
      </div>
      <div class="metric-card time">
        <div class="metric-label">Total Duration</div>
        <div class="metric-value">7.65s</div>
      </div>
      <div class="metric-card cost">
        <div class="metric-label">Total Cost</div>
        <div class="metric-value">$0.024</div>
      </div>
      <div class="metric-card tokens">
        <div class="metric-label">Tokens Used</div>
        <div class="metric-value">3.0K</div>
      </div>
    </div>

    <!-- Performance Chart -->
    <div class="chart-section">
      <div class="chart-title">⚡ Review Duration (ms)</div>
      <div class="bar-chart">
        <div class="bar-item">
          <div class="bar-label">Security Analysis</div>
          <div class="bar" style="width: 82%"><span>1250ms</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">API Design</div>
          <div class="bar" style="width: 100%"><span>1540ms</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Performance Review</div>
          <div class="bar" style="width: 62%"><span>950ms</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Data Privacy</div>
          <div class="bar" style="width: 72%"><span>1100ms</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Architecture</div>
          <div class="bar" style="width: 118%"><span>1810ms</span></div>
        </div>
      </div>
    </div>

    <!-- Cost Breakdown -->
    <div class="chart-section">
      <div class="chart-title">💰 Cost Per Review</div>
      <div class="bar-chart">
        <div class="bar-item">
          <div class="bar-label">Test 1</div>
          <div class="bar" style="width: 35%"><span>$0.0042</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Test 2</div>
          <div class="bar" style="width: 48%"><span>$0.0058</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Test 3</div>
          <div class="bar" style="width: 30%"><span>$0.0036</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Test 4</div>
          <div class="bar" style="width: 40%"><span>$0.0048</span></div>
        </div>
        <div class="bar-item">
          <div class="bar-label">Test 5</div>
          <div class="bar" style="width: 52%"><span>$0.0063</span></div>
        </div>
      </div>
    </div>

    <!-- Model Performance -->
    <div class="chart-section">
      <div class="chart-title">🎯 Model Performance</div>
      <div class="model-stats">
        <div class="model-card">
          <div class="model-name">GPT-5.2 (OpenAI)</div>
          <div class="model-stat">
            <span>Avg Time</span>
            <strong>1290ms</strong>
          </div>
          <div class="model-stat">
            <span>Avg Tokens</span>
            <strong>498</strong>
          </div>
          <div class="model-stat">
            <span>Success Rate</span>
            <strong>100%</strong>
          </div>
          <div class="model-stat">
            <span>Avg Cost</span>
            <strong>$0.0058</strong>
          </div>
        </div>
        <div class="model-card">
          <div class="model-name">Gemini Flash</div>
          <div class="model-stat">
            <span>Avg Time</span>
            <strong>1450ms</strong>
          </div>
          <div class="model-stat">
            <span>Avg Tokens</span>
            <strong>429</strong>
          </div>
          <div class="model-stat">
            <span>Success Rate</span>
            <strong>100%</strong>
          </div>
          <div class="model-stat">
            <span>Avg Cost</span>
            <strong>$0.0001</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="timestamp">Generated: 2026-03-15T12:34:56Z</div>
  </div>
</body>
</html>
```

## Generating Dashboards Programmatically

```typescript
import { ReviewExecutor } from 'cross-review-mcp';

// After reviews complete...
function generateDashboardHTML(results: ReviewResult[]): string {
  const totalCost = results.reduce((s, r) => s + r.totalCost, 0);
  const totalTime = results.reduce((s, r) => s + r.executionTimeMs, 0);

  // Generate bars
  const bars = results.map(r => {
    const pct = (r.executionTimeMs / Math.max(...results.map(x => x.executionTimeMs))) * 100;
    return `
      <div class="bar-item">
        <div class="bar-label">Review ${results.indexOf(r) + 1}</div>
        <div class="bar" style="width: ${pct}%">
          <span>${r.executionTimeMs}ms</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="metric-value">$${totalCost.toFixed(4)}</div>
    <div class="chart-section">
      <div class="bar-chart">${bars}</div>
    </div>
  `;
}
```

## JSON Stats Export

All results are exportable as JSON:

```json
{
  "timestamp": "2026-03-15T12:34:56.789Z",
  "version": "0.5.0",
  "summary": {
    "totalReviews": 5,
    "totalDuration": 7650,
    "totalCost": 0.0247,
    "tokenUsage": {
      "input": 2156,
      "output": 892
    }
  },
  "details": [
    {
      "testName": "Security Analysis",
      "duration": 1250,
      "cost": 0.0042,
      "models": ["openai", "gemini"],
      "tokens": {
        "input": 342,
        "output": 156
      }
    }
  ]
}
```

---

**Save dashboards as HTML files** for sharing with your team or archiving performance data.

See [PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md) for cost-per-provider breakdown.
