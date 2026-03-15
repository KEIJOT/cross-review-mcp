// src/cost-manager.ts - Cost tracking and budget control (v0.7.0)

export interface CostAlert {
  timestamp: Date;
  type: 'daily_threshold' | 'budget_exceeded';
  currentCost: number;
  threshold: number;
  message: string;
}

export interface CostStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  byModel: Record<string, number>;
  alerts: CostAlert[];
}

export interface CostConfig {
  dailyBudget?: number;      // USD, optional max per day
  monthlyBudget?: number;    // USD, optional max per month
  dailyThreshold?: number;   // USD, alert when exceeded
  trackingEnabled: boolean;
}

/**
 * Cost Manager
 * - Track spending by day/week/month
 * - Per-model cost breakdown
 * - Budget enforcement (hard limits)
 * - Threshold alerts
 */
export class CostManager {
  private config: CostConfig;
  private dailyCosts: Map<string, number> = new Map(); // YYYY-MM-DD -> cost
  private modelCosts: Map<string, number> = new Map();
  private alerts: CostAlert[] = [];
  private totalCost: number = 0;

  constructor(config: CostConfig) {
    this.config = {
      trackingEnabled: config.trackingEnabled ?? true,
      dailyBudget: config.dailyBudget,
      monthlyBudget: config.monthlyBudget,
      dailyThreshold: config.dailyThreshold ?? 10 // $10 default alert threshold
    };
  }

  /**
   * Track a cost
   */
  public trackCost(modelId: string, cost: number): void {
    if (!this.config.trackingEnabled) return;

    const today = this.getDateKey(new Date());

    // Update totals
    this.totalCost += cost;
    this.dailyCosts.set(today, (this.dailyCosts.get(today) ?? 0) + cost);
    this.modelCosts.set(modelId, (this.modelCosts.get(modelId) ?? 0) + cost);

    // Check thresholds
    const dailyCost = this.dailyCosts.get(today) ?? 0;

    if (this.config.dailyThreshold && dailyCost > this.config.dailyThreshold) {
      this.alerts.push({
        timestamp: new Date(),
        type: 'daily_threshold',
        currentCost: dailyCost,
        threshold: this.config.dailyThreshold,
        message: `Daily cost ${dailyCost.toFixed(2)} exceeds threshold $${this.config.dailyThreshold}`
      });
    }

    // Check budget limits
    if (this.config.dailyBudget && dailyCost > this.config.dailyBudget) {
      this.alerts.push({
        timestamp: new Date(),
        type: 'budget_exceeded',
        currentCost: dailyCost,
        threshold: this.config.dailyBudget,
        message: `Daily budget exceeded: $${dailyCost.toFixed(2)} / $${this.config.dailyBudget}`
      });
    }
  }

  /**
   * Check if budget allows more spending
   */
  public canAfford(cost: number): boolean {
    const today = this.getDateKey(new Date());
    const dailyCost = this.dailyCosts.get(today) ?? 0;

    if (this.config.dailyBudget && dailyCost + cost > this.config.dailyBudget) {
      return false;
    }

    if (this.config.monthlyBudget) {
      const monthlyCost = this.getMonthCost(new Date());
      if (monthlyCost + cost > this.config.monthlyBudget) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get date key for tracking
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get total cost for month
   */
  private getMonthCost(date: Date): number {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;

    let total = 0;
    for (const [key, cost] of this.dailyCosts.entries()) {
      if (key.startsWith(prefix)) {
        total += cost;
      }
    }
    return total;
  }

  /**
   * Get comprehensive cost stats
   */
  public getStats(): CostStats {
    const now = new Date();
    const today = this.getDateKey(now);

    // Calculate week (last 7 days)
    let weekCost = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = this.getDateKey(date);
      weekCost += this.dailyCosts.get(key) ?? 0;
    }

    return {
      today: this.dailyCosts.get(today) ?? 0,
      thisWeek: weekCost,
      thisMonth: this.getMonthCost(now),
      allTime: this.totalCost,
      byModel: Object.fromEntries(this.modelCosts),
      alerts: [...this.alerts]
    };
  }

  /**
   * Get cost forecast
   */
  public forecast(): {
    dailyAverage: number;
    projectedMonthly: number;
    daysInMonth: number;
  } {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    let totalThisMonth = 0;
    for (let i = 1; i <= dayOfMonth; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), i);
      const key = this.getDateKey(date);
      totalThisMonth += this.dailyCosts.get(key) ?? 0;
    }

    const dailyAverage = totalThisMonth / dayOfMonth;
    const projectedMonthly = dailyAverage * daysInMonth;

    return {
      dailyAverage,
      projectedMonthly,
      daysInMonth
    };
  }

  /**
   * Clear alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }
}
