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
  ttl: number;        // seconds
  maxSize: number;    // max entries
  strategy: 'lru';    // Least Recently Used
}

/**
 * LRU Cache with TTL support
 * - Stores review results by content hash
 * - Automatic expiration after TTL
 * - LRU eviction when max capacity reached
 */
export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private accessOrder: string[] = []; // Track LRU

  constructor(config: CacheConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      ttl: config.ttl ?? 86400,        // 24 hours default
      maxSize: config.maxSize ?? 1000,
      strategy: 'lru'
    };
  }

  /**
   * Hash content for cache key
   */
  private hashContent(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return new Date() > entry.expiresAt;
  }

  /**
   * Set cache entry
   */
  public set(content: string, value: T): void {
    if (!this.config.enabled) return;

    const hash = this.hashContent(content);
    const now = new Date();

    // Remove expired entry if exists
    if (this.cache.has(hash)) {
      this.cache.delete(hash);
    }

    // Evict LRU if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Create cache entry
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

  /**
   * Get cache entry
   */
  public get(content: string): T | null {
    if (!this.config.enabled) return null;

    const hash = this.hashContent(content);
    const entry = this.cache.get(hash);

    if (!entry) return null;

    // Check expiration
    if (this.isExpired(entry)) {
      this.cache.delete(hash);
      this.accessOrder = this.accessOrder.filter(h => h !== hash);
      return null;
    }

    // Update access stats for LRU
    entry.accessCount++;
    entry.lastAccessAt = new Date();

    // Move to end of access order (most recently used)
    this.accessOrder = this.accessOrder.filter(h => h !== hash);
    this.accessOrder.push(hash);

    return entry.value;
  }

  /**
   * Check if content exists in cache (without modifying access)
   */
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

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruHash = this.accessOrder.shift()!;
    this.cache.delete(lruHash);
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
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
