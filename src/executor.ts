// src/executor.ts - Review execution engine
import { Config } from './config';
import { ReviewRequest, ReviewResult } from './types';
import { createProvider } from './providers';

export class ReviewExecutor {
  private providers: Map<string, any> = new Map();

  constructor(private config: Config) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const reviewer of this.config.reviewers) {
      try {
        const provider = createProvider(reviewer);
        this.providers.set(reviewer.id, provider);
      } catch (error) {
        console.error(`Failed to init ${reviewer.id}:`, error);
      }
    }
  }

  async execute(request: ReviewRequest): Promise<ReviewResult> {
    const startTime = Date.now();
    const reviews: Record<string, any> = {};

    for (const reviewer of this.config.reviewers) {
      const provider = this.providers.get(reviewer.id);
      if (!provider) continue;

      console.log(`🔄 ${reviewer.id}...`);
      const response = await provider.sendRequest(request.content);
      reviews[reviewer.id] = response;
    }

    return {
      reviews,
      consensus: { agreements: [], disagreements: {} },
      executionTimeMs: Date.now() - startTime,
      totalCost: this.calculateCost(reviews),
    };
  }

  private calculateCost(reviews: Record<string, any>): number {
    let total = 0;
    for (const [modelId, response] of Object.entries(reviews)) {
      const costs = this.config.costs?.models?.[modelId];
      if (costs && response.finishReason === 'stop') {
        const inputCost = (response.inputTokens / 1000000) * costs.input_per_1m;
        const outputCost = (response.outputTokens / 1000000) * costs.output_per_1m;
        total += inputCost + outputCost;
      }
    }
    return total;
  }
}
