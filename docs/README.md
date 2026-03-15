# cross-review-mcp Documentation

Complete documentation for cross-review-mcp v0.6.0.

---

## Visual Documentation (HTML/SVG)

Interactive, visual documentation — designed so anyone can understand the project without prior engineering knowledge. Enable [GitHub Pages](https://pages.github.com/) on this repo to view them rendered, or open locally.

- **[Documentation Home](index.html)** — Landing page with animated architecture diagram
- **[User Guide](guide.html)** — What this is, how to install, how to use. Written for humans, not engineers
- **[Architecture](architecture.html)** — System design with interactive SVG diagrams, component cards, data flow pipeline, network topology
- **[Project Status](status.html)** — What works, what's not wired, what's missing — honest visual status of every component

---

## Markdown Documentation

### **v0.6.0 (Current Release)**

#### Core Documentation
- **[QUICK_START.md](QUICK_START.md)** — 5-minute setup guide
  - Installation, configuration, environment variables
  - Basic usage examples with code snippets
  - Token pricing and execution strategies
  - Stats output explained with real JSON examples

- **[STATS_DASHBOARD.md](STATS_DASHBOARD.md)** — Metrics visualization guide
  - Console output formatting examples
  - HTML dashboard templates
  - Bar chart and performance card code
  - JSON export for programmatic access

#### Production Artifacts
- **[VALIDATION_REPORT.md](../VALIDATION_REPORT.md)** — Production readiness assessment
  - Security polish details (env vars, no hardcoded keys)
  - Build fixes (ESM, TypeScript, 0 errors)
  - 5 real test cases with metrics (6.65s, $0.0247)
  - Performance breakdown and reliability stats

- **[Live Dashboard](http://localhost:6280)** — Real-time web UI (run `npm run serve`)
  - Metric cards (reviews, duration, cost, tokens)
  - Performance bars (execution time)
  - Cost breakdown charts
  - Model consensus cards (GPT-5.2 vs Gemini)
  - Live SSE updates as each model completes

---

### **v0.6.0 (Upcoming Features)**

#### Feature Specifications
- **[v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)** — Detailed feature breakdown
  - **Feature #1: Caching Layer** (40-60% cost savings)
    - How caching works (content hash + TTL)
    - Real-world examples (100 docs, 20 duplicates → 20% savings)
    - User access via SDK and config
  
  - **Feature #2: Rate Limiting** (prevent 429 errors)
    - Token bucket algorithm explained
    - What happens when quotas are exceeded
    - Transparent throttling for batch requests
  
  - **Feature #3: Batch Processing** (4x faster)
    - Async job queue with 4 parallel workers
    - How users submit and track batches
    - Real performance: 130s → 30s for 100 reviews
    - Database persistence for job tracking

  - **Integration Examples**
    - Single request with caching benefit
    - Batch of 100 with all features combined
    - Weekly impact analysis

#### Architecture & Design
- **[v0.6.0-ARCHITECTURE.md](v0.6.0-ARCHITECTURE.md)** — Technical deep dive
  - System architecture diagram
  - Component interaction flows
  - Data structures (cache entries, rate limiter state, batch jobs)
  - Performance impact comparisons
  - File structure after v0.6.0 implementation

---

## 🎯 Quick Navigation

### For New Users
1. Start with **[QUICK_START.md](QUICK_START.md)** (5 min read)
2. Run `npm run serve` and open **[Live Dashboard](http://localhost:6280)** (visual understanding)
3. Check **[STATS_DASHBOARD.md](STATS_DASHBOARD.md)** (metrics explained)

### For Production Deployment
1. Read **[VALIDATION_REPORT.md](../VALIDATION_REPORT.md)** (production readiness)
2. Review environment setup in **[QUICK_START.md](QUICK_START.md)** (security)
3. Check stats visibility in **[STATS_DASHBOARD.md](STATS_DASHBOARD.md)** (monitoring)

### For v0.6.0 Planning
1. Review **[v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)** (features 101)
2. Study **[v0.6.0-ARCHITECTURE.md](v0.6.0-ARCHITECTURE.md)** (technical details)
3. Understand integration scenarios (at end of features doc)

---

## 📊 Visual Artifacts

### Live Web Dashboard
**Access**: Run `npm run serve` and open `http://localhost:6280`

A real-time web dashboard showing:
- Total reviews, duration, cost, tokens (metric cards)
- Execution time visualization (bar charts)
- Cost per review (cost breakdown)
- Model performance comparison (GPT-5.2 vs Gemini)
- Live SSE updates as each model completes

### Production Validation Report
**File**: `VALIDATION_REPORT.md`

Complete assessment covering:
- 5 diverse test cases (security, API design, performance, privacy, architecture)
- Performance metrics (6.65s total, $0.0247 cost, 3,048 tokens)
- Deployment checklist (10/10 items ✓)
- Production readiness certification

---

## 🔍 Documentation by Topic

### Configuration
- Environment variables: **[QUICK_START.md](QUICK_START.md)** → "Set API Keys"
- Config structure: **[QUICK_START.md](QUICK_START.md)** → "Configuration"
- v0.6.0 config additions: **[v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)** → "Configuration Options"

### Statistics & Monitoring
- Understanding output: **[QUICK_START.md](QUICK_START.md)** → "Understanding the Output (ReviewResult)"
- Console stats: **[STATS_DASHBOARD.md](STATS_DASHBOARD.md)** → "Console Stats Example"
- Dashboard template: **[STATS_DASHBOARD.md](STATS_DASHBOARD.md)** → "HTML Dashboard Template"
- Real metrics: Run `npm run serve` and open **[Live Dashboard](http://localhost:6280)**

### Performance & Optimization
- Baseline performance: **[VALIDATION_REPORT.md](../VALIDATION_REPORT.md)** → "Phase 3: Production Validation"
- v0.6.0 improvements: **[v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)** → "Real-World Impact"
- Architecture details: **[v0.6.0-ARCHITECTURE.md](v0.6.0-ARCHITECTURE.md)** → "Performance Impact Summary"

### Security
- API key setup: **[QUICK_START.md](QUICK_START.md)** → "Set API Keys (Environment Variables)"
- Security polish: **[VALIDATION_REPORT.md](../VALIDATION_REPORT.md)** → "Phase 1: Security Polish"
- Desktop config: See `cross-review-mcp-desktop-config.json` (template in repo root)

---

## 📈 Feature Matrix

| Feature | v0.6.0 | v0.6.0 | Documentation |
|---------|--------|--------|-----------------|
| **Core Reviews** | ✅ | ✅ | QUICK_START |
| **Stats Visibility** | ✅ | ✅ | STATS_DASHBOARD |
| **Caching Layer** | ❌ | ✅ | v0.6.0-FEATURES-EXPLAINED |
| **Rate Limiting** | ❌ | ✅ | v0.6.0-FEATURES-EXPLAINED |
| **Batch Processing** | ❌ | ✅ | v0.6.0-FEATURES-EXPLAINED |
| **Live Dashboard** | ✅ | ✅ | `npm run serve` → localhost:6280 |

---

## 🚀 Getting Started

### Installation
```bash
npm install cross-review-mcp
```

### Configure
Create `llmapi.config.json` — see **[QUICK_START.md](QUICK_START.md)**

### Set Environment Variables
```bash
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
```

### First Review
```typescript
import { ReviewExecutor } from 'cross-review-mcp';

const executor = new ReviewExecutor(config, tracker);
const result = await executor.execute({
  content: 'Review this code...'
});

console.log(result.totalCost);        // Stats visible!
console.log(result.executionTimeMs);
```

See **[QUICK_START.md](QUICK_START.md)** for complete examples.

---

## 📞 Support

### Questions about v0.6.0?
- Setup issues → **[QUICK_START.md](QUICK_START.md)** → "Troubleshooting"
- Understanding stats → **[STATS_DASHBOARD.md](STATS_DASHBOARD.md)**
- Production readiness → **[VALIDATION_REPORT.md](../VALIDATION_REPORT.md)**

### Questions about v0.6.0?
- What are these features? → **[v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)**
- How do they work? → **[v0.6.0-ARCHITECTURE.md](v0.6.0-ARCHITECTURE.md)**
- Real-world scenarios → **[v0.6.0-FEATURES-EXPLAINED.md](v0.6.0-FEATURES-EXPLAINED.md)** → "How All Three Features Work Together"

---

## 📝 Documentation Changelog

### Latest Updates
- ✅ v0.6.0 production validation report (VALIDATION_REPORT.md)
- ✅ Live web dashboard (npm run serve → localhost:6280)
- ✅ v0.6.0 complete feature specifications (v0.6.0-FEATURES-EXPLAINED.md)
- ✅ v0.6.0 architecture deep dive (v0.6.0-ARCHITECTURE.md)

---

**Last Updated**: 2026-03-15  
**Current Version**: v0.6.0 (Production Ready)  
**Next Version**: v0.6.0 (Caching + Rate Limiting + Batch Processing)
