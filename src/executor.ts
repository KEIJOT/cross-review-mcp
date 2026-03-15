// src/executor.ts - Review execution engine
import { Config } from './config.js';
import { ReviewRequest, ReviewResult, LLMResponse } from './types.js';
import { createProvider, LLMProvider } from './providers.js';
import { TokenTracker } from './tracking.js';
import { eventBus } from './events.js';

export class ReviewExecutor {
  private config: Config;
  private tracker: TokenTracker;
  private providers: Map<string, LLMProvider> = new Map();

  constructor(config: Config, tracker: TokenTracker) {
    this.config = config;
    this.tracker = tracker;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const reviewer of this.config.reviewers) {
      // Use reviewer id for env key (e.g., DEEPSEEK_API_KEY), not provider name
      const envKey = `${reviewer.id.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envKey];
      if (!apiKey) {
        // Skip this provider instead of crashing (graceful degradation)
        continue;
      }
      const provider = createProvider(reviewer, apiKey);
      this.providers.set(reviewer.id, provider);
    }
  }

  async execute(request: ReviewRequest): Promise<ReviewResult> {
    const startTime = Date.now();
    const responses = new Map<string, LLMResponse>();
    const requestId = eventBus.generateRequestId();

    // Emit request start
    eventBus.emitRequestStart({
      requestId,
      timestamp: new Date().toISOString(),
      contentLength: request.content.length,
      type: (request as any).type || 'general',
      models: Array.from(this.providers.keys()),
    });

    // Execute all providers
    const promises = Array.from(this.providers.entries()).map(async ([id, provider]) => {
      const modelStart = Date.now();
      try {
        const response = await provider.sendRequest(request.content, '');
        responses.set(id, response);
        eventBus.emitModelComplete({
          requestId,
          modelId: id,
          timestamp: new Date().toISOString(),
          success: true,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          executionTimeMs: response.executionTimeMs || (Date.now() - modelStart),
        });
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
      content_hash: request.contentHash || '',
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

    return {
      reviews: Object.fromEntries(responses),
      consensus: {
        agreements: [],
        disagreements: {},
      },
      executionTimeMs,
      totalCost,
    };
  }
}
