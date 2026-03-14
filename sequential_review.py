#!/usr/bin/env python3
"""
Sequential Cross-Review Engine
Pipes critiques through multiple models iteratively.
Each model sees ALL prior critiques, not just the last one.
"""

import os
import json
import sys
from datetime import datetime
import time
from pathlib import Path

# Load .env before litellm import so keys are available
_env_path = Path(__file__).parent / '.env'
if _env_path.exists():
    for _line in _env_path.read_text().strip().split('\n'):
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _v = _line.split('=', 1)
            os.environ.setdefault(_k.strip(), _v.strip())

from litellm import completion

# Configuration
CONCERNS_FILE = '/Users/keijotuominen/PROJECTS/SPENDCITY/.planning/codebase/CONCERNS.md'
RESULTS_FILE = '/Users/keijotuominen/PROJECTS/LLMAPI/.planning/quick/1-sequential-cross-review-of-concerns-md-v/RESULTS.json'

# Models in sequence.
# NOTE: deepseek/deepseek-reasoner has insufficient balance as of 2026-03-14;
# o4-mini (OpenAI reasoning model) is used as the slot-3 reviewer instead.
MODELS = [
    ('gpt-5.2', 'GPT-5.2', 30),
    ('gemini/gemini-2.5-flash', 'Gemini 2.5 Flash', 30),
    ('o4-mini', 'o4-mini (reasoning)', 120),
    ('mistral/mistral-large-latest', 'Mistral Large', 30)
]

SYSTEM_PROMPT = """You are a critical code auditor. Review the provided codebase concerns.

Your job:
1. Assess the severity of each concern (CRITICAL / MAJOR / MINOR / NONE)
2. Identify patterns or root causes
3. Flag hidden dependencies or cascading risks
4. Rate confidence in your assessment (HIGH / MEDIUM / LOW)

If you're seeing previous critiques, build on them:
- Validate or challenge their conclusions
- Add perspectives they missed
- Refine confidence levels based on consensus
- Call out logical inconsistencies

Be concise. Focus on the TOP 3 MOST CRITICAL ISSUES."""

CONSENSUS_SYSTEM_PROMPT = """You are a senior engineering lead synthesizing a multi-model adversarial code review.

You will receive:
1. The original codebase concerns document
2. Sequential critiques from 4 different AI models, each building on the prior assessments

Your job is to produce a CONSENSUS VERDICT:
1. List the concerns ALL models agreed are CRITICAL (high confidence)
2. List concerns with DISAGREEMENT across models (explain the disagreement)
3. Provide a final severity ranking of the top 5 concerns
4. Give a one-paragraph executive summary: what needs to be fixed immediately vs. what can wait

Be direct and actionable. This is the final word."""


def read_concerns():
    """Read the CONCERNS.md file."""
    with open(CONCERNS_FILE, 'r') as f:
        return f.read()


def build_accumulated_prompt(content, prior_critiques):
    """Build prompt with ALL prior critiques accumulated, with model attribution."""
    if not prior_critiques:
        return content

    critique_sections = []
    for i, (model_name, critique) in enumerate(prior_critiques, 1):
        critique_sections.append(f"=== CRITIQUE {i}/{len(prior_critiques)}: {model_name} ===\n{critique}")

    accumulated = '\n\n'.join(critique_sections)

    return f"""PRIOR CRITIQUES (all {len(prior_critiques)} reviews so far):
{accumulated}

---

ORIGINAL CODEBASE CONCERNS:
{content}

---

Now provide YOUR assessment. Build on the prior reviews, validate or challenge them, and add perspectives they missed."""


def review_with_model(model_id, model_name, content, prior_critiques=None, timeout=30):
    """Send content to a model for review with accumulated prior critiques."""
    start_time = time.time()

    prompt = build_accumulated_prompt(content, prior_critiques or [])

    # O-series models (o1, o3, o4-mini, etc.) only support temperature=1
    is_o_series = model_id.startswith('o') and (model_id[1:2].isdigit() or model_id.startswith('o1'))
    temperature = 1 if is_o_series else 0.7

    try:
        response = completion(
            model=model_id,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=3000,
            temperature=temperature,
            timeout=timeout
        )

        elapsed = time.time() - start_time
        critique = response.choices[0].message.content

        return {
            'model': model_name,
            'status': 'success',
            'critique': critique,
            'elapsed_seconds': round(elapsed, 2),
            'tokens_used': response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 'unknown'
        }

    except Exception as e:
        elapsed = time.time() - start_time
        return {
            'model': model_name,
            'status': 'error',
            'error': str(e),
            'elapsed_seconds': round(elapsed, 2)
        }


