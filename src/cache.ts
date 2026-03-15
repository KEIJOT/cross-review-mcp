// src/cache.ts - Caching Layer for Review Results (v0.6.0, 2026-03-15)

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface CacheConfig {
  enabled: boolean;
  ttl: number;          // Time to live in seconds
  maxSize: number;      // Max entries
  strategy: 'lru' | 'fifo';  // Eviction strategy
  directory?: string;   // Where to store cache
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  hits: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: CacheConfig) {
    this.config = config;
    if (config.enabled && config.directory) {
      this.loadFromDisk();
    }
  }

  /**
   * Generate cache key from content hash
   */
  private generateKey(content: string, type: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(content + type)
      .digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Get value from cache
   */
  get(content: string, type: string): any | null {
    if (!this.config.enabled) return null;

    const key = this.generateKey(content, type);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > this.config.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Hit!
    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(content: string, type: string, value: any): void {
    if (!this.config.enabled) return;

    const key = this.generateKey(content, type);

    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
    });

    if (this.config.directory) {
      this.saveToDisk();
    }
  }

  /**
   * Evict oldest or least-used entry
   */
  private evict(): void {
    if (this.config.strategy === 'lru') {
      // Evict least recently used
      let oldest: CacheEntry | null = null;
      let oldestKey: string | null = null;

      for (const [key, entry] of this.cache.entries()) {
        if (!oldest || entry.timestamp < oldest.timestamp) {
          oldest = entry;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    } else {
      // FIFO: evict first entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    if (this.config.directory) {
      try {
        fs.unlinkSync(this.getCacheFilePath());
      } catch (e) {
        // File doesn't exist
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Number(hitRate.toFixed(2)),
      evictions: this.stats.evictions,
      totalSize: this.cache.size,
      maxSize: this.config.maxSize,
      entries: this.cache.size,
    };
  }

  /**
   * Persist cache to disk
   */
  private saveToDisk(): void {
    if (!this.config.directory) return;

    try {
      const data = Array.from(this.cache.values());
      fs.writeFileSync(
        this.getCacheFilePath(),
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error: any) {
      console.error('[Cache] Failed to save to disk:', error.message);
    }
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    if (!this.config.directory) return;

    try {
      const filepath = this.getCacheFilePath();
      if (fs.existsSync(filepath)) {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        data.forEach((entry: CacheEntry) => {
          this.cache.set(entry.key, entry);
        });
        console.error(`[Cache] Loaded ${data.length} entries from disk`);
      }
    } catch (error: any) {
      console.error('[Cache] Failed to load from disk:', error.message);
    }
  }

  /**
   * Get cache file path
   */
  private getCacheFilePath(): string {
    return path.join(
      this.config.directory || process.cwd(),
      '.llmapi_cache.json'
    );
  }
}
