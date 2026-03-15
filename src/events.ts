// src/events.ts - Event bus for live dashboard updates
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface RequestStartEvent {
  requestId: string;
  timestamp: string;
  contentLength: number;
  type: string;
  models: string[];
}

export interface ModelCompleteEvent {
  requestId: string;
  modelId: string;
  timestamp: string;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
  error?: string;
}

export interface RequestCompleteEvent {
  requestId: string;
  timestamp: string;
  executionTimeMs: number;
  totalCost: number;
  modelCount: number;
  successCount: number;
}

export interface DashboardRequest {
  requestId: string;
  startedAt: string;
  completedAt?: string;
  type: string;
  contentLength: number;
  models: Map<string, ModelCompleteEvent>;
  executionTimeMs?: number;
  totalCost?: number;
}

class EventBus extends EventEmitter {
  private ringBuffer: DashboardRequest[] = [];
  private readonly maxEntries = 100;
  private activeRequests: Map<string, DashboardRequest> = new Map();
  private startTime = Date.now();
  private totalRequests = 0;

  generateRequestId(): string {
    return crypto.randomUUID();
  }

  emitRequestStart(event: RequestStartEvent): void {
    const req: DashboardRequest = {
      requestId: event.requestId,
      startedAt: event.timestamp,
      type: event.type,
      contentLength: event.contentLength,
      models: new Map(),
    };
    this.activeRequests.set(event.requestId, req);
    this.totalRequests++;
    this.emit('request:start', event);
  }

  emitModelComplete(event: ModelCompleteEvent): void {
    const req = this.activeRequests.get(event.requestId);
    if (req) {
      req.models.set(event.modelId, event);
    }
    this.emit('model:complete', event);
  }

  emitRequestComplete(event: RequestCompleteEvent): void {
    const req = this.activeRequests.get(event.requestId);
    if (req) {
      req.completedAt = event.timestamp;
      req.executionTimeMs = event.executionTimeMs;
      req.totalCost = event.totalCost;
      this.addToRingBuffer(req);
      this.activeRequests.delete(event.requestId);
    }
    this.emit('request:complete', event);
  }

  private addToRingBuffer(req: DashboardRequest): void {
    if (this.ringBuffer.length >= this.maxEntries) {
      this.ringBuffer.shift();
    }
    this.ringBuffer.push(req);
  }

  getRecentRequests(): DashboardRequest[] {
    return [...this.ringBuffer].reverse();
  }

  getActiveRequests(): DashboardRequest[] {
    return Array.from(this.activeRequests.values());
  }

  getUptimeMs(): number {
    return Date.now() - this.startTime;
  }

  getTotalRequests(): number {
    return this.totalRequests;
  }
}

export const eventBus = new EventBus();
