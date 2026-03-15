# cross-review-mcp v0.5.2

**Get expert advice from 5 AI models at the same time.**

Instead of asking ChatGPT OR Gemini, ask **both + 3 others** in parallel. See what they agree on. See where they differ.

```
┌─────────────────────────────────────────────────────────────┐
│  You:  "Why does my app crash on startup?"                 │
│  System: [Asking OpenAI, Gemini, DeepSeek, Mistral, ...]   │
│  Result: 5 expert perspectives + consensus verdict          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Documentation

Read these first:

- **[User Guide](./docs/USER_GUIDE.md)** — How to install and use (simple!)
- **[Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.md)** — How it works inside
- **[Production Checklist](./docs/PRODUCTION_CHECKLIST.md)** — What's tested, what works

---

## 🚀 Quick Start (3 Minutes)

### 1. Install
```bash
npm install -g cross-review-mcp
```

### 2. Get API Keys
Visit these sites and get free/paid API keys:
- [OpenAI](https://openai.com) 
- [Gemini](https://makersuite.google.com)
- [DeepSeek](https://deepseek.com)
- [Mistral](https://mistral.ai)
- [OpenRouter](https://openrouter.io)

### 3. Create `.env`
```bash
# In your project folder, create .env:
OPENAI_API_KEY=sk-proj-your-key
GEMINI_API_KEY=AIzaSy-your-key
DEEPSEEK_API_KEY=sk-8229-your-key
MISTRAL_API_KEY=IfhAy-your-key
OPENROUTER_API_KEY=sk-or-v1-your-key
```

### 4. Use It
```bash
# From the CLI:
cross-review dev --error "PORT IS IN USE at 6277" \
                 --tech "MCP Inspector" \
                 --env "macOS" \
                 --tried "Killed processes, waited"

# Or in Claude.ai: Connect via MCP, ask naturally
```

---

## 📊 Real Example: The PORT IS IN USE Problem

**Problem:** You get `PORT IS IN USE at 6277` and you're stuck.

**Old Way:**
1. Ask ChatGPT → "kill the process" (not specific)
2. Ask Gemini → "use lsof" (better!)
3. Context-switch 3 times
4. Time wasted: 5 minutes

**New Way (cross-review-mcp):**
1. Ask once
2. Get 5 perspectives instantly
3. Time: 10 seconds

### What You Get:

```json
{
  "root_cause": "Another process, potentially MCP Inspector itself 
                 from a previous session, is still bound to port 6277.",
  
  "immediate_fix": "Use `lsof -i :6277` to identify the process 
                    using the port and then kill it using `kill -9 <PID>`.",
  
  "consensus_confidence": 0.95,
  
  "per_model_analysis": [
    {
      "model": "Gemini",
      "confidence": 0.95,
      "perspective": "Another process is still bound to port 6277.",
      "suggestion": "Use `lsof -i :6277` then `kill -9 <PID>`."
    },
    {
      "model": "OpenAI",
      "confidence": 0.86,
      "perspective": "A running process is still bound to TCP port 6277 on macOS.",
      "suggestion": "Find and kill the exact process: `lsof -nP -iTCP:6277 -sTCP:LISTEN` 
                     then `kill -9 <PID>`."
    },
    {
      "model": "DeepSeek",
      "confidence": 0.78,
      "perspective": "System resource conflict — port still in use.",
      "suggestion": "Check what's running, kill it, restart."
    },
    {
      "model": "Mistral",
      "confidence": 0.82,
      "perspective": "Leftover process from earlier session still using the port.",
      "suggestion": "Kill the old process, then restart the Inspector."
    },
    {
      "model": "OpenRouter",
      "confidence": 0.81,
      "perspective": "Port still in use by another process.",
      "suggestion": "Free the port using `lsof` and `kill`, then try again."
    }
  ],
  
  "timestamp": "2026-03-15T03:30:39.087Z"
}
```

**What you see:**
- ✅ All 5 models agree on root cause
- ✅ Confidence: 95% (very sure)
- ✅ Immediate fix: Clear command to run
- ✅ Per-model breakdown: See how each AI thinks about it

---

## 🛠️ Tools Included

### 1. `get_dev_guidance`
Hit a blocker? Get instant advice from 5 AIs.

```
Input: Error message + what you've tried + your environment
Output: Root cause + immediate fix + 5 perspectives + confidence
Time: ~3-5 seconds
```

### 2. `review_content`
Submit code or any content for peer review.

```
Input: Code/content + review type (security/performance/style/correctness/general)
Output: 5 model reviews + consensus verdict
```

### 3. `get_cache_stats`
See cache performance metrics.

```
Output: Hit rate, cache size, evictions, TTL status
```

### 4. `get_cost_summary`
Track API spending.

```
Output: Cost per provider, total spend, daily budget status
```

---

## 🏗️ Architecture

```
You (Claude.ai)
    ↓
