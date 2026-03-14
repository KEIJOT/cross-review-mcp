// src/index.ts - Main entry point
import { Config, loadConfig } from './config.js';
import { ReviewResult, ReviewRequest } from './types.js';
import { ReviewExecutor } from './executor.js';
import { createProvider } from './providers.js';
import { TokenTracker } from './tracking.js';
import { z } from 'zod';

const RequestSchema = z.object({
  content: z.string().min(1),
  contentHash: z.string().optional(),
  strategy: z.enum(['wait_all', 'fastest_2', 'wait_max_30s']).optional(),
});

export async function executeReview(request: ReviewRequest): Promise<ReviewResult> {
  // Validate request
  const parsed = RequestSchema.parse(request);

  // Load configuration
  const config: Config = loadConfig();

  // Initialize tracker
  const tracker = new TokenTracker();

  // Initialize executor
  const executor = new ReviewExecutor(config, tracker);

  // Execute review
  const result = await executor.execute(parsed as ReviewRequest);

  return result;
}

export { ReviewResult, ReviewRequest, Config };
export { TokenTracker } from './tracking.js';
