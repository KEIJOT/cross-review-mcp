#!/usr/bin/env python3
# sequential_cross_review.py (v1.0.3, 2026-03-14)

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
# Removed Claude (ANTHROPIC_API_KEY not in Claude Code env) and GPT-4o (rate limited)
MODELS = [
    ('Gemini 2.5 Flash', 'gemini/gemini-2.5-flash', 30),
    ('Mistral Large', 'mistral/mistral-large-latest', 90),
]

SYSTEM_PROMPT = """You are a critical code auditor. Review the provided codebase.

Your job:
1. Assess severity of each concern (CRITICAL / MAJOR / MINOR / NONE)
2. Identify root causes and cascading risks
3. Rate your confidence (HIGH / MEDIUM / LOW)
4. Focus on TOP 3 MOST CRITICAL ISSUES

If you see previous critiques: validate, challenge, or refine them.
Be direct. No fluff. Action-oriented."""

def load_content(path: str) -> tuple:
    """Load file or directory content."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Path not found: {path}")
    
    if p.is_file():
        with open(p, 'r') as f:
            content = f.read()
        return content, f"File: {p.name}"
    elif p.is_dir():
        files = []
        for py_file in list(p.rglob("*.py"))[:8]:
            try:
                with open(py_file, 'r') as f:
                    content = f.read()
                    # Limit each file to 1500 chars to stay under token limits
                    if len(content) > 1500:
                        content = content[:1500] + f"\n... [{len(content)-1500} more chars]"
                    files.append(f"=== {py_file.relative_to(p)} ===\n{content}\n")
            except Exception as e:
                files.append(f"[ERROR reading {py_file}: {e}]\n")
        if not files:
            raise ValueError(f"No Python files found in {path}")
        content = "\n".join(files)
        return content, f"Directory: {p.name} ({len(files)} files)"
    else:
        raise ValueError(f"Not a file or directory: {path}")

def review_with_model(model_name, model_id, content, previous_critiques=None, timeout=30):
    """Send content to a model for review."""
    start_time = time.time()
    
    if previous_critiques:
        prior_text = "\n\n".join([f"=== {name} ===\n{critique}" for name, critique in previous_critiques])
        prompt = f"""PREVIOUS REVIEWS:
{prior_text}

---

ORIGINAL CONTENT:
{content}

---

Now provide YOUR assessment. Build on or challenge the previous reviews."""
    else:
        prompt = f"""CONTENT FOR REVIEW:
{content}

---

Provide your critical assessment."""
    
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
        critique = response.choices[0].message.content
        
        return {
            'model': model_name,
            'model_id': model_id,
            'status': 'success',
            'critique': critique,
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
    parser = argparse.ArgumentParser(description='Sequential cross-review of codebase')
    parser.add_argument('input', help='File or directory to review')
    parser.add_argument('--output', default=None, help='Output JSON file')
    args = parser.parse_args()
    
    try:
        content, source_desc = load_content(args.input)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    
    print('=' * 70)
    print('SEQUENTIAL CROSS-REVIEW ENGINE')
    print('=' * 70)
    print(f'Source: {source_desc}')
    print(f'Content: {len(content)} chars (~{len(content) // 4} tokens)')
    print()
    
    results = []
    previous_critiques = []
    total_start = time.time()
    
    for model_name, model_id, timeout in MODELS:
        print(f'Reviewing with {model_name}...', end=' ', flush=True)
        result = review_with_model(model_name, model_id, content, previous_critiques=previous_critiques, timeout=timeout)
        results.append(result)
        
        if result['status'] == 'success':
            print(f"✓ {result['elapsed_seconds']}s ({result['tokens_used']} tokens)")
            previous_critiques.append((model_name, result['critique']))
        else:
            print(f"✗ ERROR")
            print(f"  {result['error']}", file=sys.stderr)
        print()
    
    total_elapsed = time.time() - total_start
    print('=' * 70)
    print('VERDICTS')
    print('=' * 70)
    print()
    
    successful = [r for r in results if r['status'] == 'success']
    if not successful:
        print("ERROR: No models succeeded.", file=sys.stderr)
        return 1
    
    for i, result in enumerate(successful, 1):
        print(f'--- {result["model"]} ({i}/{len(successful)}) ---')
        print(result['critique'])
        print()
    
    print('=' * 70)
    print('SUMMARY')
    print('=' * 70)
    print(f'Total time: {round(total_elapsed, 2)}s')
    print(f'Successful: {len(successful)}/{len(results)}')
    print()
    
    output_file = args.output or f'verdict-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
    output_path = Path(output_file)
    
    with open(output_path, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'source': source_desc,
            'total_elapsed_seconds': round(total_elapsed, 2),
            'successful_reviews': len(successful),
            'total_reviews': len(results),
            'results': results
        }, f, indent=2)
    
    print(f'Results saved to: {output_path.absolute()}')
    return 0 if len(successful) >= 1 else 1

if __name__ == '__main__':
    sys.exit(main())
