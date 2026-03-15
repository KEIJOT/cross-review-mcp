// src/webhooks.ts - Webhook notifications for batch events (v0.7.0)

export type WebhookEventType = 'batch.queued' | 'batch.processing' | 'batch.completed' | 'batch.failed';

export interface WebhookEvent<T = any> {
  id: string;
  timestamp: Date;
  type: WebhookEventType;
  batchId: string;
  data: T;
  signature: string; // HMAC-SHA256
}

export interface WebhookPayload {
  batchId: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
}

export interface WebhookConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  timeoutMs: number;
}

/**
 * Webhook Manager
 * - Send HTTP POST to user-provided URLs
 * - Event signatures with HMAC-SHA256
 * - Retry logic with exponential backoff
 * - Event deduplication
 */
export class WebhookManager {
  private config: WebhookConfig;
  private sentEvents: Set<string> = new Set();

  constructor(config: Partial<WebhookConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialBackoffMs: config.initialBackoffMs ?? 1000,
      maxBackoffMs: config.maxBackoffMs ?? 60000,
      timeoutMs: config.timeoutMs ?? 30000
    };
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Send webhook with retries
   */
  public async sendWebhook(
    url: string,
    event: WebhookEvent,
    secret: string
  ): Promise<boolean> {
    const eventKey = `${event.batchId}:${event.type}`;

    // Dedup check
    if (this.sentEvents.has(eventKey)) {
      return true; // Already sent
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const payload = JSON.stringify(event.data);
        const signature = this.generateSignature(payload, secret);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event.type,
            'X-Webhook-Delivery': event.id
          },
          body: payload,
          signal: AbortSignal.timeout(this.config.timeoutMs)
        });

        if (response.ok) {
          this.sentEvents.add(eventKey);
          return true;
        }

        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Exponential backoff
      if (attempt < this.config.maxRetries) {
        const backoff = Math.min(
          this.config.initialBackoffMs * Math.pow(2, attempt),
          this.config.maxBackoffMs
        );
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    console.error(`Webhook delivery failed for ${url}:`, lastError);
    return false;
  }

  /**
   * Clear sent events (for testing)
   */
  public clear(): void {
    this.sentEvents.clear();
  }
}
