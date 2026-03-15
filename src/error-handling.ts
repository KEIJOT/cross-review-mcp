// src/error-handling.ts - Robust Error Handling & Retry Logic (v0.5.2, 2026-03-15)

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface APIError {
  provider: string;
  status?: number;
  message: string;
  retryable: boolean;
  timestamp: string;
}

/**
 * Standard retry configuration
 * Uses exponential backoff: 1s → 2s → 4s → 8s (max 30s)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<T> {
  let lastError: Error | null = null;
  let delayMs = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      console.error(`[Retry] Attempt ${attempt + 1}/${config.maxRetries + 1}${context ? ` (${context})` : ''}`);
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === config.maxRetries) {
        console.error(`[Retry] Final failure after ${attempt + 1} attempts: ${error.message}`);
        throw error;
      }

      // Exponential backoff
      const nextDelay = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
      console.error(`[Retry] Waiting ${delayMs}ms before retry (attempt ${attempt + 1}/${config.maxRetries})`);
      
      await sleep(delayMs);
      delayMs = nextDelay;
    }
  }

  throw lastError || new Error('Unknown error during retry');
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Transient errors that should be retried
  const retryablePatterns = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENOTFOUND',
    'timeout',
    'Too Many Requests',  // 429
    'Service Unavailable',  // 503
    'Gateway Timeout',  // 504
  ];

  const message = error.message || '';
  const code = error.code || '';

  return retryablePatterns.some(
    pattern => message.includes(pattern) || code.includes(pattern)
  );
}

/**
 * Sleep for N milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful degradation: skip missing providers
 */
export function getEnabledProviders(config: any): string[] {
  const allProviders = ['openai', 'gemini', 'deepseek', 'mistral', 'openrouter'];
  
  return allProviders.filter(provider => {
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    const hasKey = process.env[envKey];
    
    if (!hasKey) {
      console.error(`[Config] ${provider} API key not found. Skipping provider.`);
      return false;
    }
    
    return true;
  });
}

/**
 * Log structured error information
 */
export function logError(error: APIError): void {
  const log = {
    timestamp: error.timestamp,
    provider: error.provider,
    status: error.status,
    message: error.message,
    retryable: error.retryable,
  };
  
  console.error('[ERROR]', JSON.stringify(log));
}

/**
 * Create a circuit breaker for a provider
 * Automatically disables provider after N failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private isOpen = false;

  constructor(
    private provider: string,
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000  // 1 minute
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should reset
    if (this.isOpen && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
      console.error(`[CircuitBreaker] Resetting ${this.provider}`);
      this.isOpen = false;
      this.failureCount = 0;
    }

    // Fail fast if open
    if (this.isOpen) {
      throw new Error(`Circuit breaker open for ${this.provider}. Provider temporarily unavailable.`);
    }

    try {
      const result = await fn();
      // Success: reset failure count
      this.failureCount = 0;
      return result;
    } catch (error: any) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // Open circuit if threshold exceeded
      if (this.failureCount >= this.failureThreshold) {
        this.isOpen = true;
        console.error(`[CircuitBreaker] Circuit opened for ${this.provider} after ${this.failureCount} failures`);
      }

      throw error;
    }
  }

  getStatus() {
    return {
      provider: this.provider,
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      lastFailure: this.lastFailureTime,
    };
  }
}