def generate_consensus(content, all_critiques, timeout=60):
    """Generate a final consensus verdict from all 4 model critiques."""
    critique_sections = []
    for i, (model_name, critique) in enumerate(all_critiques, 1):
        critique_sections.append(f"=== MODEL {i}: {model_name} ===\n{critique}")

    accumulated = '\n\n'.join(critique_sections)

    prompt = f"""ORIGINAL CODEBASE CONCERNS:
{content}

---

ALL 4 MODEL CRITIQUES:
{accumulated}

---

Synthesize a CONSENSUS VERDICT."""

    try:
        response = completion(
            model='gpt-5.2',
            messages=[
                {"role": "system", "content": CONSENSUS_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=3000,
            temperature=0.3,
            timeout=timeout
        )
        return {
            'status': 'success',
            'verdict': response.choices[0].message.content,
            'tokens_used': response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 'unknown'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def main():
    """Run sequential cross-review."""

    print('=' * 70)
    print('SEQUENTIAL CROSS-REVIEW ENGINE')
    print('=' * 70)

    # Read concerns
    concerns = read_concerns()
    print(f'Loaded {len(concerns)} characters from CONCERNS.md')
    print(f'Estimated tokens: ~{len(concerns) // 4}')
    print()

    # Sequential review — accumulate ALL prior critiques
    results = []
    prior_critiques = []  # List of (model_name, critique) tuples
    total_start = time.time()

    for model_id, model_name, timeout in MODELS:
        print(f'Reviewing with {model_name} (prior critiques: {len(prior_critiques)})...')

        result = review_with_model(
            model_id,
            model_name,
            concerns,
            prior_critiques=prior_critiques,
            timeout=timeout
        )

        results.append(result)

        if result['status'] == 'success':
            elapsed_str = result['elapsed_seconds']
            tokens_str = result['tokens_used']
            print(f'  OK {model_name}: {elapsed_str}s ({tokens_str} tokens)')
            # Accumulate this critique for all subsequent models
            prior_critiques.append((model_name, result['critique']))
        else:
            error_str = result['error']
            print(f'  FAIL {model_name}: {error_str}')

        print()

    # Generate consensus verdict
    successful_critiques = [(name, critique) for name, critique in prior_critiques]
    consensus = None
    if len(successful_critiques) >= 2:
        print('Generating consensus verdict...')
        consensus = generate_consensus(concerns, successful_critiques)
        if consensus['status'] == 'success':
            print(f'  OK Consensus: ({consensus["tokens_used"]} tokens)')
        else:
            print(f'  FAIL Consensus: {consensus["error"]}')
        print()

    total_elapsed = time.time() - total_start

    # Output results
    print('=' * 70)
    print('SEQUENTIAL REVIEW RESULTS')
    print('=' * 70)
    print()

    for i, result in enumerate(results, 1):
        print(f'--- {result["model"]} ({i}/4) ---')
        print(f'Status: {result["status"]}')
        elapsed_val = result['elapsed_seconds']
        print(f'Time: {elapsed_val}s')

        if result['status'] == 'success':
            tokens_val = result['tokens_used']
            print(f'Tokens: {tokens_val}')
            print()
            print(result['critique'])
        else:
            error_val = result['error']
            print(f'Error: {error_val}')

        print()

    # Print consensus
    if consensus and consensus['status'] == 'success':
        print('=' * 70)
        print('CONSENSUS VERDICT')
        print('=' * 70)
        print()
        print(consensus['verdict'])
        print()

    # Summary
    print('=' * 70)
    print('SUMMARY')
    print('=' * 70)
    successful = sum(1 for r in results if r['status'] == 'success')
    print(f'Successful reviews: {successful}/4')
    total_rounded = round(total_elapsed, 2)
    print(f'Total elapsed time: {total_rounded}s')

    times = [str(r['elapsed_seconds']) for r in results]
    time_str = ' + '.join(times)
    print(f'Model times: {time_str}s')

    # Save results
    output_data = {
        'timestamp': datetime.now().isoformat(),
        'total_elapsed_seconds': total_elapsed,
        'results': results,
        'consensus': consensus
    }

    os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
    with open(RESULTS_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f'\nResults saved to: {RESULTS_FILE}')


if __name__ == '__main__':
    main()
