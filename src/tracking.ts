// src/tracking.ts - Token and cost tracking
import * as fs from 'fs';

export interface ReviewLog {
  timestamp: string;
  content_hash: string;
  execution_strategy: string;
  total_cost_usd: number;
  models: Record<string, any>;
}

export class TokenTracker {
  constructor(private logFile: string = './llmapi_usage.json') {
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '', 'utf-8');
    }
  }

  public logReview(review: ReviewLog): void {
    fs.appendFileSync(this.logFile, JSON.stringify(review) + '\n', 'utf-8');
  }

  public getStats() {
    if (!fs.existsSync(this.logFile)) return { total_reviews: 0, total_cost_usd: 0 };
    const lines = fs.readFileSync(this.logFile, 'utf-8').trim().split('\n');
    let total = 0, cost = 0;
    for (const line of lines) {
      if (line) {
        try {
          const log = JSON.parse(line);
          total++;
          cost += log.total_cost_usd || 0;
        } catch (e) {}
      }
    }
    return { total_reviews: total, total_cost_usd: cost };
  }
}
