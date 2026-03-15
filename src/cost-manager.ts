// src/cost-manager.ts - API Cost Tracking (v0.5.2, 2026-03-15)

import * as fs from 'fs';
import * as path from 'path';

export interface CostConfig {
  trackingEnabled: boolean;
  dailyThreshold: number;  // Alert if daily spend exceeds this ($)
  monthlyThreshold?: number;  // Alert if monthly spend exceeds this ($)
}

export interface ModelCost {
  inputTokens: number;
  outputTokens: number;
  costPerInputToken: number;  // In dollars
  costPerOutputToken: number;
}

// Pricing as of March 2026
const MODEL_COSTS: Record<string, ModelCost> = {
  'gpt-4o': {
    inputTokens: 0,
    outputTokens: 0,
    costPerInputToken: 0.005 / 1000,      // $5 per 1M
    costPerOutputToken: 0.015 / 1000,     // $15 per 1M
  },
  'gemini-2.0-pro': {
    inputTokens: 0,
    outputTokens: 0,
    costPerInputToken: 0.0075 / 1000,     // $7.50 per 1M
    costPerOutputToken: 0.030 / 1000,     // $30 per 1M
  },
  'deepseek-chat': {
    inputTokens: 0,
    outputTokens: 0,
    costPerInputToken: 0.0014 / 1000,     // $1.40 per 1M (cheap!)
    costPerOutputToken: 0.0042 / 1000,    // $4.20 per 1M
  },
  'mistral-large': {
    inputTokens: 0,
    outputTokens: 0,
    costPerInputToken: 0.002 / 1000,      // $2 per 1M
    costPerOutputToken: 0.006 / 1000,     // $6 per 1M
  },
};

export class CostManager {
  private config: CostConfig;
  private dailySpend: Map<string, number> = new Map();  // date → total
  private modelSpend: Map<string, number> = new Map();  // model → total
  private totalTokens = { input: 0, output: 0 };
  private dataFile = '.llmapi_costs.json';

  constructor(config: CostConfig) {
    this.config = config;
    if (config.trackingEnabled) {
      this.loadFromDisk();
    }
  }

  /**
   * Track token usage for a provider
   */
  trackUsage(
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    if (!this.config.trackingEnabled) return;

    const cost = this.calculateCost(provider, inputTokens, outputTokens);
    const today = this.getToday();

    // Update daily spend
    const currentDaily = this.dailySpend.get(today) || 0;
    this.dailySpend.set(today, currentDaily + cost);

    // Update model spend
    const currentModel = this.modelSpend.get(provider) || 0;
    this.modelSpend.set(provider, currentModel + cost);

    // Update token counts
    this.totalTokens.input += inputTokens;
    this.totalTokens.output += outputTokens;

    // Check daily threshold
    if (currentDaily + cost > this.config.dailyThreshold) {
      console.warn(
        `⚠️  Daily spend alert: $${(currentDaily + cost).toFixed(2)} exceeds threshold $${this.config.dailyThreshold}`
      );
    }

    this.saveToDisk();
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const modelKey = this.getModelKey(provider);
    const costs = MODEL_COSTS[modelKey];

    if (!costs) {
      console.warn(`[Cost] Unknown model: ${provider}`);
      return 0;
    }

    const inputCost = inputTokens * costs.costPerInputToken;
    const outputCost = outputTokens * costs.costPerOutputToken;
    return inputCost + outputCost;
  }

  /**
   * Map provider name to model key
   */
  private getModelKey(provider: string): string {
    const mapping: Record<string, string> = {
      openai: 'gpt-4o',
      gemini: 'gemini-2.0-pro',
      deepseek: 'deepseek-chat',
      mistral: 'mistral-large',
      openrouter: 'gpt-4o',  // Assume GPT-4 for openrouter
    };
    return mapping[provider.toLowerCase()] || provider;
  }

  /**
   * Get today's date as YYYY-MM-DD
   */
  private getToday(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Get current month as YYYY-MM
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return now.toISOString().substring(0, 7);
  }

  /**
   * Calculate monthly spend
   */
  private getMonthlySpend(): number {
    let monthlyTotal = 0;
    const currentMonth = this.getCurrentMonth();

    for (const [dateString, amount] of this.dailySpend.entries()) {
      if (dateString.startsWith(currentMonth)) {
        monthlyTotal += amount;
      }
    }

    return monthlyTotal;
  }

  /**
   * Get cost summary
   */
  getStats() {
    const today = this.getToday();
    const todaySpend = this.dailySpend.get(today) || 0;
    const monthlySpend = this.getMonthlySpend();
    const totalSpend = Array.from(this.dailySpend.values()).reduce(
      (a, b) => a + b,
      0
    );

    const perModel: Record<string, string> = {};
    for (const [model, cost] of this.modelSpend.entries()) {
      perModel[model] = `$${cost.toFixed(2)}`;
    }

    return {
      totalCost: `$${totalSpend.toFixed(2)}`,
      dailySpend: `$${todaySpend.toFixed(2)}`,
      monthlySpend: `$${monthlySpend.toFixed(2)}`,
      dailyThreshold: `$${this.config.dailyThreshold}`,
      totalInputTokens: this.totalTokens.input,
      totalOutputTokens: this.totalTokens.output,
      perModel,
      lastUpdated: this.getToday(),
    };
  }

  /**
   * Generate monthly report
   */
  getMonthlyReport(month?: string): {
    month: string;
    totalCost: string;
    dailyBreakdown: Record<string, string>;
    perModel: Record<string, string>;
  } {
    const targetMonth = month || this.getCurrentMonth();
    const dailyBreakdown: Record<string, string> = {};
    const modelBreakdown: Record<string, number> = {};

    for (const [dateString, amount] of this.dailySpend.entries()) {
      if (dateString.startsWith(targetMonth)) {
        dailyBreakdown[dateString] = `$${amount.toFixed(2)}`;
      }
    }

    let monthlyTotal = 0;
    for (const amount of Object.values(dailyBreakdown)) {
      const value = parseFloat(amount.replace('$', ''));
      monthlyTotal += value;
    }

    for (const [model, cost] of this.modelSpend.entries()) {
      modelBreakdown[model] = cost;
    }

    const perModel: Record<string, string> = {};
    for (const [model, cost] of Object.entries(modelBreakdown)) {
      perModel[model] = `$${cost.toFixed(2)}`;
    }

    return {
      month: targetMonth,
      totalCost: `$${monthlyTotal.toFixed(2)}`,
      dailyBreakdown,
      perModel,
    };
  }

  /**
   * Persist costs to disk
   */
  private saveToDisk(): void {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        daily: Object.fromEntries(this.dailySpend),
        models: Object.fromEntries(this.modelSpend),
        tokens: this.totalTokens,
      };
      fs.writeFileSync(
        this.dataFile,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error: any) {
      console.error('[Cost] Failed to save to disk:', error.message);
    }
  }

  /**
   * Load costs from disk
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
        this.dailySpend = new Map(Object.entries(data.daily || {}));
        this.modelSpend = new Map(Object.entries(data.models || {}));
        this.totalTokens = data.tokens || { input: 0, output: 0 };
        console.error('[Cost] Loaded cost history from disk');
      }
    } catch (error: any) {
      console.error('[Cost] Failed to load from disk:', error.message);
    }
  }

  /**
   * Reset all cost data
   */
  reset(): void {
    this.dailySpend.clear();
    this.modelSpend.clear();
    this.totalTokens = { input: 0, output: 0 };
    try {
      fs.unlinkSync(this.dataFile);
    } catch (e) {
      // File doesn't exist
    }
  }
}
