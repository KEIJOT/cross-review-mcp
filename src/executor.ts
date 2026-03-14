// src/executor.ts - Review execution engine
import { Config } from './config.js';
import { ReviewRequest, ReviewResult, LLMResponse } from './types.js';
import { createProvider, LLMProvider } from './providers.js';
import { TokenTracker } from './tracking.js';

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
      const envKey = `${reviewer.provider.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envKey];
      if (!apiKey) {
        throw new Error(`Missing API key for ${reviewer.id}: ${envKey}`);
      }
      const provider = createProvider(reviewer, apiKey);
      this.providers.set(reviewer.id, provider);
    }
  }

  async execute(request: ReviewRequest): Promise<ReviewResult> {
    const startTime = Date.now();
    const responses = new Map<string, LLMResponse>();

    // Execute all providers
    const promises = Array.from(this.providers.entries()).map(async ([id, provider]) => {
      try {
        const response = await provider.sendRequest(request.content, '');
        responses.set(id, response);
      } catch (error) {
        responses.set(id, {
          modelId: id,
          content: '',
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          error: String(error),
          executionTimeMs: Date.now() - startTime,
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
