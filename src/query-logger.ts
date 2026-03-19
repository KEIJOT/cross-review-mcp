// query-logger.ts — Structured logging for all MCP queries and LLM interactions
// Logs to configurable path with full Q&A for learning/debugging

import * as fs from 'fs';
import * as path from 'path';
import { eventBus } from './events.js';
import { log } from './logger.js';

export interface ModelResultLog {
  id: string;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

export interface QueryLog {
  timestamp: string;
  sessionId: string;
  requestId: string;

  // Input
  contentPreview: string;  // First 200 chars
  contentLength: number;
  reviewType: string;
  modelsRequested: string[];

  // Output
  verdict?: string;
  verdictSummary?: string;
  cost?: number;
  latencyMs?: number;

  // Per-model breakdown
  modelResults?: ModelResultLog[];

  // Status
  success: boolean;
  cacheHit?: boolean;
  error?: string;
}

const DEFAULT_LOG_PATH = '/var/log/llmapi-queries.log';
const FALLBACK_LOG_PATH = path.join(process.cwd(), 'data', 'query-logs.jsonl');
const REQUEST_LOGS = new Map<string, Partial<QueryLog>>();

function resolveLogPath(): string {
  const envPath = process.env.LLMAPI_LOG_PATH;
  if (envPath) return envPath;

  // Try default path first, fall back to local data dir
  try {
    const dir = path.dirname(DEFAULT_LOG_PATH);
    fs.accessSync(dir, fs.constants.W_OK);
    return DEFAULT_LOG_PATH;
  } catch {
    return FALLBACK_LOG_PATH;
  }
}

const LOG_PATH = resolveLogPath();

export class QueryLogger {
  healthy: boolean = false;

  constructor(eventBusInstance: typeof eventBus) {
    this.validateLogFile();
    this.setupEventListeners(eventBusInstance);
  }

  private validateLogFile(): void {
    try {
      const dir = path.dirname(LOG_PATH);
      fs.mkdirSync(dir, { recursive: true });
      // Test write
      fs.appendFileSync(LOG_PATH, '');
      this.healthy = true;
      log('info', 'query-logger', `Logging to ${LOG_PATH}`);
    } catch (err) {
      this.healthy = false;
      log('error', 'query-logger', `Cannot write to ${LOG_PATH}: ${err}. Query logging disabled.`);
    }
  }

  private setupEventListeners(eventBusInstance: typeof eventBus) {
    // Listen to review start events
    eventBusInstance.on('request:start', (data: any) => {
      const requestId = data.requestId;
      REQUEST_LOGS.set(requestId, {
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || 'unknown',
        requestId,
        contentPreview: data.contentPreview || '',
        contentLength: data.contentLength || 0,
        reviewType: data.type || '',
        modelsRequested: data.models || [],
        success: false,
      });
    });

    // Listen to request completion
    eventBusInstance.on('request:complete', (data: any) => {
      const requestId = data.requestId;
      const logEntry = REQUEST_LOGS.get(requestId);

      if (logEntry) {
        logEntry.verdict = data.verdict;
        logEntry.verdictSummary = data.verdictSummary?.substring(0, 500);
        logEntry.cost = data.totalCost;
        logEntry.latencyMs = data.executionTimeMs;
        logEntry.success = true;
        logEntry.cacheHit = data.cacheHit || false;
        logEntry.modelResults = data.modelResults;

        this.writeLog(logEntry as QueryLog);
        REQUEST_LOGS.delete(requestId);
      }
    });
  }

  private writeLog(entry: QueryLog) {
    if (!this.healthy) return;
    try {
      fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
    } catch (err) {
      log('error', 'query-logger', `Failed to write query log: ${err}`);
      this.healthy = false;
    }
  }

  static readLogs(filter?: { since?: Date; reviewType?: string; success?: boolean }): QueryLog[] {
    try {
      const content = fs.readFileSync(LOG_PATH, 'utf-8');
      let logs = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line) as QueryLog;
          } catch {
            return null;
          }
        })
        .filter((log): log is QueryLog => log !== null);

      if (filter?.since) {
        logs = logs.filter(log => new Date(log.timestamp) >= filter.since!);
      }
      if (filter?.reviewType) {
        logs = logs.filter(log => log.reviewType === filter.reviewType);
      }
      if (filter?.success !== undefined) {
        logs = logs.filter(log => log.success === filter.success);
      }

      return logs;
    } catch (err) {
      return [];
    }
  }

  static summary(): {
    totalRequests: number;
    successRate: number;
    avgCost: number;
    avgLatencyMs: number;
    byReviewType: Record<string, number>;
  } {
    const logs = QueryLogger.readLogs();
    const successful = logs.filter(l => l.success);
    const byType: Record<string, number> = {};

    logs.forEach(log => {
      byType[log.reviewType] = (byType[log.reviewType] || 0) + 1;
    });

    return {
      totalRequests: logs.length,
      successRate: logs.length > 0 ? (successful.length / logs.length) * 100 : 0,
      avgCost: successful.length > 0 ? successful.reduce((sum, l) => sum + (l.cost || 0), 0) / successful.length : 0,
      avgLatencyMs: successful.length > 0 ? successful.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / successful.length : 0,
      byReviewType: byType,
    };
  }

  static modelStats(): Record<string, {
    requests: number;
    successes: number;
    failures: number;
    successRate: number;
    avgLatencyMs: number;
    avgInputTokens: number;
    avgOutputTokens: number;
  }> {
    const logs = QueryLogger.readLogs();
    const models: Record<string, {
      requests: number;
      successes: number;
      failures: number;
      totalLatency: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }> = {};

    for (const log of logs) {
      if (!log.modelResults) continue;
      for (const mr of log.modelResults) {
        if (!models[mr.id]) {
          models[mr.id] = { requests: 0, successes: 0, failures: 0, totalLatency: 0, totalInputTokens: 0, totalOutputTokens: 0 };
        }
        const m = models[mr.id];
        m.requests++;
        if (mr.success) {
          m.successes++;
        } else {
          m.failures++;
        }
        m.totalLatency += mr.latencyMs || 0;
        m.totalInputTokens += mr.inputTokens || 0;
        m.totalOutputTokens += mr.outputTokens || 0;
      }
    }

    const result: Record<string, any> = {};
    for (const [id, m] of Object.entries(models)) {
      result[id] = {
        requests: m.requests,
        successes: m.successes,
        failures: m.failures,
        successRate: m.requests > 0 ? (m.successes / m.requests) * 100 : 0,
        avgLatencyMs: m.requests > 0 ? Math.round(m.totalLatency / m.requests) : 0,
        avgInputTokens: m.requests > 0 ? Math.round(m.totalInputTokens / m.requests) : 0,
        avgOutputTokens: m.requests > 0 ? Math.round(m.totalOutputTokens / m.requests) : 0,
      };
    }
    return result;
  }
}
