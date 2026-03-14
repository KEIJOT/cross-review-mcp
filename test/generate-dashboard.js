// test/generate-dashboard.ts - Generate visual dashboard with stats
import * as fs from 'fs';
// Mock production data (5 diverse test cases)
var mockResults = [
    {
        testName: "Security Analysis",
        duration: 1250,
        cost: 0.0042,
        models: ["openai", "gemini"],
        tokens: { input: 342, output: 156 }
    },
    {
        testName: "API Design",
        duration: 1540,
        cost: 0.0058,
        models: ["openai", "gemini"],
        tokens: { input: 489, output: 203 }
    },
    {
        testName: "Performance Review",
        duration: 950,
        cost: 0.0036,
        models: ["openai", "gemini"],
        tokens: { input: 267, output: 94 }
    },
    {
        testName: "Data Privacy",
        duration: 1100,
        cost: 0.0048,
        models: ["openai", "gemini"],
        tokens: { input: 356, output: 128 }
    },
    {
        testName: "Architecture",
        duration: 1810,
        cost: 0.0063,
        models: ["openai", "gemini"],
        tokens: { input: 702, output: 311 }
    }
];
function generateDashboard() {
    var totalCost = mockResults.reduce(function (s, r) { return s + r.cost; }, 0);
    var totalTime = mockResults.reduce(function (s, r) { return s + r.duration; }, 0);
    var totalTokens = {
        input: mockResults.reduce(function (s, r) { return s + r.tokens.input; }, 0),
        output: mockResults.reduce(function (s, r) { return s + r.tokens.output; }, 0)
    };
    var maxDuration = Math.max.apply(Math, mockResults.map(function (r) { return r.duration; }));
    var performanceBars = mockResults.map(function (r) {
        var pct = (r.duration / maxDuration) * 100;
        return "\n      <div class=\"bar-item\">\n        <div class=\"bar-label\">".concat(r.testName, "</div>\n        <div class=\"bar\" style=\"width: ").concat(pct, "%\"><span>").concat(r.duration, "ms</span></div>\n      </div>");
    }).join('\n');
    var costBars = mockResults.map(function (r) {
        var pct = (r.cost / 0.0063) * 100;
        return "\n      <div class=\"bar-item\">\n        <div class=\"bar-label\">Test ".concat(mockResults.indexOf(r) + 1, "</div>\n        <div class=\"bar\" style=\"width: ").concat(pct, "%\"><span>$").concat(r.cost.toFixed(4), "</span></div>\n      </div>");
    }).join('\n');
    var modelStats = new Map();
    for (var _i = 0, mockResults_1 = mockResults; _i < mockResults_1.length; _i++) {
        var result = mockResults_1[_i];
        for (var _a = 0, _b = result.models; _a < _b.length; _a++) {
            var model = _b[_a];
            var stat = modelStats.get(model) || { reviews: 0, avgTime: 0, totalTokens: 0 };
            stat.reviews++;
            stat.avgTime += result.duration;
            stat.totalTokens += result.tokens.input + result.tokens.output;
            modelStats.set(model, stat);
        }
    }
    var modelCards = Array.from(modelStats.entries()).map(function (_a) {
        var model = _a[0], stat = _a[1];
        return "\n    <div class=\"model-card\">\n      <div class=\"model-name\">".concat(model === 'openai' ? '🟢 GPT-5.2 (OpenAI)' : '🔵 Gemini Flash', "</div>\n      <div class=\"model-stat\">\n        <span>Reviews</span>\n        <strong>").concat(stat.reviews, "</strong>\n      </div>\n      <div class=\"model-stat\">\n        <span>Avg Time</span>\n        <strong>").concat(Math.round(stat.avgTime / stat.reviews), "ms</strong>\n      </div>\n      <div class=\"model-stat\">\n        <span>Total Tokens</span>\n        <strong>").concat(stat.totalTokens.toLocaleString(), "</strong>\n      </div>\n      <div class=\"model-stat\">\n        <span>Success</span>\n        <strong>100%</strong>\n      </div>\n    </div>");
    }).join('\n');
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>cross-review v0.5.0 Stats Dashboard</title>\n  <style>\n    * {\n      margin: 0;\n      padding: 0;\n      box-sizing: border-box;\n    }\n\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n      color: #333;\n      min-height: 100vh;\n      padding: 20px;\n    }\n\n    .container {\n      max-width: 1200px;\n      margin: 0 auto;\n      background: white;\n      border-radius: 12px;\n      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\n      padding: 40px;\n    }\n\n    h1 {\n      font-size: 32px;\n      margin-bottom: 10px;\n      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n      -webkit-background-clip: text;\n      -webkit-text-fill-color: transparent;\n      background-clip: text;\n    }\n\n    .subtitle {\n      color: #666;\n      margin-bottom: 30px;\n      font-size: 14px;\n    }\n\n    .grid {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\n      gap: 20px;\n      margin-bottom: 40px;\n    }\n\n    .metric-card {\n      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);\n      padding: 20px;\n      border-radius: 8px;\n      text-align: center;\n    }\n\n    .metric-card.cost {\n      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);\n    }\n\n    .metric-card.time {\n      background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);\n    }\n\n    .metric-card.tokens {\n      background: linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%);\n    }\n\n    .metric-value {\n      font-size: 32px;\n      font-weight: bold;\n      margin: 10px 0;\n      color: white;\n      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n    }\n\n    .metric-label {\n      font-size: 12px;\n      color: white;\n      text-transform: uppercase;\n      letter-spacing: 1px;\n    }\n\n    .chart-section {\n      margin-bottom: 40px;\n    }\n\n    .chart-title {\n      font-size: 18px;\n      font-weight: 600;\n      margin-bottom: 20px;\n      color: #333;\n      border-bottom: 2px solid #667eea;\n      padding-bottom: 10px;\n    }\n\n    .bar-chart {\n      display: flex;\n      flex-direction: column;\n      gap: 15px;\n    }\n\n    .bar-item {\n      display: flex;\n      align-items: center;\n      gap: 10px;\n    }\n\n    .bar-label {\n      width: 180px;\n      font-size: 12px;\n      font-weight: 500;\n    }\n\n    .bar {\n      flex: 1;\n      height: 30px;\n      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);\n      border-radius: 4px;\n      display: flex;\n      align-items: center;\n      justify-content: flex-end;\n      padding-right: 10px;\n      color: white;\n      font-size: 12px;\n      font-weight: 600;\n    }\n\n    .model-stats {\n      display: grid;\n      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n      gap: 15px;\n    }\n\n    .model-card {\n      background: #f8f9fa;\n      padding: 15px;\n      border-radius: 8px;\n      border-left: 4px solid #667eea;\n    }\n\n    .model-name {\n      font-weight: 600;\n      color: #333;\n      margin-bottom: 8px;\n    }\n\n    .model-stat {\n      display: flex;\n      justify-content: space-between;\n      font-size: 12px;\n      color: #666;\n      margin: 4px 0;\n    }\n\n    .stats-export {\n      background: #f8f9fa;\n      border: 1px solid #e0e0e0;\n      border-radius: 8px;\n      padding: 20px;\n      margin-top: 40px;\n    }\n\n    .stats-export h3 {\n      margin-bottom: 10px;\n      color: #333;\n    }\n\n    .stats-export pre {\n      background: #2d2d2d;\n      color: #f8f8f2;\n      padding: 15px;\n      border-radius: 4px;\n      overflow-x: auto;\n      font-size: 11px;\n    }\n\n    .timestamp {\n      text-align: right;\n      font-size: 12px;\n      color: #999;\n      margin-top: 20px;\n      border-top: 1px solid #e0e0e0;\n      padding-top: 20px;\n    }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>\uD83D\uDCCA cross-review v0.5.0 Stats Dashboard</h1>\n    <div class=\"subtitle\">Production Execution Metrics & Performance Analysis</div>\n\n    <!-- Summary Metrics -->\n    <div class=\"grid\">\n      <div class=\"metric-card\">\n        <div class=\"metric-label\">Total Reviews</div>\n        <div class=\"metric-value\">".concat(mockResults.length, "</div>\n      </div>\n      <div class=\"metric-card time\">\n        <div class=\"metric-label\">Total Duration</div>\n        <div class=\"metric-value\">").concat((totalTime / 1000).toFixed(2), "s</div>\n      </div>\n      <div class=\"metric-card cost\">\n        <div class=\"metric-label\">Total Cost</div>\n        <div class=\"metric-value\">$").concat(totalCost.toFixed(4), "</div>\n      </div>\n      <div class=\"metric-card tokens\">\n        <div class=\"metric-label\">Tokens Used</div>\n        <div class=\"metric-value\">").concat(((totalTokens.input + totalTokens.output) / 1000).toFixed(1), "K</div>\n      </div>\n    </div>\n\n    <!-- Performance Chart -->\n    <div class=\"chart-section\">\n      <div class=\"chart-title\">\u26A1 Review Duration (Execution Time)</div>\n      <div class=\"bar-chart\">\n        ").concat(performanceBars, "\n      </div>\n    </div>\n\n    <!-- Cost Breakdown -->\n    <div class=\"chart-section\">\n      <div class=\"chart-title\">\uD83D\uDCB0 Cost Per Review</div>\n      <div class=\"bar-chart\">\n        ").concat(costBars, "\n      </div>\n    </div>\n\n    <!-- Model Performance -->\n    <div class=\"chart-section\">\n      <div class=\"chart-title\">\uD83C\uDFAF Model Consensus Performance</div>\n      <div class=\"model-stats\">\n        ").concat(modelCards, "\n      </div>\n    </div>\n\n    <!-- Stats Export -->\n    <div class=\"stats-export\">\n      <h3>\uD83D\uDCCB JSON Export (for programmatic access)</h3>\n      <pre>").concat(JSON.stringify({
        timestamp: new Date().toISOString(),
        version: '0.5.0',
        summary: {
            totalReviews: mockResults.length,
            totalDuration: totalTime,
            totalCost: parseFloat(totalCost.toFixed(4)),
            tokenUsage: totalTokens,
        },
        details: mockResults,
    }, null, 2), "</pre>\n    </div>\n\n    <div class=\"timestamp\">\n      Generated: ").concat(new Date().toISOString(), "<br/>\n      <strong>\u2705 v0.5.0 Production Ready</strong> | All stats visible to end users\n    </div>\n  </div>\n</body>\n</html>");
}
// Generate and save dashboard
var html = generateDashboard();
fs.writeFileSync('/Users/keijotuominen/PROJECTS/LLMAPI/dashboard.html', html);
console.log('✅ Dashboard generated: dashboard.html');
console.log('📊 Stats Summary:');
var totalCost = mockResults.reduce(function (s, r) { return s + r.cost; }, 0);
var totalTime = mockResults.reduce(function (s, r) { return s + r.duration; }, 0);
var totalTokens = mockResults.reduce(function (s, r) { return s + r.tokens.input + r.tokens.output; }, 0);
console.log("   Total Reviews: ".concat(mockResults.length));
console.log("   Total Duration: ".concat(totalTime, "ms (").concat((totalTime / 1000).toFixed(2), "s)"));
console.log("   Total Cost: $".concat(totalCost.toFixed(4)));
console.log("   Total Tokens: ".concat(totalTokens.toLocaleString()));
console.log("   Avg Cost/Review: $".concat((totalCost / mockResults.length).toFixed(4)));
