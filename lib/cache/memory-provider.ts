import { CacheProvider } from './types';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryProvider implements CacheProvider {
  private cache = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async increment(key: string): Promise<number> {
    const entry = this.cache.get(key);
    
    // We treat incremented values as having no specific TTL (or effectively infinite)
    // in this basic memory provider, mirroring typical Redis counter behavior
    // unless explicitly given an expiry later.
    let currentValue = 0;
    if (entry && Date.now() <= entry.expiresAt && typeof entry.value === 'number') {
      currentValue = entry.value;
    }
    
    const newValue = currentValue + 1;
    // Set a very long TTL for counters (e.g. 30 days) to prevent memory leaks in dev
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    
    this.cache.set(key, { value: newValue, expiresAt });
    return newValue;
  }
}
