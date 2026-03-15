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
 * Compute word-level Jaccard similarity between two strings.
 * Returns a value between 0 (no overlap) and 1 (identical word sets).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Cluster strings by semantic similarity using Jaccard distance.
 * Strings with similarity >= threshold are placed in the same cluster.
 * Returns clusters sorted by size (largest first).
 */
function clusterBySimilarity(items: string[], threshold = 0.35): string[][] {
  const clusters: string[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [items[i]];
    assigned.add(i);

    for (let j = i + 1; j < items.length; j++) {
      if (assigned.has(j)) continue;
      if (jaccardSimilarity(items[i], items[j]) >= threshold) {
        cluster.push(items[j]);
        assigned.add(j);
      }
    }
    clusters.push(cluster);
  }

  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Build consensus from divergent model perspectives
 * KEY INNOVATION: Preserve disagreement as valuable signal
 *
 * Uses semantic similarity (Jaccard on word sets) to cluster diagnoses
 * that mean the same thing but are worded differently. For example,
 * "Port in use" and "port occupied" cluster together.
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

  // Step 1: Cluster diagnoses by semantic similarity
  const diagnoses = modelResponses.map(r => r.diagnosis);
  const diagnosisClusters = clusterBySimilarity(diagnoses);

  // The largest cluster is the consensus cluster
  const consensusCluster = new Set(diagnosisClusters[0] || []);
  const consensusDiagnosis = diagnosisClusters[0]?.[0] || 'Unknown issue';

  // Step 2: Find which models agree with consensus (diagnosis in consensus cluster)
  const agreeingModels = new Set<string>();
  for (const r of modelResponses) {
    // Check if this diagnosis is in the consensus cluster (exact match or similar)
    for (const clusterDiag of consensusCluster) {
      if (r.diagnosis === clusterDiag || jaccardSimilarity(r.diagnosis, clusterDiag) >= 0.35) {
        agreeingModels.add(r.model);
        break;
      }
    }
  }

  const agreementCount = agreeingModels.size;
  const consensusConfidence = agreementCount / modelResponses.length;

  // Step 3: Cluster suggestions similarly and pick the most common
  const consensusSuggestions = modelResponses
    .filter(r => agreeingModels.has(r.model))
    .map(r => r.suggestion);
  const suggestionClusters = clusterBySimilarity(consensusSuggestions);
  const consensusSuggestion = suggestionClusters[0]?.[0] || 'See per-model analysis below';

  // Step 4: Identify divergent perspectives (models outside consensus cluster)
  const divergentPerspectives = modelResponses
    .filter(r => !agreeingModels.has(r.model))
    .map(r => `${r.model}: "${r.diagnosis}" → "${r.suggestion}"`)
    .slice(0, 3);

  // Step 5: Build per-model analysis
  const perModelAnalysis = modelResponses.map(response => ({
    model: response.model,
    diagnosis: response.diagnosis,
    suggestion: response.suggestion,
    confidence: response.confidence,
    agreesWithConsensus: agreeingModels.has(response.model),
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
