// src/executor.ts - Review execution engine
import crypto from 'crypto';
import { Config } from './config.js';
import { ReviewRequest, ReviewResult, LLMResponse } from './types.js';
import { createProvider, LLMProvider } from './providers.js';
import { TokenTracker } from './tracking.js';
import { CacheManager } from './cache.js';
import { CostManager } from './cost-manager.js';
import { eventBus, type ModelResultSummary } from './events.js';
import { log } from './logger.js';
import { findReplacement, type DiscoveredModel } from './model-discovery.js';

// Retry config for transient failures
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 1;

function isRetryable(error: string): boolean {
  // Retry on network errors and 5xx server errors, not on 4xx (auth, rate limit)
  const retryablePatterns = [
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
    'fetch failed', 'network', 'socket hang up',
    '500', '502', '503', '504', 'Internal Server Error',
    'Bad Gateway', 'Service Unavailable', 'Gateway Timeout',
  ];
  const lower = error.toLowerCase();
  return retryablePatterns.some(p => lower.includes(p.toLowerCase()));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type FailureReason = 'token_limit' | 'rate_limit' | 'empty_response' | 'network' | 'unknown';

function classifyFailure(error: string, outputTokens: number, inputTokens: number): FailureReason {
  if (outputTokens === 0 && inputTokens > 0) return 'token_limit';
  if (/rate|429/i.test(error)) return 'rate_limit';
  if (/empty response/i.test(error)) return 'empty_response';
  if (isRetryable(error)) return 'network';
  return 'unknown';
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Model presets — sorted by cost (cheapest first based on typical config pricing)
const MODEL_PRESETS: Record<string, { count: number; prefer: 'cheapest' | 'all' }> = {
  fast: { count: 2, prefer: 'cheapest' },
  balanced: { count: 3, prefer: 'cheapest' },
  thorough: { count: Infinity, prefer: 'all' },
};

export class ReviewExecutor {
  private config: Config;
  private tracker: TokenTracker;
  private cache: CacheManager | null;
  private costManager: CostManager | null;
  private providers: Map<string, LLMProvider> = new Map();

  constructor(
    config: Config,
    tracker: TokenTracker,
    cache?: CacheManager,
    costManager?: CostManager,
  ) {
    this.config = config;
    this.tracker = tracker;
    this.cache = cache || null;
    this.costManager = costManager || null;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const reviewer of this.config.reviewers) {
      const envKey = reviewer.apiKeyEnv || `${reviewer.id.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envKey];
      if (!apiKey) {
        log('info', 'executor', `Skipping ${reviewer.id}: no API key (${envKey})`);
        continue;
      }
      const provider = createProvider(reviewer, apiKey);
      this.providers.set(reviewer.id, provider);
      log('info', 'executor', `Initialized provider: ${reviewer.id}`);
    }
    log('info', 'executor', `${this.providers.size} providers ready`);
  }

  /**
   * Resolve which providers to use for a request.
   * Supports preset names ('fast', 'balanced', 'thorough') or explicit model ID arrays.
   */
  private resolveProviders(models?: string | string[]): Map<string, LLMProvider> {
    if (!models) return this.providers;

    if (typeof models === 'string') {
      // Preset name
      const preset = MODEL_PRESETS[models];
      if (!preset) {
        log('warn', 'executor', `Unknown preset "${models}", using all providers`);
        return this.providers;
      }
      if (preset.count >= this.providers.size) return this.providers;

      // Sort providers by cost (cheapest first) using config costs
      const sorted = Array.from(this.providers.entries()).sort((a, b) => {
        const costA = this.config.costs.models[a[0]];
        const costB = this.config.costs.models[b[0]];
        const totalA = (costA?.input_per_1m || 0) + (costA?.output_per_1m || 0);
        const totalB = (costB?.input_per_1m || 0) + (costB?.output_per_1m || 0);
        return totalA - totalB;
      });

      return new Map(sorted.slice(0, preset.count));
    }

    // Explicit array of model IDs
    const selected = new Map<string, LLMProvider>();
    for (const id of models) {
      const provider = this.providers.get(id);
      if (provider) {
        selected.set(id, provider);
      } else {
        log('warn', 'executor', `Requested model "${id}" not available, skipping`);
      }
    }
    return selected.size > 0 ? selected : this.providers;
  }

  private generateContentHash(content: string, type?: string): string {
    return crypto.createHash('sha256')
      .update(content + (type || ''))
      .digest('hex')
      .substring(0, 16);
  }

  async execute(request: ReviewRequest): Promise<ReviewResult> {
    const startTime = Date.now();
    const requestId = eventBus.generateRequestId();
    const reviewType = (request as any).type || 'general';
    const contentHash = request.contentHash || this.generateContentHash(request.content, reviewType);

    // Resolve which providers to use for this request
    const activeProviders = this.resolveProviders(request.models);

    log('info', 'executor', `Request ${requestId.slice(0, 8)}: type=${reviewType}, content=${request.content.length} chars, models=${activeProviders.size}/${this.providers.size}`);

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(request.content, reviewType);
      if (cached) {
        log('info', 'executor', `Cache hit for ${requestId.slice(0, 8)}`);
        // Emit events so cached requests are logged too
        eventBus.emitRequestStart({
          requestId,
          timestamp: new Date().toISOString(),
          contentLength: request.content.length,
          contentPreview: request.content.substring(0, 200),
          type: reviewType,
          models: Array.from(activeProviders.keys()),
          sessionId: request.sessionId,
        });
        eventBus.emitRequestComplete({
          requestId,
          timestamp: new Date().toISOString(),
          executionTimeMs: 0,
          totalCost: 0,
          modelCount: Object.keys(cached.reviews || {}).length,
          successCount: Object.keys(cached.reviews || {}).length,
          cacheHit: true,
        });
        return cached;
      }
      log('debug', 'executor', `Cache miss for ${requestId.slice(0, 8)}`);
    }

    const responses = new Map<string, LLMResponse>();

    // Emit request start
    eventBus.emitRequestStart({
      requestId,
      timestamp: new Date().toISOString(),
      contentLength: request.content.length,
      contentPreview: request.content.substring(0, 200),
      type: reviewType,
      models: Array.from(activeProviders.keys()),
      sessionId: request.sessionId,
    });

    // Execute selected providers with retry and zero-token detection
    const promises = Array.from(activeProviders.entries()).map(async ([id, provider]) => {
      const modelStart = Date.now();
      let lastError: string | undefined;

      // Proactive skip: if estimated tokens > 80% of model's context window, skip to fallback
      const reviewer = this.config.reviewers.find(r => r.id === id);
      const contextLength = reviewer?.contextLength;
      const estimatedInputTokens = estimateTokens(request.content);

      if (contextLength && estimatedInputTokens > contextLength * 0.8) {
        log('warn', 'executor', `${id}: proactive skip — estimated ${estimatedInputTokens} tokens > 80% of ${contextLength} context window`);
        const fallbackResponse = await this.attemptFallback(id, 'token_limit', estimatedInputTokens, request, activeProviders, requestId, modelStart);
        if (fallbackResponse) {
          responses.set(id, fallbackResponse);
          eventBus.emitModelComplete({
            requestId,
            modelId: fallbackResponse.modelId,
            timestamp: new Date().toISOString(),
            success: true,
            inputTokens: fallbackResponse.inputTokens,
            outputTokens: fallbackResponse.outputTokens,
            executionTimeMs: fallbackResponse.executionTimeMs || (Date.now() - modelStart),
          });
          return;
        }
        // No fallback available — write error
        const proactiveError = `Proactive skip: prompt too large for context window (${estimatedInputTokens}/${contextLength} tokens)`;
        const errorResponse: LLMResponse = {
          modelId: id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: proactiveError,
          executionTimeMs: Date.now() - modelStart,
        };
        responses.set(id, errorResponse);
        eventBus.emitModelComplete({
          requestId,
          modelId: id,
          timestamp: new Date().toISOString(),
          success: false,
          inputTokens: 0,
          outputTokens: 0,
          executionTimeMs: Date.now() - modelStart,
          error: proactiveError,
        });
        return;
      }

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            log('info', 'executor', `${id} retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms`);
            await delay(RETRY_DELAY_MS);
          }

          const response = await provider.sendRequest(request.content, '');

          // Zero-token detection: if model returns 0 output tokens and empty content, treat as failure
          if (response.outputTokens === 0 && (!response.content || response.content.trim() === '')) {
            const emptyError = `Empty response from model (0 output tokens, no content)`;
            log('warn', 'executor', `${id}: ${emptyError}`);

            // Retry if we have attempts left
            if (attempt < MAX_RETRIES) {
              lastError = emptyError;
              continue;
            }

            // Final attempt still empty — attempt adaptive fallback
            const emptyReason = classifyFailure(emptyError, response.outputTokens, response.inputTokens);
            const emptyFallback = await this.attemptFallback(id, emptyReason, estimatedInputTokens, request, activeProviders, requestId, modelStart);
            if (emptyFallback) {
              responses.set(id, emptyFallback);
              eventBus.emitModelComplete({
                requestId,
                modelId: emptyFallback.modelId,
                timestamp: new Date().toISOString(),
                success: true,
                inputTokens: emptyFallback.inputTokens,
                outputTokens: emptyFallback.outputTokens,
                executionTimeMs: emptyFallback.executionTimeMs || (Date.now() - modelStart),
              });
              return;
            }
            // No fallback — write original error
            const errorResponse: LLMResponse = {
              modelId: id,
              content: '',
              inputTokens: response.inputTokens,
              outputTokens: 0,
              finishReason: 'error',
              error: emptyError,
              executionTimeMs: Date.now() - modelStart,
            };
            responses.set(id, errorResponse);
            eventBus.emitModelComplete({
              requestId,
              modelId: id,
              timestamp: new Date().toISOString(),
              success: false,
              inputTokens: response.inputTokens,
              outputTokens: 0,
              executionTimeMs: Date.now() - modelStart,
              error: emptyError,
            });
            return;
          }

          responses.set(id, response);

          // Track cost per model
          if (this.costManager) {
            this.costManager.trackUsage(id, response.inputTokens, response.outputTokens);
          }

          eventBus.emitModelComplete({
            requestId,
            modelId: id,
            timestamp: new Date().toISOString(),
            success: true,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            executionTimeMs: response.executionTimeMs || (Date.now() - modelStart),
          });
          log('info', 'executor', `${id} completed: ${response.inputTokens}in/${response.outputTokens}out tokens, ${Date.now() - modelStart}ms`);
          return; // Success — exit retry loop
        } catch (error) {
          lastError = String(error);

          // Only retry on transient errors
          if (attempt < MAX_RETRIES && isRetryable(lastError)) {
            continue;
          }

          // Final attempt or non-retryable error — attempt adaptive fallback
          const catchReason = classifyFailure(lastError, 0, 0);
          const catchFallback = await this.attemptFallback(id, catchReason, estimatedInputTokens, request, activeProviders, requestId, modelStart);
          if (catchFallback) {
            responses.set(id, catchFallback);
            eventBus.emitModelComplete({
              requestId,
              modelId: catchFallback.modelId,
              timestamp: new Date().toISOString(),
              success: true,
              inputTokens: catchFallback.inputTokens,
              outputTokens: catchFallback.outputTokens,
              executionTimeMs: catchFallback.executionTimeMs || (Date.now() - modelStart),
            });
            return;
          }
          // No fallback — write original error
          const errorResponse: LLMResponse = {
            modelId: id,
            content: '',
            inputTokens: 0,
            outputTokens: 0,
            finishReason: 'error',
            error: lastError,
            executionTimeMs: Date.now() - modelStart,
          };
          responses.set(id, errorResponse);
          eventBus.emitModelComplete({
            requestId,
            modelId: id,
            timestamp: new Date().toISOString(),
            success: false,
            inputTokens: 0,
            outputTokens: 0,
            executionTimeMs: Date.now() - modelStart,
            error: lastError,
          });
          log('error', 'executor', `${id} failed: ${lastError.slice(0, 100)}`);
          return;
        }
      }
    });

    // Wait for all or fastest based on strategy
    const strategy = request.strategy || this.config.execution.strategy;
    if (strategy === 'wait_all') {
      await Promise.all(promises);
    } else if (strategy === 'fastest_2') {
      await Promise.race(promises);
    }

    // Calculate totals
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    for (const [id, response] of responses) {
      totalInputTokens += response.inputTokens;
      totalOutputTokens += response.outputTokens;
      const modelCost = this.config.costs.models[response.modelId];
      if (modelCost) {
        totalCost += (response.inputTokens / 1000000) * modelCost.input_per_1m;
        totalCost += (response.outputTokens / 1000000) * modelCost.output_per_1m;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    // Log review
    this.tracker.logReview({
      timestamp: new Date().toISOString(),
      content_hash: contentHash,
      execution_strategy: strategy,
      total_cost_usd: totalCost,
      models: Array.from(responses.keys()),
    });

    // Build per-model results for logging
    const modelResults: ModelResultSummary[] = Array.from(responses.entries()).map(([id, r]) => ({
      id,
      success: !r.error,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      latencyMs: r.executionTimeMs,
      ...(r.error ? { error: r.error } : {}),
    }));

    // Build verdict summary from successful responses
    const successfulResponses = Array.from(responses.entries()).filter(([, r]) => !r.error);
    const successCount = successfulResponses.length;
    const verdict = successCount > 0
      ? `${successCount}/${responses.size} models completed successfully`
      : 'All models failed';
    const verdictSummary = successfulResponses.length > 0
      ? successfulResponses.map(([id, r]) => `${id}: ${r.content.substring(0, 100)}`).join(' | ')
      : undefined;

    // Emit request complete
    eventBus.emitRequestComplete({
      requestId,
      timestamp: new Date().toISOString(),
      executionTimeMs,
      totalCost,
      modelCount: responses.size,
      successCount,
      cacheHit: false,
      verdict,
      verdictSummary: verdictSummary?.substring(0, 500),
      modelResults,
    });

    log('info', 'executor', `Request ${requestId.slice(0, 8)} complete: ${successCount}/${responses.size} models, ${executionTimeMs}ms, $${totalCost.toFixed(4)}`);

    const result: ReviewResult = {
      reviews: Object.fromEntries(responses),
      consensus: {
        agreements: [],
        disagreements: {},
      },
      executionTimeMs,
      totalCost,
    };

    // Cache the result
    if (this.cache) {
      this.cache.set(request.content, reviewType, result);
      log('debug', 'executor', `Cached result for ${requestId.slice(0, 8)}`);
    }

    return result;
  }

  private async attemptFallback(
    originalId: string,
    reason: FailureReason,
    estimatedTokens: number,
    request: ReviewRequest,
    activeProviders: Map<string, LLMProvider>,
    requestId: string,
    modelStart: number,
  ): Promise<LLMResponse | null> {
    try {
      const result = await findReplacement(originalId, {
        freeOnly: true,
        minContextLength: estimatedTokens * 5,
        maxCandidates: 3,
      });

      if (!result.recommended) {
        log('warn', 'executor', `${originalId}: no fallback replacement found (reason: ${reason})`);
        return null;
      }

      const replacementId = result.recommended.model.id;

      // Don't use a model that's already active in this request
      if (activeProviders.has(replacementId)) {
        log('warn', 'executor', `${originalId}: fallback ${replacementId} already in active providers, skipping`);
        return null;
      }

      // Find API key for the replacement (use OpenRouter key since findReplacement searches OpenRouter)
      const apiKey = process.env['OPENROUTER_API_KEY'];
      if (!apiKey) {
        log('warn', 'executor', `${originalId}: no OPENROUTER_API_KEY for fallback provider`);
        return null;
      }

      // Create temporary provider for the replacement
      const tempConfig = {
        id: replacementId,
        provider: 'openai-compatible' as const,
        model: replacementId,
        baseUrl: 'https://openrouter.ai/api/v1',
        timeout_ms: 60000,
        slack_time_ms: 0,
        execution_order: 1,
      };
      const tempProvider = createProvider(tempConfig, apiKey);

      log('warn', 'executor', `${originalId} -> fallback -> ${replacementId} (reason: ${reason}, tokens: ${estimatedTokens})`);

      const response = await tempProvider.sendRequest(request.content, '');

      // Zero-token check on fallback too
      if (response.outputTokens === 0 && (!response.content || response.content.trim() === '')) {
        log('warn', 'executor', `${originalId}: fallback ${replacementId} also returned empty`);
        return null;
      }

      // Tag with fallback origin
      return {
        ...response,
        modelId: replacementId,
        fallbackFrom: originalId,
        executionTimeMs: Date.now() - modelStart,
      };
    } catch (error) {
      log('warn', 'executor', `${originalId}: fallback attempt failed: ${String(error).slice(0, 100)}`);
      return null;
    }
  }
}
