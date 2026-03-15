// src/benchmark.ts - Model performance benchmarking from historical data
import { eventBus } from './events.js';
import { CostManager } from './cost-manager.js';

export interface ModelBenchmark {
  modelId: string;
  requests: number;
  successes: number;
  failures: number;
  errorRate: number;           // 0-1
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCost: string;
  costPerRequest: string;
  reliabilityScore: number;    // 0-100, composite score
}

export interface BenchmarkReport {
  totalRequests: number;
  uptimeSeconds: number;
  models: ModelBenchmark[];
  ranking: string[];           // Model IDs sorted by reliability score
  generatedAt: string;
}

/**
 * Build per-model performance benchmarks from EventBus ring buffer history
 * and CostManager spend data.
 */
export function buildModelBenchmark(costManager: CostManager): BenchmarkReport {
  const recentRequests = eventBus.getRecentRequests();

  // Aggregate per-model stats
  const stats = new Map<string, {
    latencies: number[];
    inputTokens: number[];
    outputTokens: number[];
    successes: number;
    failures: number;
  }>();

  for (const req of recentRequests) {
    for (const [modelId, event] of req.models) {
      let m = stats.get(modelId);
      if (!m) {
        m = { latencies: [], inputTokens: [], outputTokens: [], successes: 0, failures: 0 };
        stats.set(modelId, m);
      }
      m.latencies.push(event.executionTimeMs);
      m.inputTokens.push(event.inputTokens);
      m.outputTokens.push(event.outputTokens);
      if (event.success) {
        m.successes++;
      } else {
        m.failures++;
      }
    }
  }

  // Get cost data
  const costStats = costManager.getStats();

  const models: ModelBenchmark[] = [];

  for (const [modelId, m] of stats) {
    const total = m.successes + m.failures;
    const errorRate = total > 0 ? m.failures / total : 0;
    const avgLatency = m.latencies.length > 0
      ? m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length
      : 0;

    // P95 latency
    const sorted = [...m.latencies].sort((a, b) => a - b);
    const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
    const p95Latency = sorted.length > 0 ? sorted[p95Index] : 0;

    const avgIn = m.inputTokens.length > 0
      ? m.inputTokens.reduce((a, b) => a + b, 0) / m.inputTokens.length
      : 0;
    const avgOut = m.outputTokens.length > 0
      ? m.outputTokens.reduce((a, b) => a + b, 0) / m.outputTokens.length
      : 0;

    // Get cost from CostManager
    const modelCostStr = costStats.perModel[modelId] || '$0.00';
    const modelCost = parseFloat(modelCostStr.replace('$', ''));
    const costPerReq = total > 0 ? modelCost / total : 0;

    // Reliability score (0-100):
    //   50% success rate + 30% latency (lower = better) + 20% output volume (more = better)
    const successScore = (1 - errorRate) * 50;
    const latencyScore = avgLatency > 0 ? Math.max(0, 30 - (avgLatency / 1000) * 3) : 0;
    const outputScore = Math.min(20, (avgOut / 100) * 20);
    const reliabilityScore = Math.round(successScore + latencyScore + outputScore);

    models.push({
      modelId,
      requests: total,
      successes: m.successes,
      failures: m.failures,
      errorRate: Math.round(errorRate * 1000) / 1000,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      avgInputTokens: Math.round(avgIn),
      avgOutputTokens: Math.round(avgOut),
      totalCost: `$${modelCost.toFixed(4)}`,
      costPerRequest: `$${costPerReq.toFixed(4)}`,
      reliabilityScore,
    });
  }

  // Rank by reliability score descending
  models.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  const ranking = models.map(m => m.modelId);

  return {
    totalRequests: recentRequests.length,
    uptimeSeconds: Math.floor(eventBus.getUptimeMs() / 1000),
    models,
    ranking,
    generatedAt: new Date().toISOString(),
  };
}
