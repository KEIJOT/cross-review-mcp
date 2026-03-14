#!/usr/bin/env python3
# claim_validator.py (v1.0.0, 2026-03-14)
"""
Claim Validator — Sequential LLM Reasoning Engine

Validates architectural claims, statements, or assertions by having 4 LLMs
reason about them sequentially, each seeing prior models' logic.

CORRECT usage:
  - Claim: "ConfigHelper safely converts user input"
  - Evidence: [actual code from config_helper.py]
  - Models reason: Is the claim true? What's the evidence?

INCORRECT usage (we won't do this):
  - Scanning directories for vulnerabilities
  - Pattern matching on code
  - Filling gaps with hallucinations

Usage:
  python3 claim_validator.py \
    --claim "Our Redis setup is production-ready" \
    --evidence /path/to/redis_config.py \
    --output verdict.json
"""

import os
import json
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime

# Load .env BEFORE importing litellm
from dotenv import load_dotenv
load_dotenv(Path.home() / '.env')
load_dotenv(Path.home() / '.env.local')
load_dotenv(Path.cwd() / '.env')

from litellm import completion

# Models in sequence: (display_name, model_id, timeout_seconds)
MODELS = [
    ('Gemini 2.5 Flash', 'gemini/gemini-2.5-flash', 30),
    ('Mistral Large', 'mistral/mistral-large-latest', 90),
]

SYSTEM_PROMPT = """You are a rigorous technical evaluator. Your job is to assess claims about code/architecture.

Rules:
1. ONLY evaluate what you can see in the evidence. Do NOT hallucinate code.
2. If evidence is truncated or incomplete, SAY SO explicitly.
3. Rate your confidence (HIGH / MEDIUM / LOW) based on evidence quality.
4. Flag assumptions you're making.
5. Be direct: Is the claim TRUE or FALSE based on the evidence provided?

If you see prior reasoning:
- Validate or challenge their logic
- Point out what they missed or assumed
- Refine the confidence rating
- Build consensus on the truth value of the claim

Never fill gaps. Never guess. Only reason about what's shown."""


def load_evidence(path: str) -> str:
    """Load evidence file or directory."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Evidence path not found: {path}")
    
    if p.is_file():
        with open(p, 'r') as f:
            return f.read()
    elif p.is_dir():
        # Load all Python files in directory
        files = []
        for py_file in sorted(p.glob("*.py"))[:5]:  # Limit to 5 files to avoid token bloat
            try:
                with open(py_file, 'r') as f:
                    content = f.read()
                    files.append(f"=== {py_file.name} ===\n{content}\n")
            except Exception as e:
                files.append(f"[ERROR reading {py_file.name}: {e}]\n")
        
        if not files:
            raise ValueError(f"No Python files found in {path}")
        return "\n".join(files)
    else:
        raise ValueError(f"Not a file or directory: {path}")


def validate_claim(claim: str, model_name: str, model_id: str, evidence: str, previous_reasoning: list = None, timeout: int = 30):
    """Have a model evaluate a claim against evidence."""
    start_time = time.time()
    
    if previous_reasoning:
        prior_text = "\n\n".join([f"=== {name} ===\n{reasoning}" for name, reasoning in previous_reasoning])
        prompt = f"""PREVIOUS EVALUATIONS:
{prior_text}

---

CLAIM TO EVALUATE:
{claim}

---

EVIDENCE:
{evidence}

---

Now provide YOUR evaluation. Build on or challenge the previous reasoning. Is the claim TRUE or FALSE based on the evidence?"""
    else:
        prompt = f"""CLAIM TO EVALUATE:
{claim}

---

EVIDENCE:
{evidence}

---

Evaluate this claim against the evidence provided. Is it TRUE or FALSE? Why?"""
    
    try:
        response = completion(
            model=model_id,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.7,
            timeout=timeout
        )
        
        elapsed = time.time() - start_time
        reasoning = response.choices[0].message.content
        
        return {
            'model': model_name,
            'model_id': model_id,
            'status': 'success',
            'reasoning': reasoning,
            'elapsed_seconds': round(elapsed, 2),
            'tokens_used': response.usage.total_tokens if hasattr(response, 'usage') else 'unknown'
        }
    
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            'model': model_name,
            'model_id': model_id,
            'status': 'error',
            'error': str(e),
            'elapsed_seconds': round(elapsed, 2)
        }


def main():
    parser = argparse.ArgumentParser(
        description='Claim Validator — Sequential LLM reasoning about technical claims'
    )
    parser.add_argument('--claim', required=True, help='The claim to evaluate (e.g., "Redis is production-ready")')
    parser.add_argument('--evidence', required=True, help='Path to evidence file or directory')
    parser.add_argument('--output', default=None, help='Output JSON file')
    args = parser.parse_args()
    
    # Load evidence
    try:
        evidence = load_evidence(args.evidence)
    except Exception as e:
        print(f"ERROR loading evidence: {e}", file=sys.stderr)
        sys.exit(1)
    
    print('=' * 70)
    print('CLAIM VALIDATOR — Sequential LLM Reasoning')
    print('=' * 70)
    print(f'Claim: {args.claim}')
    print(f'Evidence: {len(evidence)} chars (~{len(evidence) // 4} tokens)')
    print()
    
    # Sequential evaluation
    results = []
    previous_reasoning = []
    total_start = time.time()
    
    for model_name, model_id, timeout in MODELS:
        print(f'Evaluating with {model_name}...', end=' ', flush=True)
        result = validate_claim(
            args.claim,
            model_name,
            model_id,
            evidence,
            previous_reasoning=previous_reasoning,
            timeout=timeout
        )
        results.append(result)
        
        if result['status'] == 'success':
            print(f"✓ {result['elapsed_seconds']}s ({result['tokens_used']} tokens)")
            previous_reasoning.append((model_name, result['reasoning']))
        else:
            print(f"✗ ERROR")
            print(f"  {result['error']}", file=sys.stderr)
        print()
    
    total_elapsed = time.time() - total_start
    
    # Output results
    print('=' * 70)
    print('EVALUATIONS')
    print('=' * 70)
    print()
    
    successful = [r for r in results if r['status'] == 'success']
    if not successful:
        print("ERROR: No models succeeded.", file=sys.stderr)
        return 1
    
    for i, result in enumerate(successful, 1):
        print(f'--- {result["model"]} ({i}/{len(successful)}) ---')
        print(result['reasoning'])
        print()
    
    print('=' * 70)
    print('SUMMARY')
    print('=' * 70)
    print(f'Total time: {round(total_elapsed, 2)}s')
    print(f'Models: {len(successful)}/{len(results)} successful')
    print()
    
    # Save results
    output_file = args.output or f'verdict-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
    output_path = Path(output_file)
    
    with open(output_path, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'claim': args.claim,
            'evidence_tokens': len(evidence) // 4,
            'total_elapsed_seconds': round(total_elapsed, 2),
            'results': results
        }, f, indent=2)
    
    print(f'Results saved to: {output_path.absolute()}')
    return 0 if len(successful) >= 1 else 1


if __name__ == '__main__':
    sys.exit(main())
