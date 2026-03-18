// query-logger.ts — Structured logging for all MCP queries and LLM interactions
// Logs to /var/log/llmapi-queries.log with full Q&A for learning/debugging

import * as fs from 'fs';
import { eventBus } from './events.js';

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
  
  // Status
  success: boolean;
  error?: string;
}

const LOG_PATH = process.env.LLMAPI_LOG_PATH || '/var/log/llmapi-queries.log';
const REQUEST_LOGS = new Map<string, Partial<QueryLog>>();

export class QueryLogger {
  constructor(eventBusInstance: typeof eventBus) {
    this.setupEventListeners(eventBusInstance);
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
        reviewType: data.reviewType || '',
        modelsRequested: data.models || [],
        success: false,
      });
    });

    // Listen to request completion
    eventBusInstance.on('request:complete', (data: any) => {
      const requestId = data.requestId;
      const log = REQUEST_LOGS.get(requestId);
      
      if (log) {
        log.verdict = data.verdict;
        log.verdictSummary = data.verdictSummary?.substring(0, 500); // Truncate long verdicts
        log.cost = data.totalCost;
        log.latencyMs = data.executionTimeMs;
        log.success = true;
        
        this.writeLog(log as QueryLog);
        REQUEST_LOGS.delete(requestId);
      }
    });
  }

  private writeLog(log: QueryLog) {
    try {
      fs.appendFileSync(LOG_PATH, JSON.stringify(log) + '\n');
    } catch (err) {
      console.error(`Failed to write query log: ${err}`);
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
}
