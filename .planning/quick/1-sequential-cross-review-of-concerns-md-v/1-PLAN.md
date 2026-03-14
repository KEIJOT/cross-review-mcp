---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [sequential_review.py]
autonomous: true
requirements: [QUICK-01]

must_haves:
  truths:
    - "CONCERNS.md is sent to GPT-5.2 for initial review"
    - "Each subsequent model sees all prior critiques, not just the last one"
    - "Final output is a consensus verdict on what is actually critical"
    - "Results are saved to a file for later reference"
  artifacts:
    - path: "sequential_review.py"
      provides: "Sequential cross-review script"
  key_links:
    - from: "sequential_review.py"
      to: "litellm"
      via: "completion() calls to 4 models in sequence"
      pattern: "completion\\(model="
---

<objective>
Fix and run sequential_review.py to perform a 4-model sequential cross-review of SpendCity's CONCERNS.md.

Purpose: Get multi-model adversarial assessment of which codebase concerns are truly critical.
Output: Console output with all 4 reviews + consensus verdict, plus JSON results file.
</objective>

<execution_context>
@/Users/keijotuominen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/keijotuominen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@sequential_review.py (existing script - nearly complete, needs fixes)
The file /Users/keijotuominen/PROJECTS/SPENDCITY/.planning/codebase/CONCERNS.md is the target content (~240 lines covering tech debt, bugs, security, performance, scaling).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix sequential_review.py and run the review</name>
  <files>sequential_review.py</files>
  <action>
Update the existing sequential_review.py with these fixes:

1. **Accumulate ALL prior critiques, not just the last one.** Currently `previous_critique` is overwritten each iteration. Instead, maintain a list of all critiques and pass the full chain to each subsequent model. Format the accumulated critiques with model attribution headers so each reviewer sees who said what.

2. **Add a final consensus synthesis step after Mistral.** After all 4 reviews complete, take the last model's output (which already saw all prior critiques) and extract the final verdict. Alternatively, add a brief "CONSENSUS SUMMARY" section at the end that lists:
   - Which concerns ALL models agreed are critical
   - Which concerns had disagreement
   - Final severity ranking

3. **Fix the output path.** Change from `/Users/keijotuominen/PROJECTS/samples/SEQUENTIAL_REVIEW_RESULTS.json` to `/Users/keijotuominen/PROJECTS/LLMAPI/.planning/quick/1-sequential-cross-review-of-concerns-md-v/RESULTS.json` so results stay with the plan.

4. **Increase max_tokens to 3000** for each model call -- CONCERNS.md is substantial (~240 lines) and 2000 tokens may truncate detailed analysis.

5. **Increase timeout for DeepSeek R1 to 120 seconds** (reasoning models can be slow).

6. **Run the script:** `python sequential_review.py`

The script uses litellm which should already be installed. API keys (OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, MISTRAL_API_KEY) are in the environment.

IMPORTANT: Do NOT use venv or virtual environments. Use plain `python` and `pip` directly per project conventions.
  </action>
  <verify>
    <automated>python -c "import json; r=json.load(open('/Users/keijotuominen/PROJECTS/LLMAPI/.planning/quick/1-sequential-cross-review-of-concerns-md-v/RESULTS.json')); assert len(r['results']) == 4; success=[x for x in r['results'] if x['status']=='success']; assert len(success) >= 3, f'Only {len(success)} succeeded'"</automated>
  </verify>
  <done>At least 3 of 4 models returned successful reviews. Results JSON saved. Console output shows the sequential review chain with accumulated critiques and a final consensus on which CONCERNS.md items are truly critical.</done>
</task>

</tasks>

<verification>
- RESULTS.json exists with 4 model entries
- At least 3 models succeeded
- Each model after GPT-5.2 received accumulated prior critiques (visible in the prompt construction)
- Final output includes consensus on critical concerns
</verification>

<success_criteria>
Sequential cross-review completes with at least 3/4 models succeeding. Output clearly identifies which concerns from CONCERNS.md are genuinely critical vs noise, with multi-model agreement visible.
</success_criteria>

<output>
After completion, create `.planning/quick/1-sequential-cross-review-of-concerns-md-v/1-SUMMARY.md`
</output>
