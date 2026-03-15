// src/executor.ts - Review execution engine
import crypto from 'crypto';
import { Config } from './config.js';
import { ReviewRequest, ReviewResult, LLMResponse } from './types.js';
import { createProvider, LLMProvider } from './providers.js';
import { TokenTracker } from './tracking.js';
import { CacheManager } from './cache.js';
import { CostManager } from './cost-manager.js';
import { eventBus } from './events.js';
import { log } from './logger.js';

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
      const envKey = `${reviewer.id.toUpperCase()}_API_KEY`;
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

    log('info', 'executor', `Request ${requestId.slice(0, 8)}: type=${reviewType}, content=${request.content.length} chars, models=${this.providers.size}`);

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(request.content, reviewType);
      if (cached) {
        log('info', 'executor', `Cache hit for ${requestId.slice(0, 8)}`);
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
      type: reviewType,
      models: Array.from(this.providers.keys()),
    });

    // Execute all providers
    const promises = Array.from(this.providers.entries()).map(async ([id, provider]) => {
      const modelStart = Date.now();
      try {
        const response = await provider.sendRequest(request.content, '');
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
      } catch (error) {
        const errorResponse: LLMResponse = {
          modelId: id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: String(error),
          executionTimeMs: Date.now() - startTime,
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
          error: String(error),
        });
        log('error', 'executor', `${id} failed: ${String(error).slice(0, 100)}`);
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

    // Emit request complete
    const successCount = Array.from(responses.values()).filter(r => !r.error).length;
    eventBus.emitRequestComplete({
      requestId,
      timestamp: new Date().toISOString(),
      executionTimeMs,
      totalCost,
      modelCount: responses.size,
      successCount,
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