MCP Server (registers 4 tools)
    ↓
Tool Handler (e.g., get_dev_guidance)
    ↓
ReviewExecutor (sends to 5 AIs in parallel)
    ↓
[OpenAI | Gemini | DeepSeek | Mistral | OpenRouter] (all answering at once)
    ↓
Response Parser (handles all 5 response formats)
    ↓
Consensus Algorithm (what do they agree on?)
    ↓
Result back to you (root cause + perspectives + confidence)
```

**Key insight:** All 5 models answer IN PARALLEL, not sequentially. Same speed as asking 1 AI, 5× the brains.

---

## 💾 Installation Options

### Option 1: NPM Global
```bash
npm install -g cross-review-mcp
cross-review dev --error "your error"
```

### Option 2: Clone & Run
```bash
git clone https://github.com/KEIJOT/cross-review-mcp.git
cd cross-review-mcp
npm install
npm run build
npm start
```

### Option 3: Docker
```bash
docker run \
  -e OPENAI_API_KEY=sk-... \
  -e GEMINI_API_KEY=AIza... \
  cross-review-mcp
```

### Option 4: Claude.ai (MCP Integration)
1. Install via MCP protocol
2. Use naturally in conversations
3. No CLI needed

---

## ⚙️ Configuration

Create `.env` file with your API keys:

```bash
# Required keys (use at least these 5):
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy-...
DEEPSEEK_API_KEY=sk-8229-...
MISTRAL_API_KEY=IfhAy-...
OPENROUTER_API_KEY=sk-or-v1-...
```

**Optional:** Don't have all 5? That's fine. Use what you have.

**Security:** 
- Add `.env` to `.gitignore` (never commit secrets)
- Use environment variables in production
- Never share your `.env` file

---

## 📈 Performance

| Operation | Time | Cost |
|-----------|------|------|
| Single AI | 3-5s | $0.01-0.05 |
| 5 AIs (cross-review) | 3-5s | $0.05-0.25 |
| Cached response | <0.1s | $0.00 |

**Why it's fast:** All 5 models answer at the same time (parallel), not one after another.

---

## 🐛 Troubleshooting

**"Error: Missing API key"**
→ Create `.env` file with all your API keys. See Configuration above.

**"No model responses"**
→ Check your API keys are correct. Verify network connection. Run `npm run build` to recompile.

**"The answer isn't helpful"**
→ Add more context. Instead of "code is slow", say: "My JavaScript function takes 5 seconds on a list of 100 items, expected <1s"

See [USER_GUIDE.md](./docs/USER_GUIDE.md) for more help.

---

## 🧠 How It Works

This is the innovation: **When 5 models disagree, we show the disagreement.**

Instead of just picking "consensus", we show you:
- ✅ What they all agree on (root cause)
- 🤔 Where they differ (alternative approaches)  
- 📊 How confident each one is (0-100%)
- 👥 What each individual model thinks (see all 5 perspectives)

**Why?** Sometimes problems ARE ambiguous. Having 5 viewpoints helps you think deeper.

Learn more in [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md).

---

## 📋 What's Included

✅ **v0.5.2 (Current)**
- MCP server + 4 tools
- 5 AI model integration (parallel execution)
- Consensus algorithm
- Developer guidance tool
- Caching layer
- Cost tracking
- Full documentation
- Production-ready

❌ **Not Yet (v1.0+)**
- Advanced consensus voting
- IDE/VS Code integration
- Web dashboard
- GitHub issue integration

---

## 🚀 Status

**v0.5.2 is PRODUCTION READY.**

- ✅ Tested with 5 real AI models
- ✅ Error handling complete
- ✅ MCP protocol compliant
- ✅ Documentation comprehensive
- ✅ Real-world example solved

---

## 📚 Read Next

1. **[USER_GUIDE.md](./docs/USER_GUIDE.md)** ← Start here (simple, practical)
2. **[TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md)** ← Understand the system
3. **[PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md)** ← See what's tested

---

## 🤝 Contributing

Issues and PRs welcome! Check GitHub Issues to see what's needed.

---

## 📄 License

MIT

---

## 🎯 Why This Matters

**Problem:** You're stuck. One AI model isn't enough perspective.

**Solution:** Ask 5 at once. See where they agree. See where they disagree.

**Result:** Better decisions. Faster. Clearer thinking.

---

**Ready to use it?** Start with [USER_GUIDE.md](./docs/USER_GUIDE.md).

**Want to understand it?** Read [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md).

**Ships immediately.** No setup surprises. Works out of the box.

🚀 Let's go!
