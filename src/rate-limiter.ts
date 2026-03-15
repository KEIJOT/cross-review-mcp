// src/rate-limiter.ts - Token bucket rate limiter (v0.6.0)

export interface RateLimitConfig {
  requestsPerMinute: number;
}

export interface RateLimiterState {
  tokensAvailable: number;
  lastRefillTime: Date;
  nextTokenRefillTime: Date;
  requestsPerMinute: number;
}

/**
 * Token Bucket Rate Limiter
 * - Prevents exceeding API rate limits
 * - Transparent waiting when quota exhausted
 * - Per-provider rate limit enforcement
 */
export class RateLimiter {
  private limits: Map<string, RateLimiterState> = new Map();
  private config: Map<string, RateLimitConfig>;

  constructor(config: Record<string, RateLimitConfig>) {
    this.config = new Map(Object.entries(config));

    // Initialize state for each provider
    for (const [providerId, limitConfig] of this.config.entries()) {
      const now = new Date();
      this.limits.set(providerId, {
        tokensAvailable: limitConfig.requestsPerMinute,
        lastRefillTime: now,
        nextTokenRefillTime: now,
        requestsPerMinute: limitConfig.requestsPerMinute
      });
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(providerId: string, state: RateLimiterState): void {
    const now = new Date();
    const elapsedMs = now.getTime() - state.lastRefillTime.getTime();
    const elapsedSeconds = elapsedMs / 1000;

    // Token generation: requestsPerMinute / 60 = tokens per second
    const tokensPerSecond = state.requestsPerMinute / 60;
    const tokensGenerated = elapsedSeconds * tokensPerSecond;

    state.tokensAvailable = Math.min(
      state.tokensAvailable + tokensGenerated,
      state.requestsPerMinute // Cap at max
    );
    state.lastRefillTime = now;
  }

  /**
   * Calculate wait time if needed
   */
  private calculateWaitTime(
    state: RateLimiterState
  ): number {
    if (state.tokensAvailable >= 1) return 0;

    // Time until 1 token is available
    const tokensPerSecond = state.requestsPerMinute / 60;
    const secondsNeeded = 1 / tokensPerSecond;

    return secondsNeeded * 1000; // Convert to ms
  }

  /**
   * Wait for rate limit quota
   */
  public async waitIfNeeded(providerId: string): Promise<void> {
    if (!this.config.has(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const state = this.limits.get(providerId)!;

    while (true) {
      this.refillTokens(providerId, state);

      if (state.tokensAvailable >= 1) {
        state.tokensAvailable -= 1;
        return; // Can proceed
      }

      // Calculate wait time
      const waitTimeMs = this.calculateWaitTime(state);

      if (waitTimeMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTimeMs + 10));
      }
    }
  }

  /**
   * Get rate limiter state for a provider
   */
  public getState(providerId: string): RateLimiterState | null {
    if (!this.limits.has(providerId)) return null;

    const state = this.limits.get(providerId)!;
    this.refillTokens(providerId, state);

    return { ...state };
  }

  /**
   * Get all rate limiter states
   */
  public getAllStates(): Record<string, RateLimiterState> {
    const result: Record<string, RateLimiterState> = {};

    for (const [providerId, state] of this.limits.entries()) {
      this.refillTokens(providerId, state);
      result[providerId] = { ...state };
    }

    return result;
  }

  /**
   * Reset a provider's rate limit
   */
  public reset(providerId: string): void {
    if (!this.config.has(providerId)) return;

    const limitConfig = this.config.get(providerId)!;
    const now = new Date();

    this.limits.set(providerId, {
      tokensAvailable: limitConfig.requestsPerMinute,
      lastRefillTime: now,
      nextTokenRefillTime: now,
      requestsPerMinute: limitConfig.requestsPerMinute
    });
  }
}
