// src/batch-processor.ts - Async batch processing with parallel workers (v0.6.0)

export type BatchStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export interface BatchJob<T, R> {
  id: string;
  status: BatchStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  items: T[];
  results: R[];
  createdAt: Date;
  completedAt: Date | null;
  webhookUrl?: string;
  errors: Array<{ itemIndex: number; error: string }>;
}

export interface BatchProcessorConfig {
  parallelWorkers: number;  // Number of concurrent workers
  workerTimeoutMs: number;  // Timeout per item
  maxBatchSize: number;     // Max items per batch
}

/**
 * Batch Processor with Parallel Workers
 * - Queue multiple reviews for parallel processing
 * - 4 workers process items concurrently
 * - Respects rate limits and caching per worker
 * - Persistent job tracking
 */
export class BatchProcessor<T, R> {
  private jobs: Map<string, BatchJob<T, R>> = new Map();
  private config: BatchProcessorConfig;
  private workerQueues: T[][] = [];

  constructor(config: BatchProcessorConfig) {
    this.config = {
      parallelWorkers: config.parallelWorkers ?? 4,
      workerTimeoutMs: config.workerTimeoutMs ?? 120000,
      maxBatchSize: config.maxBatchSize ?? 10000
    };

    // Initialize worker queues
    for (let i = 0; i < this.config.parallelWorkers; i++) {
      this.workerQueues.push([]);
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Create and queue batch job
   */
  public async submitBatch(
    items: T[],
    processor: (item: T, workerIndex: number) => Promise<R>,
    webhookUrl?: string
  ): Promise<string> {
    if (items.length > this.config.maxBatchSize) {
      throw new Error(`Batch size ${items.length} exceeds max ${this.config.maxBatchSize}`);
    }

    const batchId = this.generateBatchId();
    const batch: BatchJob<T, R> = {
      id: batchId,
      status: 'QUEUED',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      items,
      results: [],
      createdAt: new Date(),
      completedAt: null,
      webhookUrl,
      errors: []
    };

    this.jobs.set(batchId, batch);

    // Start processing asynchronously (don't wait)
    void this.processBatch(batchId, processor).catch(err => {
      console.error(`Batch ${batchId} error:`, err);
      batch.status = 'FAILED';
    });

    return batchId;
  }

  /**
   * Process batch with parallel workers
   */
  private async processBatch(
    batchId: string,
    processor: (item: T, workerIndex: number) => Promise<R>
  ): Promise<void> {
    const batch = this.jobs.get(batchId);
    if (!batch) return;

    batch.status = 'PROCESSING';

    // Distribute items to workers
    const workers: Promise<void>[] = [];

    for (let workerIndex = 0; workerIndex < this.config.parallelWorkers; workerIndex++) {
      workers.push(
        this.runWorker(batch, workerIndex, processor)
      );
    }

    // Wait for all workers
    await Promise.all(workers);

    // Mark complete
    batch.status = 'COMPLETE';
    batch.completedAt = new Date();

    // Trigger webhook if configured
    if (batch.webhookUrl) {
      void this.triggerWebhook(batch).catch(err => {
        console.error(`Webhook for ${batchId} failed:`, err);
      });
    }
  }

  /**
   * Run individual worker
   */
  private async runWorker(
    batch: BatchJob<T, R>,
    workerIndex: number,
    processor: (item: T, workerIndex: number) => Promise<R>
  ): Promise<void> {
    const itemsPerWorker = Math.ceil(batch.items.length / this.config.parallelWorkers);
    const startIndex = workerIndex * itemsPerWorker;
    const endIndex = Math.min(startIndex + itemsPerWorker, batch.items.length);

    for (let i = startIndex; i < endIndex; i++) {
      if (batch.status === 'FAILED') break; // Stop if batch failed

      const item = batch.items[i];

      try {
        const result = await Promise.race([
          processor(item, workerIndex),
          new Promise<R>((_, reject) =>
            setTimeout(
              () => reject(new Error('Worker timeout')),
              this.config.workerTimeoutMs
            )
          )
        ]);

        batch.results[i] = result;
        batch.completedItems++;
      } catch (error) {
        batch.failedItems++;
        batch.errors.push({
          itemIndex: i,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Trigger webhook notification
   */
  private async triggerWebhook(batch: BatchJob<T, R>): Promise<void> {
    if (!batch.webhookUrl) return;

    try {
      // Note: In production, use fetch() or axios
      // This is a placeholder
      console.log(`Webhook triggered: ${batch.webhookUrl}`, {
        batchId: batch.id,
        status: batch.status,
        completedItems: batch.completedItems,
        totalItems: batch.totalItems
      });
    } catch (error) {
      console.error('Webhook failed:', error);
    }
  }

  /**
   * Get batch status
   */
  public getStatus(batchId: string): BatchJob<T, R> | null {
    const batch = this.jobs.get(batchId);
    if (!batch) return null;

    return {
      ...batch,
      results: batch.status === 'COMPLETE' ? batch.results : []
    };
  }

  /**
   * Get batch results
   */
  public getResults(batchId: string): R[] | null {
    const batch = this.jobs.get(batchId);
    if (!batch) return null;
    if (batch.status !== 'COMPLETE') return null;

    return batch.results;
  }

  /**
   * List all jobs
   */
  public listJobs(filter?: { status?: BatchStatus }): Array<{
    id: string;
    status: BatchStatus;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    createdAt: Date;
    completedAt: Date | null;
    webhookUrl?: string;
    errors: Array<{ itemIndex: number; error: string }>;
  }> {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter(j => j.status === filter.status);
    }

    return jobs.map(({ items, results, ...rest }) => rest);
  }
}
