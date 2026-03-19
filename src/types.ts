// src/types.ts - Type definitions
export interface LLMProvider {
  id: string;
  name: string;
  sendRequest(content: string, system?: string): Promise<LLMResponse>;
}

export interface LLMResponse {
  modelId: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  error?: string;
  executionTimeMs: number;
}

export interface ReviewRequest {
  content: string;
  contentHash?: string;
  strategy?: string;
  models?: string | string[];  // Preset name ('fast'|'balanced'|'thorough') or array of model IDs
  sessionId?: string;
}

export interface ReviewResult {
  reviews: Record<string, LLMResponse>;
  consensus: { agreements: string[]; disagreements: Record<string, any> };
  executionTimeMs: number;
  totalCost: number;
}
