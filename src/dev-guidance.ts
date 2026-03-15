// src/dev-guidance.ts - Developer Guidance Analysis (v0.5.2, 2026-03-15)
// Use cross-LLM consensus to help developers solve blockers

import { buildConsensus, type ConsensusVerdict } from './consensus-algorithm.js';

export interface DevelopmentProblem {
  error: string;
  context: {
    technology: string;    // e.g., "MCP Inspector", "Node.js", "Docker"
    environment: string;   // e.g., "macOS", "Linux", "Windows"
    attempts: string[];    // What's been tried
  };
  codeSnippet?: string;    // Optional: related code
}

export interface ModelPerspective {
  model: string;
  perspective: string;    // Unique angle (e.g., "kernel-level", "API contract", "macOS-specific")
  suggestion: string;
  confidence: number;     // 0-1 based on how confident this model is
}

export interface DevelopmentGuidanceResponse {
  root_cause: string;                    // Identified by consensus
  immediate_fix: string;                 // What to do RIGHT NOW
  per_model_analysis: ModelPerspective[];
  consensus_confidence: number;          // 0-1, based on agreement
  alternative_approaches: string[];      // When models disagree
  explanation: string;                   // Why this works
  timestamp: string;
}

/**
 * Analyze a development problem using cross-LLM consensus
 * 
 * Key innovation: Show DIVERGENCE, not just consensus
 * - Developers see what EACH model thinks
 * - Useful when models disagree (different angles on the problem)
 * - Helps understand problem from multiple perspectives
 */
export async function analyzeDevelopmentProblem(
  problem: DevelopmentProblem,
  reviewExecutor: any
): Promise<DevelopmentGuidanceResponse> {
  
  // Format the problem as a structured prompt for all models
  const prompt = `
You are a development expert helping a developer solve a technical blocker.

ERROR/PROBLEM:
${problem.error}

CONTEXT:
- Technology: ${problem.context.technology}
- Environment: ${problem.context.environment}
- What's been tried: ${problem.context.attempts.join(', ')}

${problem.codeSnippet ? `\nRELATED CODE:\n${problem.codeSnippet}` : ''}

TASK:
1. Diagnose the root cause (one sentence)
2. Suggest an immediate fix (one sentence, actionable)
3. Rate your confidence 0-1 based on how sure you are
4. Suggest alternatives if you're unsure

Format your response EXACTLY as JSON:
{
  "diagnosis": "root cause diagnosis here",
  "suggestion": "immediate fix here",
  "confidence": 0.85,
  "alternatives": ["alt 1", "alt 2"]
}

Be concise, direct, and practical. Assume intermediate skill level.
`;

  try {
    // Send to ReviewExecutor to get cross-model analysis
    const result = await reviewExecutor.execute({
      content: prompt,
      type: 'general',  // Not security/performance/correctness, just general guidance
    });

    // Parse the multi-model responses
    const perspectives = parseModelPerspectives(result);
    
    // Build consensus from perspectives
    const consensus = buildConsensus(perspectives.map(p => ({
      model: p.model,
      diagnosis: p.perspective,
      suggestion: p.suggestion,
      confidence: p.confidence,
      alternatives: [],
    })));

    return {
      root_cause: consensus.rootCause,
      immediate_fix: consensus.immediateFix,
      per_model_analysis: perspectives,
      consensus_confidence: consensus.confidence,
      alternative_approaches: consensus.divergentPerspectives,
      explanation: consensus.explanation,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze development problem: ${error.message}`);
  }
}

/**
 * Parse individual model perspectives from the review result
 * Each model offers a unique angle on the problem
 * 
 * ReviewExecutor returns:
 * {
 *   reviews: {
 *     "openai": { content: "{ \"diagnosis\": \"...\", ... }", ... },
 *     "gemini": { content: "```json\n{ \"diagnosis\": \"...\", ... }\n```", ... },
 *     ...
 *   },
 *   consensus: { ... },
 *   executionTimeMs: 1234,
 *   totalCost: 0.042
 * }
 */
function parseModelPerspectives(result: any): ModelPerspective[] {
  const perspectives: ModelPerspective[] = [];

  if (!result || !result.reviews || typeof result.reviews !== 'object') {
    return [{
      model: 'Error',
      perspective: 'No model responses received',
      suggestion: 'Check API keys and try again',
      confidence: 0,
    }];
  }

  // Iterate through each model's response
  for (const [modelId, response] of Object.entries(result.reviews)) {
    try {
      if (!response || typeof response !== 'object') {
        continue;
      }
      
      const resp = response as any;
      let content = resp.content;
      
      // If content is empty or error, skip
      if (!content || resp.error) {
        perspectives.push({
          model: modelId.charAt(0).toUpperCase() + modelId.slice(1),
          perspective: resp.error || 'No response',
          suggestion: 'Request failed',
          confidence: 0,
        });
        continue;
      }

      // Content should be a JSON string from the LLM
      // Some models (like Gemini) wrap JSON in ```json ``` markdown code blocks
      // Strip those before parsing
      let jsonContent = content;
      if (typeof content === 'string') {
        // Remove markdown code block wrapper if present
        jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      }
      
      // Parse the JSON
      const data = JSON.parse(jsonContent);
      
      // Extract the fields we need
      perspectives.push({
        model: modelId.charAt(0).toUpperCase() + modelId.slice(1),
        perspective: data.diagnosis || 'Unable to extract diagnosis',
        suggestion: data.suggestion || 'See diagnosis above',
        confidence: parseFloat(data.confidence) || 0.5,
      });
    } catch (e: any) {
      // If parsing fails, create a perspective with the raw response
      const resp = response as any;
      perspectives.push({
        model: modelId.charAt(0).toUpperCase() + modelId.slice(1),
        perspective: `Failed to parse: ${String(resp.content || resp).substring(0, 50)}...`,
        suggestion: 'Manual inspection recommended',
        confidence: 0.2,
      });
    }
  }

  return perspectives.length > 0 ? perspectives : [{
    model: 'Error',
    perspective: 'No valid model responses',
    suggestion: 'Check API keys and network connectivity',
    confidence: 0,
  }];
}

/**
 * Format guidance for CLI output
 */
export function formatGuidanceForCLI(guidance: DevelopmentGuidanceResponse): string {
  return `
╔════════════════════════════════════════════════════════════════╗
║           CROSS-REVIEW DEVELOPMENT GUIDANCE                    ║
╚════════════════════════════════════════════════════════════════╝

🔍 ROOT CAUSE:
${guidance.root_cause}

⚡ IMMEDIATE FIX:
${guidance.immediate_fix}

📊 CONSENSUS CONFIDENCE: ${(guidance.consensus_confidence * 100).toFixed(0)}%

📋 PER-MODEL ANALYSIS:
${guidance.per_model_analysis
  .map(
    p => `  • ${p.model} (confidence: ${(p.confidence * 100).toFixed(0)}%)
    Perspective: ${p.perspective}
    Suggestion: ${p.suggestion}`
  )
  .join('\n')}

${
  guidance.alternative_approaches.length > 0
    ? `\n🔄 ALTERNATIVE APPROACHES:\n${guidance.alternative_approaches
        .map(alt => `  • ${alt}`)
        .join('\n')}`
    : ''
}

📚 EXPLANATION:
${guidance.explanation}

⏱️  Generated: ${guidance.timestamp}
`;
}
