#!/usr/bin/env python3
# pre_commit_claim_validator.py (v1.0.0, 2026-03-14)
"""
Pre-Commit Claim Validator

Runs before commits to validate claims about code changes.
Blocks commits if claims don't match the actual code changes.

Usage in .git/hooks/pre-commit:
  #!/bin/bash
  python3 /path/to/pre_commit_claim_validator.py

Configuration file (.claimrc.json):
  {
    "claims": [
      {
        "name": "ConfigHelper type safety",
        "claim": "ConfigHelper safely converts all user input types",
        "scope": "backend/config_helper.py",
        "strict": true
      },
      {
        "name": "JWT validation completeness",
        "claim": "WebSocket JWT validation is complete and cannot be bypassed",
        "scope": "backend/socket_events.py",
        "strict": true
      }
    ]
  }
"""

import os
import json
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict

# Load .env BEFORE importing litellm
from dotenv import load_dotenv
load_dotenv(Path.home() / '.env')
load_dotenv(Path.home() / '.env.local')
load_dotenv(Path.cwd() / '.env')

from litellm import completion

MODELS = [
    ('Gemini 2.5 Flash', 'gemini/gemini-2.5-flash', 30),
    ('Mistral Large', 'mistral/mistral-large-latest', 90),
]

SYSTEM_PROMPT = """You are a rigorous code reviewer validating claims about changes.

Your job: Given a claim and code evidence, determine if the claim is TRUE or FALSE.

Rules:
1. ONLY evaluate what you see in the evidence. Do NOT hallucinate.
2. If evidence is incomplete, SAY SO explicitly.
3. Rate your confidence: HIGH / MEDIUM / LOW.
4. Be BINARY: Is the claim TRUE or FALSE?
5. Flag any assumptions you're making.

For pre-commit validation:
- TRUE claim = change is SAFE to commit
- FALSE claim = change should be BLOCKED (requires fixes)

If you see prior reasoning: validate, challenge, build consensus."""


def load_claims_config() -> List[Dict]:
    """Load claims configuration from .claimrc.json"""
    config_paths = [
        Path.cwd() / '.claimrc.json',
        Path.cwd() / '.claimrc',
        Path.home() / '.claimrc.json',
    ]
    
    for config_path in config_paths:
        if config_path.exists():
            with open(config_path, 'r') as f:
                return json.load(f).get('claims', [])
    
    return []


def get_changed_files() -> List[str]:
    """Get list of files changed in git staging area"""
    import subprocess
    
    try:
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip().split('\n') if result.stdout.strip() else []
    except Exception as e:
        print(f"Warning: Could not get git diff: {e}", file=sys.stderr)
        return []


def load_evidence(scope: str) -> str:
    """Load evidence from scope (file or directory)"""
    p = Path(scope)
    
    if not p.exists():
        raise FileNotFoundError(f"Scope not found: {scope}")
    
    if p.is_file():
        with open(p, 'r') as f:
            return f.read()
    elif p.is_dir():
        files = []
        for py_file in sorted(p.glob("*.py"))[:5]:
            try:
                with open(py_file, 'r') as f:
                    content = f.read()
                    files.append(f"=== {py_file.name} ===\n{content}\n")
            except Exception as e:
                files.append(f"[ERROR reading {py_file.name}: {e}]\n")
        
        if not files:
            raise ValueError(f"No Python files found in {scope}")
        return "\n".join(files)
    else:
        raise ValueError(f"Invalid scope: {scope}")


def validate_claim(claim: str, model_name: str, model_id: str, evidence: str, 
                   previous_reasoning: List = None, timeout: int = 30) -> Dict:
    """Validate a claim against evidence"""
    start_time = time.time()
    
    if previous_reasoning:
        prior_text = "\n\n".join([f"=== {name} ===\n{reasoning}" for name, reasoning in previous_reasoning])
        prompt = f"""PREVIOUS EVALUATION:
{prior_text}

---

CLAIM TO VALIDATE:
{claim}

---

EVIDENCE:
{evidence}

---

Provide YOUR evaluation. Build on prior reasoning. Is the claim TRUE or FALSE?"""
    else:
        prompt = f"""CLAIM TO VALIDATE:
{claim}

---

EVIDENCE:
{evidence}

---

Is this claim TRUE or FALSE based on the evidence?"""
    
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
        
        # Determine if claim is TRUE or FALSE based on response
        reasoning_lower = reasoning.lower()
        is_true = "true" in reasoning_lower and "false" not in reasoning_lower or \
                  reasoning_lower.count("true") > reasoning_lower.count("false")
        
        return {
            'model': model_name,
            'status': 'success',
            'reasoning': reasoning,
            'is_true': is_true,
            'elapsed_seconds': round(elapsed, 2),
            'tokens_used': response.usage.total_tokens if hasattr(response, 'usage') else 0
        }
    
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            'model': model_name,
            'status': 'error',
            'error': str(e),
            'is_true': None,
            'elapsed_seconds': round(elapsed, 2)
        }


