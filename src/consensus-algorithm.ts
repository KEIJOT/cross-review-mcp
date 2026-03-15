// src/consensus-algorithm.ts - Cross-LLM Consensus Algorithm
// Analyzes responses from multiple models and builds a unified verdict

export interface ModelResponse {
  model: string;
  diagnosis: string;
  suggestion: string;
  confidence: number;  // 0-1
  alternatives: string[];
}

export interface ConsensusVerdict {
  rootCause: string;
  immediateFix: string;
  confidence: number;  // 0-1, based on agreement
  perModelAnalysis: {
    model: string;
    diagnosis: string;
    suggestion: string;
    confidence: number;
    agreesWithConsensus: boolean;
  }[];
  divergentPerspectives: string[];  // When models disagree (valuable!)
  explanation: string;
}

/**
 * Build consensus from divergent model perspectives
 * KEY INNOVATION: Preserve disagreement as valuable signal
 * 
 * Instead of averaging or voting, we:
 * 1. Find the most common diagnosis
 * 2. Track which models agree/disagree
 * 3. Return both consensus AND disagreement
 * 4. Let developers learn from multiple angles
 */
export function buildConsensus(modelResponses: ModelResponse[]): ConsensusVerdict {
  if (modelResponses.length === 0) {
    return {
      rootCause: 'Unable to analyze: no model responses received',
      immediateFix: 'Please check your API keys and try again',
      confidence: 0,
      perModelAnalysis: [],
      divergentPerspectives: [],
      explanation: 'No models were able to respond',
    };
  }

  // Step 1: Find most common diagnosis (consensus)
  const diagnosisFrequency = new Map<string, number>();
  modelResponses.forEach(response => {
    const count = diagnosisFrequency.get(response.diagnosis) || 0;
    diagnosisFrequency.set(response.diagnosis, count + 1);
  });

  const sortedDiagnoses = Array.from(diagnosisFrequency.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const consensusDiagnosis = sortedDiagnoses[0]?.[0] || 'Unknown issue';
  const agreementCount = sortedDiagnoses[0]?.[1] || 0;
  const consensusConfidence = agreementCount / modelResponses.length;

  // Step 2: Find most common suggestion
  const suggestionFrequency = new Map<string, number>();
  modelResponses.forEach(response => {
    const count = suggestionFrequency.get(response.suggestion) || 0;
    suggestionFrequency.set(response.suggestion, count + 1);
  });

  const sortedSuggestions = Array.from(suggestionFrequency.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const consensusSuggestion = sortedSuggestions[0]?.[0] || 'See per-model analysis below';

  // Step 3: Find the model(s) that gave the consensus response
  const consensusModel = modelResponses.find(
    r => r.diagnosis === consensusDiagnosis && r.suggestion === consensusSuggestion
  ) || modelResponses[0];

  // Step 4: Identify divergent perspectives (models that disagree)
  const divergentPerspectives = modelResponses
    .filter(r => r.diagnosis !== consensusDiagnosis)
    .map(r => `${r.model}: "${r.diagnosis}" → "${r.suggestion}"`)
    .slice(0, 3);  // Show top 3 disagreements

  // Step 5: Build per-model analysis
  const perModelAnalysis = modelResponses.map(response => ({
    model: response.model,
    diagnosis: response.diagnosis,
    suggestion: response.suggestion,
    confidence: response.confidence,
    agreesWithConsensus: response.diagnosis === consensusDiagnosis,
  }));

  // Step 6: Build explanation
  const explanation = buildExplanation(
    consensusDiagnosis,
    consensusSuggestion,
    consensusConfidence,
    perModelAnalysis.length,
    divergentPerspectives.length > 0
  );

  return {
    rootCause: consensusDiagnosis,
    immediateFix: consensusSuggestion,
    confidence: consensusConfidence,
    perModelAnalysis,
    divergentPerspectives,
    explanation,
  };
}

/**
 * Build a human-readable explanation of the consensus
 */
function buildExplanation(
  diagnosis: string,
  suggestion: string,
  confidence: number,
  totalModels: number,
  hasDisagreement: boolean
): string {
  const confidencePercent = Math.round(confidence * 100);
  
  let explanation = `${confidencePercent}% of models agree: ${diagnosis}. `;
  explanation += `Recommended action: ${suggestion}. `;
  
  if (hasDisagreement) {
    explanation += `Note: Some models suggest alternative approaches (see divergent perspectives). `;
    explanation += `Consider trying the immediate fix first; if it doesn't work, try the alternatives.`;
  } else {
    explanation += `All models align on this diagnosis.`;
  }

  return explanation;
}

/**
 * Score individual model responses based on calibration
 * Higher confidence if model admits uncertainty appropriately
 */
export function scoreModelResponse(response: ModelResponse, consensus: string): number {
  let score = response.confidence;

  // Bonus: if model agrees with consensus, confidence is typically higher
  // Penalty: if model disagrees but is highly confident (overconfidence risk)
  const agreesFactor = response.diagnosis === consensus ? 1.1 : 0.9;
  score = Math.min(1.0, score * agreesFactor);

  return score;
}

/**
 * Detect when models have fundamentally different interpretations
 * This is VALUABLE, not a problem
 */
export function detectParadigmShift(models: ModelResponse[]): {
  hasShift: boolean;
  shift?: {
    perspective1: string;
    perspective2: string;
  };
} {
  if (models.length < 2) {
    return { hasShift: false };
  }

  // Check if top 2 diagnoses are significantly different
  const unique = new Set(models.map(m => m.diagnosis));
  if (unique.size >= 2) {
    const [first, second] = Array.from(unique);
    return {
      hasShift: true,
      shift: {
        perspective1: first,
        perspective2: second,
      },
    };
  }

  return { hasShift: false };
}

/**
 * Format consensus for CLI output (beautiful formatting)
 */
export function formatConsensusForCLI(verdict: ConsensusVerdict): string {
  return `
╔════════════════════════════════════════════════════════════════╗
║           CROSS-REVIEW CONSENSUS VERDICT                       ║
╚════════════════════════════════════════════════════════════════╝

🔍 ROOT CAUSE:
${verdict.rootCause}

⚡ IMMEDIATE FIX:
${verdict.immediateFix}

📊 CONFIDENCE: ${(verdict.confidence * 100).toFixed(0)}%

📋 PER-MODEL ANALYSIS:
${verdict.perModelAnalysis
  .map(
    analysis => `
  • ${analysis.model.toUpperCase()} ${analysis.agreesWithConsensus ? '✓' : '✗'}
    Confidence: ${(analysis.confidence * 100).toFixed(0)}%
    Diagnosis: ${analysis.diagnosis}
    Fix: ${analysis.suggestion}`
  )
  .join('')}

${
  verdict.divergentPerspectives.length > 0
    ? `\n🔄 ALTERNATIVE PERSPECTIVES (When models disagree):
${verdict.divergentPerspectives.map(p => `  • ${p}`).join('\n')}`
    : ''
}

📚 EXPLANATION:
${verdict.explanation}

════════════════════════════════════════════════════════════════
`;
}
