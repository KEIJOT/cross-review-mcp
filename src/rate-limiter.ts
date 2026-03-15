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

export class RateLimiter {
  private limits: Map<string, RateLimiterState> = new Map();
  private config: Map<string, RateLimitConfig>;

  constructor(config: Record<string, RateLimitConfig>) {
    this.config = new Map(Object.entries(config));

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

  private refillTokens(providerId: string, state: RateLimiterState): void {
    const now = new Date();
    const elapsedMs = now.getTime() - state.lastRefillTime.getTime();
    const elapsedSeconds = elapsedMs / 1000;

    const tokensPerSecond = state.requestsPerMinute / 60;
    const tokensGenerated = elapsedSeconds * tokensPerSecond;

    state.tokensAvailable = Math.min(
      state.tokensAvailable + tokensGenerated,
      state.requestsPerMinute
    );
    state.lastRefillTime = now;
  }

  private calculateWaitTime(state: RateLimiterState): number {
    if (state.tokensAvailable >= 1) return 0;

    const tokensPerSecond = state.requestsPerMinute / 60;
    const secondsNeeded = 1 / tokensPerSecond;

    return secondsNeeded * 1000;
  }

  public async waitIfNeeded(providerId: string): Promise<void> {
    if (!this.config.has(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const state = this.limits.get(providerId)!;

    while (true) {
      this.refillTokens(providerId, state);

      if (state.tokensAvailable >= 1) {
        state.tokensAvailable -= 1;
        return;
      }

      const waitTimeMs = this.calculateWaitTime(state);

      if (waitTimeMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTimeMs + 10));
      }
    }
  }

  public getState(providerId: string): RateLimiterState | null {
    if (!this.limits.has(providerId)) return null;

    const state = this.limits.get(providerId)!;
    this.refillTokens(providerId, state);

    return { ...state };
  }

  public getAllStates(): Record<string, RateLimiterState> {
    const result: Record<string, RateLimiterState> = {};

    for (const [providerId, state] of this.limits.entries()) {
      this.refillTokens(providerId, state);
      result[providerId] = { ...state };
    }

    return result;
  }

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
