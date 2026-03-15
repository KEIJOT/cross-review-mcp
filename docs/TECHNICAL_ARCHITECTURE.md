# 🏗️ Technical Architecture Guide

## How It Works (Like LEGO Blocks)

Imagine building with LEGO:

```
┌─────────────────────────────────────┐
│   You (Claude.ai)                   │
│   "Fix this error for me"           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   MCP Server (The Translator)       │
│   "OK, I'll ask 5 AIs about this"   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   ReviewExecutor (The Distributor)  │
│   "Hey 5 AIs, answer this question" │
└──────┬──┬──┬──┬──┬──────────────────┘
       │  │  │  │  │
    ┌──┘  │  │  │  └──┐
    │     │  │  │     │
    ▼     ▼  ▼  ▼     ▼
  ┌─┐  ┌─┐ ┌─┐ ┌─┐  ┌─┐
  │1│  │2│ │3│ │4│  │5│  Five AIs answering AT THE SAME TIME
  └─┘  └─┘ └─┘ └─┘  └─┘
  
  Open  Gem  Deep Mist Open
  AI    ini  Seek ral Router
  
    │     │  │  │     │
    └──┬──┴──┴──┴─────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Consensus Algorithm               │
│   "What do they all agree on?"      │
│   "Where do they disagree?"         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Answer back to you                │
│   Root Cause + Fix + Perspectives   │
└─────────────────────────────────────┘
```

---

## The 7 LEGO Blocks

### Block 1: **MCP Server** (src/index.ts)

**What:** The front door. Listens for requests from Claude.

**Does:** 
- Waits for you to call a tool
- Registers 4 tools (get_dev_guidance, review_content, cache_stats, cost_summary)
- Lazy-loads the ReviewExecutor only when needed (saves memory)

**Real analogy:** Like a receptionist at a hotel. You ask for help, they figure out who to call.

---

### Block 2: **ReviewExecutor** (src/executor.ts)

**What:** The brain. Sends your question to all 5 AIs at once.

**Does:**
- Opens connections to 5 AI APIs
- Sends your question to ALL of them IN PARALLEL (not one at a time)
- Collects all 5 answers
- Counts tokens (for billing)
- Records how long it took

**Real analogy:** Like an auctioneer asking 5 bidders the same question at the same time.

---

### Block 3: **Provider Abstraction** (src/providers.ts)

**What:** The translator. Each AI speaks a different language.

**Does:**
- OpenAI provider: Speaks OpenAI's API language
- Gemini provider: Speaks Google's API language  
- DeepSeek/Mistral: Uses OpenRouter's translator (they speak OpenRouter's language)
- Translates EVERYTHING to the same format so the system understands

**Real analogy:** Like a translator at the UN. Everyone speaks different languages, but the translator makes sure everyone understands.

---

### Block 4: **Consensus Algorithm** (src/consensus-algorithm.ts)

**What:** The judge. Decides what the 5 AIs agreed on.

**Does:**
- Reads all 5 answers
- Finds the MOST COMMON diagnosis (what do 4 out of 5 agree on?)
- Calculates confidence: "Are they all agreeing? Or split?"
- Finds disagreements and marks them as "alternative approaches"

**Real analogy:** Like a jury. 5 people vote on the answer. If 4 agree, that's the verdict. If they're split, you note the different opinions.

---

### Block 5: **Developer Guidance Tool** (src/dev-guidance.ts)

**What:** The smart wrapper. Takes a messy error and formats it nicely.

**Does:**
- Takes: "PORT IS IN USE at 6277" + what you tried + your environment
- Formats it into a clear question for all 5 AIs
- Parses their answers (some return markdown JSON `{...}`, some return plain JSON)
- Feeds responses to the Consensus Algorithm
- Returns: Root cause + immediate fix + confidence + per-model perspectives

**Real analogy:** Like a smart note-taking app. You give it messy notes, it organizes them beautifully.

---

### Block 6: **Cache Layer** (src/cache.ts)

**What:** The memory. Remembers previous answers.

**Does:**
- If you ask the EXACT same question twice, it doesn't call the 5 AIs again
- Just returns the cached answer (instant!)
- Saves money (no extra API calls)
- Uses LRU (Least Recently Used): old answers get deleted to make room for new ones
- Persists to disk (survives restart)

**Real analogy:** Like a notebook. You write down the answer once. Next time someone asks, you just read your notes.

---

### Block 7: **Cost Manager** (src/cost-manager.ts)

**What:** The accountant. Tracks how much money you're spending.

**Does:**
- Counts tokens (OpenAI uses 1,000 tokens ≈ $0.02)
- Tracks: How much did OpenAI cost? Gemini? etc.
- Shows: "You've spent $1.23 today out of your $10 budget"
- Alerts: "You're running low!"

**Real analogy:** Like a calculator. You input tokens, it calculates the bill.

---

## The Request Journey (Step-by-Step)

### Step 1: You Ask Something
```
"Why does my app crash on startup?"
```

### Step 2: MCP Server Receives It
```
Tool: get_dev_guidance
Params: error="app crashes", technology="React", 
        environment="iOS", attempts=["cleared cache", "restarted"]
```

### Step 3: Lazy-Load ReviewExecutor
```
First time? Load it.
Check all 5 API keys exist.
Initialize all 5 providers.
```

### Step 4: Developer Guidance Tool Formats the Question
```
You are an expert iOS developer. 
A React app crashes on startup.
The developer has already: cleared cache, restarted.
What's the root cause and immediate fix?
Respond as JSON: {diagnosis, suggestion, confidence, alternatives}
```

