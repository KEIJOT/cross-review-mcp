---
phase: quick
plan: "01"
subsystem: sequential-review
tags: [cross-review, llm, concerns-audit, spendcity]
dependency_graph:
  requires: []
  provides: [sequential-cross-review-script, concerns-review-results]
  affects: []
tech_stack:
  added: [litellm]
  patterns: [sequential-critique-accumulation, consensus-synthesis]
key_files:
  created:
    - sequential_review.py
    - .planning/quick/1-sequential-cross-review-of-concerns-md-v/RESULTS.json
  modified: []
decisions:
  - "Used o4-mini in place of deepseek-reasoner (insufficient balance); serves same reasoning-model purpose"
  - "Swap gemini-2.5-flash-preview-04-17 to gemini/gemini-2.5-flash (correct litellm model ID)"
  - "Add temperature=1 guard for o-series models to avoid UnsupportedParamsError"
  - "Load .env via Python pathlib before litellm import to ensure keys are available"
metrics:
  duration: "~10min"
  completed: "2026-03-14"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Quick Task 01: Sequential Cross-Review of CONCERNS.md — Summary

## One-liner

Sequential 4-model adversarial review of SpendCity CONCERNS.md using GPT-5.2 → Gemini 2.5 Flash → o4-mini → Mistral Large with accumulated critique chain and GPT-5.2 consensus synthesis.

## What Was Done

Fixed and ran `sequential_review.py` to perform a sequential cross-review of `/Users/keijotuominen/PROJECTS/SPENDCITY/.planning/codebase/CONCERNS.md` (~240 lines, 18K chars).

**Key fixes applied:**

1. **Accumulated critique chain** — Each model now receives ALL prior critiques (with model attribution headers), not just the last one. This enables genuine sequential adversarial review where each model builds on or challenges the full prior discussion.

2. **Consensus synthesis step** — After all 4 reviews, a final GPT-5.2 call synthesizes: concerns all models agreed are critical, points of disagreement, top-5 severity ranking, and an executive summary.

3. **Output path fixed** — Results saved to `.planning/quick/1-sequential-cross-review-of-concerns-md-v/RESULTS.json` (was pointing to a non-existent `/Projects/samples/` path).

4. **max_tokens increased to 3000** — Prevents truncation on substantive CONCERNS.md analysis.

5. **Reasoning model timeout to 120s** — Applied to o4-mini slot.

6. **API keys from .env** — Script loads `.env` via pathlib before litellm import.

7. **o-series temperature guard** — Detects o-series model IDs and uses `temperature=1` (only supported value).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] API keys not loaded from environment**
- **Found during:** Initial run attempt
- **Issue:** The script read env vars at import time, but the Claude Code environment did not have them set. Keys were in `.env` file.
- **Fix:** Added `.env` loader via `pathlib.Path` before litellm import, using `os.environ.setdefault` to avoid overwriting any vars already in environment.
- **Files modified:** `sequential_review.py`
- **Commit:** 1865971

**2. [Rule 1 - Bug] Wrong Gemini model ID**
- **Found during:** First run
- **Issue:** `gemini/gemini-2.5-flash-preview-04-17` returned 404 from Gemini API. Correct litellm model ID is `gemini/gemini-2.5-flash`.
- **Fix:** Updated model ID in MODELS list.
- **Commit:** 1865971

**3. [Rule 3 - Blocking] deepseek-reasoner has insufficient balance**
- **Found during:** First run
- **Issue:** DeepSeek account has no balance; all deepseek/* model IDs fail with `Insufficient Balance`. OpenRouter also has no credits.
- **Fix:** Substituted `o4-mini` (OpenAI reasoning model) in the DeepSeek slot. Serves same purpose (reasoning model perspective). Plan requires >=3/4 successes — achieved 4/4.
- **Commit:** 1865971

**4. [Rule 1 - Bug] o4-mini fails with temperature=0.7**
- **Found during:** Second run (after DeepSeek fix)
- **Issue:** O-series models only support `temperature=1`. litellm raises `UnsupportedParamsError`.
- **Fix:** Added `is_o_series` detection and conditional temperature assignment before each `completion()` call.
- **Commit:** 1865971

## Review Results Summary

**Run outcome:** 4/4 models succeeded. Consensus verdict generated.

**Top consensus findings (all models agreed):**

1. **CRITICAL — Unsafe `getattr()` sort without allowlist** (`receipt_service`, `warranty_service`, `asset_service`)
   - Enables arbitrary SQLAlchemy attribute access via user-controlled request parameter
   - Fix pattern already exists in `folder_service.py`; just needs replication
   - Confidence: HIGH across all models

2. **CRITICAL — GDPR deletion/export reliability** (`backend/routes/gdpr.py`)
   - 5 broad `except Exception` handlers in GDPR flows
   - No integration tests for account deletion
   - Silent failures can mask incomplete data deletion (compliance/legal risk)
   - Confidence: HIGH (raised from MEDIUM-HIGH by Mistral)

3. **HIGH (escalates to CRITICAL under load) — Receipt list N+1** (`receipt_service.py`)
   - `len(r.items)` in serialization loop triggers lazy load per receipt
   - With single gunicorn worker + pool size 10, 100 receipts = 101+ queries = availability risk
   - Fix: `selectinload(Receipt.items)` or SQL COUNT subquery

**Executive verdict (from consensus):** Fix (1) unsafe sort getattr and (2) GDPR flows immediately — these are stop-ship risks. Then (3) fix N+1 queries. Then wire CI anti-pattern enforcement. Everything else (monolith refactors, hardcoded colors, deprecated wrappers) is schedulable tech debt.

**Results file:** `.planning/quick/1-sequential-cross-review-of-concerns-md-v/RESULTS.json` (4 model entries + consensus)

## Self-Check: PASSED

- [x] `sequential_review.py` exists and is executable
- [x] `RESULTS.json` exists with 4 model entries
- [x] All 4 models status = 'success'
- [x] Consensus verdict present in results
- [x] Commit 1865971 exists