def validate_claims_for_commit() -> bool:
    """
    Validate all claims for files in git staging area.
    Returns True if all claims pass, False if any fail.
    """
    claims = load_claims_config()
    if not claims:
        print("No claims configured. Skipping validation.")
        return True
    
    changed_files = get_changed_files()
    if not changed_files:
        print("No changed files. Skipping validation.")
        return True
    
    print('=' * 70)
    print('PRE-COMMIT CLAIM VALIDATOR')
    print('=' * 70)
    print(f'Changed files: {len(changed_files)}')
    print(f'Claims to validate: {len(claims)}')
    print()
    
    # Filter claims relevant to changed files
    relevant_claims = []
    for claim in claims:
        scope = claim.get('scope', '')
        if any(scope in cf or cf in scope for cf in changed_files):
            relevant_claims.append(claim)
    
    if not relevant_claims:
        print(f"No relevant claims for changed files. Proceeding with commit.")
        return True
    
    all_passed = True
    results = []
    
    for claim_config in relevant_claims:
        claim_name = claim_config.get('name', 'Unknown')
        claim_text = claim_config.get('claim', '')
        scope = claim_config.get('scope', '')
        is_strict = claim_config.get('strict', True)
        
        print(f"Validating: {claim_name}")
        print(f"  Claim: {claim_text}")
        print(f"  Scope: {scope}")
        
        try:
            evidence = load_evidence(scope)
        except Exception as e:
            print(f"  ERROR: Could not load evidence: {e}")
            if is_strict:
                all_passed = False
            continue
        
        # Sequential validation
        evaluations = []
        previous_reasoning = []
        
        for model_name, model_id, timeout in MODELS:
            result = validate_claim(claim_text, model_name, model_id, evidence, 
                                   previous_reasoning=previous_reasoning, timeout=timeout)
            evaluations.append(result)
            
            if result['status'] == 'success':
                previous_reasoning.append((model_name, result['reasoning']))
                is_true = result['is_true']
                print(f"    {model_name}: {'✓ TRUE' if is_true else '✗ FALSE'}")
            else:
                print(f"    {model_name}: ERROR - {result['error']}")
        
        # Determine if claim passed (all models agree TRUE)
        successful = [e for e in evaluations if e['status'] == 'success']
        if successful:
            claim_passed = all(e['is_true'] for e in successful)
            if not claim_passed:
                print(f"  RESULT: CLAIM FALSE - Commit will be BLOCKED")
                all_passed = False
            else:
                print(f"  RESULT: CLAIM TRUE - OK to commit")
        else:
            print(f"  RESULT: Validation failed - cannot determine")
            if is_strict:
                all_passed = False
        
        results.append({
            'name': claim_name,
            'claim': claim_text,
            'passed': claim_passed if successful else None,
            'evaluations': evaluations
        })
        print()
    
    # Summary
    print('=' * 70)
    print('SUMMARY')
    print('=' * 70)
    passed = sum(1 for r in results if r['passed'] is True)
    failed = sum(1 for r in results if r['passed'] is False)
    uncertain = sum(1 for r in results if r['passed'] is None)
    
    print(f'Passed:   {passed}')
    print(f'Failed:   {failed}')
    print(f'Uncertain: {uncertain}')
    print()
    
    if all_passed:
        print("✓ All claims validated. Commit APPROVED.")
        return True
    else:
        print("✗ Some claims failed or could not be validated. Commit BLOCKED.")
        print()
        print("To bypass validation (not recommended):")
        print("  git commit --no-verify")
        return False


def main():
    """Run pre-commit validation"""
    try:
        all_passed = validate_claims_for_commit()
        sys.exit(0 if all_passed else 1)
    except Exception as e:
        print(f"FATAL ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