### Step 5: ReviewExecutor Sends to 5 AIs IN PARALLEL

```
OpenAI          Gemini          DeepSeek        Mistral         OpenRouter
(ask)           (ask)           (ask)           (ask)           (ask)
  │               │               │               │               │
  └───────────────┴───────────────┴───────────────┴───────────────┘
                           (ALL AT ONCE)
  ┌───────────────┬───────────────┬───────────────┬───────────────┐
  │               │               │               │               │
 (answer)       (answer)        (answer)        (answer)        (answer)
  │               │               │               │               │
  └───────────────┴───────────────┴───────────────┴───────────────┘
```

**Time: ~3-5 seconds total** (not 3-5 seconds × 5)

### Step 6: Parse All 5 Responses

Some AIs return:
```json
{"diagnosis": "...", "suggestion": "...", "confidence": 0.85}
```

Some AIs return (markdown-wrapped):
```
```json
{"diagnosis": "...", ...}
```
```

The parser extracts the JSON from all formats.

### Step 7: Consensus Algorithm Analyzes

```
OpenAI said:    "Missing import statement"      (confidence: 0.92)
Gemini said:    "Missing import statement"      (confidence: 0.95)
DeepSeek said:  "Missing import"                (confidence: 0.78)
Mistral said:   "Import not found"              (confidence: 0.81)
OpenRouter said:"Missing module import"         (confidence: 0.85)

Consensus analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Root Cause: Missing import statement (5/5 agree)
Confidence: 86% average
Alternative: None (everyone agrees)
```

### Step 8: Return to You

```json
{
  "root_cause": "Missing import statement",
  "immediate_fix": "Add: import { Component } from 'react'",
  "per_model_analysis": [
    {"model": "OpenAI", "confidence": 0.92, "perspective": "..."},
    {"model": "Gemini", "confidence": 0.95, "perspective": "..."},
    ...
  ],
  "consensus_confidence": 0.86,
  "alternative_approaches": [],
  "timestamp": "2026-03-15T03:30:00Z"
}
```

---

## Key Design Decisions

### 1. **Parallel vs Sequential**

❌ Bad: Ask OpenAI (wait 3s) → Ask Gemini (wait 3s) → Ask DeepSeek (wait 3s)
**Total time: 9 seconds**

✅ Good: Ask all 5 at the same time
**Total time: 3 seconds**

We use parallel requests because waiting is dumb.

### 2. **Lazy Loading**

❌ Bad: Load ReviewExecutor when the server starts (takes 2 seconds)

✅ Good: Load ReviewExecutor only on first tool call

Why? If you never use it, you don't need it. Saves memory.

### 3. **Caching**

❌ Bad: Ask the same question twice, call all 5 AIs twice

✅ Good: Cache the first answer, return it instantly second time

Why? Saves money. Saves time. No reason to repeat.

### 4. **Divergence as a Feature**

❌ Bad: 5 AIs disagree, so we just ignore 4 of them

✅ Good: When AIs disagree, show the disagreement as "alternative approaches"

Why? Sometimes problems ARE ambiguous. Showing multiple angles is helpful.

---

## The Consensus Formula

```
CONFIDENCE = AVERAGE of all AI confidences

If all 5 say "Missing import" (95%, 92%, 88%, 91%, 90%):
  Consensus confidence = (95 + 92 + 88 + 91 + 90) / 5 = 91%

If 4 say "Missing import" and 1 says "Wrong version":
  Consensus = "Missing import"
  Alternative approaches = ["Wrong version"]
  Confidence drops because of disagreement
```

---

## Performance

```
Operation                       Time        Cost
───────────────────────────────────────────────────
Single API call (1 AI)          3-5s        $0.01-0.05
cross-review (5 AIs parallel)   3-5s        $0.05-0.25
Cached response (no API calls)  <0.1s       $0.00

You get 5× the brains
Same speed as 1 AI
5× the cost (usually $0.10-0.20)
```

---

## What Happens If One AI Fails?

```
You ask a question.
OpenAI works ✅
Gemini works ✅
DeepSeek FAILS ❌ (API down)
Mistral works ✅
OpenRouter works ✅

Result: Show 4 answers, note that DeepSeek didn't respond.
Confidence drops slightly (missing 20% of the brains).
But you still get an answer!
```

---

## Deployment Models

### 1. **Claude.ai (Easiest)**
- Install via MCP protocol
- Use naturally in conversations
- No setup needed after connect

### 2. **CLI Tool**
```bash
cross-review dev --error "..." --tech "..."
```

### 3. **Docker Container**
```bash
docker run -e OPENAI_API_KEY=... cross-review-mcp
```

### 4. **Systemd Service (Linux)**
```bash
systemctl start cross-review-mcp
```

---

## Limitations

- ⚠️ Costs 5× more than single AI (but often worth it)
- ⚠️ Takes 3-5 seconds (not instant)
- ⚠️ Needs all 5 API keys (or at least some of them)
- ⚠️ Not designed for real-time chat (it's designed for blockers)

---

## Future Improvements

- 🔄 Weighted voting (some AIs better at certain tasks)
- 🧠 ML-powered consensus (learn which AI is best per domain)
- 📱 IDE plugin (right-click error → get guidance)
- 💬 VS Code extension (hover over error → show 5 perspectives)

---

## That's the Architecture!

5 AIs, 7 components, 1 amazing system.

**Next:** Read USER_GUIDE.md to start using it!
