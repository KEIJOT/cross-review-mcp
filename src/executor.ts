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

            // Final attempt still empty — mark as failure
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

          // Final attempt or non-retryable error
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
}
