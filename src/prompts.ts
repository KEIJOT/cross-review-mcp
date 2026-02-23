// Cross-LLM Review Protocol - Prompt Templates (v0.2.1, 2026-02-08)
// Changes: Stronger confidence calibration for HIGH claims,
// VERDICT format reinforcement in consensus prompt,
// epistemic hedging, structured output format, confidence scoring

export const SCRUTINY_LEVELS = {
  quick: {
    name: "Quick",
    description: "Fast surface-level check for obvious issues",
    temperature: 0.3,
    maxTokens: 1000,
  },
  standard: {
    name: "Standard",
    description: "Balanced review for most content",
    temperature: 0.5,
    maxTokens: 2500,
  },
  adversarial: {
    name: "Adversarial",
    description: "Aggressive critique, assumes content is flawed",
    temperature: 0.7,
    maxTokens: 3500,
  },
  redteam: {
    name: "Red Team",
    description: "Hostile reviewer, actively tries to break arguments",
    temperature: 0.8,
    maxTokens: 4000,
  },
} as const;

export type ScrutinyLevel = keyof typeof SCRUTINY_LEVELS;

export const CONTENT_TYPES = {
  general: "General content",
  paper: "Academic or technical paper",
  code: "Source code or technical implementation",
  proposal: "Business or project proposal",
  legal: "Legal document or contract",
  medical: "Medical or health-related content",
  financial: "Financial analysis or advice",
} as const;

export type ContentType = keyof typeof CONTENT_TYPES;

export function buildAdversarialPrompt(
  content: string,
  contentType: ContentType,
  scrutinyLevel: ScrutinyLevel
): string {
  const level = SCRUTINY_LEVELS[scrutinyLevel];

  return `You are a skeptical peer reviewer. Your job is to find flaws, not praise strengths.

SCRUTINY LEVEL: ${level.name}
${level.description}

CONTENT TYPE: ${CONTENT_TYPES[contentType]}

Review the following content and identify issues in these categories:

1. **LOGICAL FLAWS**: Contradictions, unsupported claims, circular reasoning
2. **TECHNICAL ERRORS**: Factual mistakes, outdated info, incorrect terminology
3. **GAPS**: Missing information, unstated assumptions
4. **OVERCLAIMS**: Exaggerations, promises beyond evidence
5. **AMBIGUITY**: Unclear or easily misinterpreted statements

CRITICAL RULES:

- Be specific. Quote or reference the exact claim you are challenging.
- For EVERY issue you raise, you MUST state your CONFIDENCE level:
  - HIGH: You are certain this is wrong based on well-established facts
  - MEDIUM: You believe this is likely wrong but cannot verify with certainty from your training data
  - LOW: This seems potentially wrong but you are not sure — flag it for human verification
- Do NOT state corrections as fact unless you are HIGH confidence. If MEDIUM or LOW, explicitly say "This should be verified" or "I'm not certain, but..."
- Do NOT soften genuine issues — but DO distinguish between what you know and what you suspect.

CONFIDENCE CALIBRATION (READ THIS CAREFULLY):
HIGH confidence means the claim is as verifiably wrong as saying "the Earth does not orbit the Sun." Reserve HIGH strictly for issues grounded in universal, well-established facts (mathematics, physics laws, language definitions, undisputed history). If you are relying on training data about specific regulations, prices, addresses, statistics, current events, version-specific API behavior, or any domain-specific factual claim — use MEDIUM at most, even if you feel fairly sure. Overconfidence in uncertain claims actively harms the review process.
- Rate each issue severity: CRITICAL / MAJOR / MINOR
- Provide an overall severity rating at the end.

OUTPUT FORMAT (follow this exactly):

ISSUE 1:
- Category: [LOGICAL FLAW | TECHNICAL ERROR | GAP | OVERCLAIM | AMBIGUITY]
- Severity: [CRITICAL | MAJOR | MINOR]
- Confidence: [HIGH | MEDIUM | LOW]
- Claim reviewed: [quote or reference the specific claim]
- Problem: [describe the issue]
- Suggested fix: [if applicable]

ISSUE 2:
[same format]

OVERALL SEVERITY: [CRITICAL | MAJOR | MINOR | NONE]
ISSUE COUNT: [number of issues by severity, e.g. "1 CRITICAL, 2 MAJOR, 3 MINOR"]

${getContentTypeSpecificInstructions(contentType)}

---

CONTENT TO REVIEW:

${content}`;
}

