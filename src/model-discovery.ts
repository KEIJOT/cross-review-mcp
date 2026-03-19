// src/model-discovery.ts — Discover, test, and swap LLM provider models
// Searches OpenRouter's free/paid model catalog and tests candidates against the live API

import * as fs from 'fs';
import { loadConfig, type ReviewerConfig } from './config.js';
import { log } from './logger.js';

export interface DiscoveredModel {
  id: string;
  name: string;
  contextLength: number;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  provider?: string;
}

export interface TestResult {
  modelId: string;
  success: boolean;
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

export interface SearchOptions {
  query?: string;
  freeOnly?: boolean;
  minContextLength?: number;
  maxResults?: number;
}

export interface SwapResult {
  success: boolean;
  oldModel: string;
  newModel: string;
  reviewerId: string;
  message: string;
}

/**
 * Search available models on OpenRouter.
 * OpenRouter provides the broadest catalog of models accessible via a single API key.
 */
export async function searchModels(options: SearchOptions = {}): Promise<DiscoveredModel[]> {
  const { query, freeOnly = false, minContextLength = 0, maxResults = 20 } = options;

  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) {
    throw new Error(`OpenRouter API error: HTTP ${response.status}`);
  }

  const data = await response.json() as any;
  let models: DiscoveredModel[] = (data.data || []).map((m: any) => {
    const promptCost = parseFloat(m.pricing?.prompt || '0');
    const completionCost = parseFloat(m.pricing?.completion || '0');
    return {
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || 0,
      pricing: { prompt: promptCost, completion: completionCost },
      isFree: promptCost === 0 && completionCost === 0,
      provider: m.id.split('/')[0],
    };
  });

  // Apply filters
  if (freeOnly) {
    models = models.filter(m => m.isFree);
  }
  if (minContextLength > 0) {
    models = models.filter(m => m.contextLength >= minContextLength);
  }
  if (query) {
    const q = query.toLowerCase();
    models = models.filter(m =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.provider && m.provider.toLowerCase().includes(q))
    );
  }

  // Sort: free first, then by context length descending
  models.sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return b.contextLength - a.contextLength;
  });

  return models.slice(0, maxResults);
}

/**
 * Test a specific model by sending a simple prompt and measuring the response.
 */
export async function testModel(
  modelId: string,
  apiKey: string,
  baseUrl: string = 'https://openrouter.ai/api/v1',
): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://github.com/cross-review-mcp';
      headers['X-Title'] = 'Cross-Review MCP';
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Respond with exactly one sentence identifying yourself.' }],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    const data = await response.json() as any;
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        modelId,
        success: false,
        content: '',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        error: data.error?.message || `HTTP ${response.status}`,
      };
    }

    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    if (!content.trim()) {
      return {
        modelId,
        success: false,
        content: '',
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        latencyMs,
        error: 'Empty response (model returned no content)',
      };
    }

    return {
      modelId,
      success: true,
      content: content.trim(),
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      latencyMs,
    };
  } catch (error) {
    return {
      modelId,
      success: false,
      content: '',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startTime,
      error: String(error),
    };
  }
}

/**
 * Swap a reviewer's model in the config file.
 * Optionally tests the new model before writing the config.
 */
export async function swapModel(
  reviewerId: string,
  newModelId: string,
  options: {
    configPath?: string;
    testFirst?: boolean;
    apiKey?: string;
    baseUrl?: string;
    newName?: string;
  } = {},
): Promise<SwapResult> {
  const {
    configPath = './llmapi.config.json',
    testFirst = true,
    baseUrl = 'https://openrouter.ai/api/v1',
  } = options;

  // Load raw config (not validated, so we can modify and rewrite)
  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const reviewer = rawConfig.reviewers?.find((r: any) => r.id === reviewerId);

  if (!reviewer) {
    return {
      success: false,
      oldModel: '',
      newModel: newModelId,
      reviewerId,
      message: `Reviewer "${reviewerId}" not found in config`,
    };
  }

  // Resolve API key
  const apiKeyEnv = reviewer.apiKeyEnv || `${reviewerId.toUpperCase()}_API_KEY`;
  const apiKey = options.apiKey || process.env[apiKeyEnv];

  if (testFirst) {
    if (!apiKey) {
      return {
        success: false,
        oldModel: reviewer.model,
        newModel: newModelId,
        reviewerId,
        message: `Cannot test: no API key found (checked ${apiKeyEnv})`,
      };
    }

    const testResult = await testModel(newModelId, apiKey, baseUrl);
    if (!testResult.success) {
      return {
        success: false,
        oldModel: reviewer.model,
        newModel: newModelId,
        reviewerId,
        message: `Model test failed: ${testResult.error}`,
      };
    }

    log('info', 'model-discovery', `Test passed: ${newModelId} responded in ${testResult.latencyMs}ms`);
  }

  // Perform the swap
  const oldModel = reviewer.model;
  reviewer.model = newModelId;
  if (baseUrl) reviewer.baseUrl = baseUrl;
  if (options.newName) reviewer.name = options.newName;

  // Update cost to $0 if it's a free OpenRouter model
  if (newModelId.endsWith(':free') || newModelId === 'openrouter/free') {
    if (rawConfig.costs?.models?.[reviewerId]) {
      rawConfig.costs.models[reviewerId] = { input_per_1m: 0, output_per_1m: 0 };
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(rawConfig, null, 2) + '\n');

  return {
    success: true,
    oldModel,
    newModel: newModelId,
    reviewerId,
    message: `Swapped ${reviewerId}: ${oldModel} → ${newModelId}`,
  };
}

/**
 * Search, test, and return recommendations for replacing a failing/underperforming model.
 * This is the high-level "find me a replacement" function.
 */
export async function findReplacement(
  reviewerId: string,
  options: {
    freeOnly?: boolean;
    minContextLength?: number;
    maxCandidates?: number;
    configPath?: string;
  } = {},
): Promise<{
  candidates: Array<TestResult & { model: DiscoveredModel }>;
  recommended: (TestResult & { model: DiscoveredModel }) | null;
}> {
  const {
    freeOnly = true,
    minContextLength = 32000,
    maxCandidates = 5,
    configPath = './llmapi.config.json',
  } = options;

  // Load config to get the reviewer's API key
  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const reviewer = rawConfig.reviewers?.find((r: any) => r.id === reviewerId);
  const apiKeyEnv = reviewer?.apiKeyEnv || `${reviewerId.toUpperCase()}_API_KEY`;
  const apiKey = process.env['OPENROUTER_API_KEY'] || process.env[apiKeyEnv];

  if (!apiKey) {
    throw new Error(`No API key found for testing (checked OPENROUTER_API_KEY, ${apiKeyEnv})`);
  }

  // Search for candidates
  const models = await searchModels({ freeOnly, minContextLength, maxResults: maxCandidates * 2 });

  // Test top candidates in parallel
  const candidates: Array<TestResult & { model: DiscoveredModel }> = [];
  const testPromises = models.slice(0, maxCandidates).map(async (model) => {
    const result = await testModel(model.id, apiKey);
    return { ...result, model };
  });

  const results = await Promise.all(testPromises);
  for (const result of results) {
    candidates.push(result);
  }

  // Sort by: success first, then by latency
  candidates.sort((a, b) => {
    if (a.success !== b.success) return a.success ? -1 : 1;
    return a.latencyMs - b.latencyMs;
  });

  const recommended = candidates.find(c => c.success) || null;

  return { candidates, recommended };
}
