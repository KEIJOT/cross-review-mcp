// src/cache.ts - LRU Cache with TTL for review results (v0.6.0)

import * as crypto from 'crypto';

export interface CacheEntry<T> {
  value: T;
  hash: string;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessAt: Date;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru';
}

export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private accessOrder: string[] = [];

  constructor(config: CacheConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      ttl: config.ttl ?? 86400,
      maxSize: config.maxSize ?? 1000,
      strategy: 'lru'
    };
  }

  private hashContent(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return new Date() > entry.expiresAt;
  }

  public set(content: string, value: T): void {
    if (!this.config.enabled) return;

    const hash = this.hashContent(content);
    const now = new Date();

    if (this.cache.has(hash)) {
      this.cache.delete(hash);
    }

    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      hash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.ttl * 1000),
      accessCount: 0,
      lastAccessAt: now
    };

    this.cache.set(hash, entry);
    this.accessOrder.push(hash);
  }

  public get(content: string): T | null {
    if (!this.config.enabled) return null;

    const hash = this.hashContent(content);
    const entry = this.cache.get(hash);

    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.cache.delete(hash);
      this.accessOrder = this.accessOrder.filter(h => h !== hash);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessAt = new Date();

    this.accessOrder = this.accessOrder.filter(h => h !== hash);
    this.accessOrder.push(hash);

    return entry.value;
  }

  public has(content: string): boolean {
    if (!this.config.enabled) return false;

    const hash = this.hashContent(content);
    const entry = this.cache.get(hash);

    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(hash);
      return false;
    }

    return true;
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruHash = this.accessOrder.shift()!;
    this.cache.delete(lruHash);
  }

  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  public getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      entries: Array.from(this.cache.values()).map(e => ({
        hash: e.hash.substring(0, 8),
        createdAt: e.createdAt.toISOString(),
        expiresAt: e.expiresAt.toISOString(),
        accessCount: e.accessCount,
        isExpired: this.isExpired(e)
      }))
    };
  }
}