function getContentTypeSpecificInstructions(contentType: ContentType): string {
  switch (contentType) {
    case "paper":
      return `
ADDITIONAL CHECKS FOR ACADEMIC/TECHNICAL PAPERS:
- Are claims properly supported by evidence or citations?
- Is the methodology sound?
- Are limitations acknowledged?
- Could results be replicated based on the description?
- Are there selection biases or confounding factors?`;

    case "code":
      return `
ADDITIONAL CHECKS FOR CODE:
- Are there edge cases not handled?
- Are there security vulnerabilities?
- Is error handling adequate?
- Are there performance issues?
- Is the code maintainable and readable?`;

    case "proposal":
      return `
ADDITIONAL CHECKS FOR PROPOSALS:
- Are timelines realistic?
- Are costs accurately estimated?
- Are risks identified and mitigated?
- Is the value proposition clear?
- Are dependencies and assumptions explicit?`;

    case "legal":
      return `
ADDITIONAL CHECKS FOR LEGAL CONTENT:
- Are terms precisely defined?
- Are there loopholes or ambiguities?
- Is jurisdiction clear?
- Are obligations symmetric and fair?
- Are edge cases covered?`;

    case "medical":
      return `
ADDITIONAL CHECKS FOR MEDICAL CONTENT:
- Are claims evidence-based?
- Are risks and side effects mentioned?
- Is the information current?
- Are individual variations acknowledged?
- Is professional consultation recommended where appropriate?`;

    case "financial":
      return `
ADDITIONAL CHECKS FOR FINANCIAL CONTENT:
- Are projections realistic?
- Are risks adequately disclosed?
- Is historical performance properly contextualized?
- Are fees and costs transparent?
- Are assumptions clearly stated?`;

    default:
      return "";
  }
}

export function buildConsensusPrompt(
  critiques: Array<{ model: string; critique: string }>
): string {
  const critiquesList = critiques
    .map((c) => `=== ${c.model} ===\n${c.critique}`)
    .join("\n\n");

  const modelNames = critiques.map((c) => c.model).join(", ");

  return `You are a neutral arbitrator analyzing peer reviews from multiple AI models (${modelNames}).
Your job is to synthesize their findings into a fair, evidence-weighted assessment.

CRITICAL RULES:

1. CONSENSUS ISSUES carry HIGH weight — if multiple reviewers independently found the same problem, it is very likely a real issue.

2. SINGLE-MODEL ISSUES carry LOWER weight — if only one reviewer flagged something, especially with LOW or MEDIUM confidence, it may be a false positive from that model's training data. Flag these clearly as "single-model, needs verification."

3. CONFLICTING CLAIMS: If one reviewer says X is wrong and another doesn't mention it, DO NOT automatically assume the critic is right. The non-mention could mean the other model verified it as correct or simply didn't check.

4. CONFIDENCE MATTERS: An issue flagged as HIGH confidence by both models is much more significant than a MEDIUM confidence issue from one model.

5. YOUR VERDICT must be based on the WEIGHT OF EVIDENCE, not the most alarming claim:
   - PROCEED: No consensus issues above MINOR severity
   - REVISE: One or more MAJOR consensus issues, or multiple MINOR consensus issues
   - ABORT: One or more CRITICAL consensus issues (both models agree it's critically wrong)
   
   Single-model CRITICAL claims should NOT trigger ABORT — they should trigger REVISE with a note to verify.

OUTPUT FORMAT (follow exactly):

VERDICT: [PROCEED | REVISE | ABORT]

CONSENSUS ISSUES (agreed by multiple reviewers):
[List each issue with: severity, which models agreed, confidence levels]
If none: "None identified."

SINGLE-MODEL FLAGS (raised by only one reviewer — verify before acting):
[List each with: which model raised it, their confidence, why others may have missed it]
If none: "None identified."

DISPUTED OR CONTRADICTORY:
[Any cases where reviewers disagree on a specific claim]
If none: "None identified."

SUMMARY:
[2-3 sentence overall assessment with recommended actions]

REMINDER: You MUST start your response with "VERDICT: " followed by exactly one of PROCEED, REVISE, or ABORT on the first line. Do not add any text before the VERDICT line.

---

CRITIQUES TO ANALYZE:

${critiquesList}`;
}
