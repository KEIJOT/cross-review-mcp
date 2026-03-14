// src/tracking.ts - Token and cost tracking
import * as fs from 'fs';

export interface ReviewLog {
  timestamp: string;
  content_hash: string;
  execution_strategy: string;
  total_cost_usd: number;
  models: string[];
}

export class TokenTracker {
  private logFile: string = '.llmapi_usage.json';

  constructor(logFile: string = '.llmapi_usage.json') {
    this.logFile = logFile;
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '', 'utf-8');
    }
  }

  public logReview(review: ReviewLog): void {
    fs.appendFileSync(this.logFile, JSON.stringify(review) + '\n', 'utf-8');
  }
}
