import { Redis } from '@upstash/redis';
import { CacheProvider } from './types';

export class UpstashRedisProvider implements CacheProvider {
  private client: Redis | null = null;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      try {
        this.client = new Redis({
          url,
          token,
        });
      } catch (err) {
        console.error('[UpstashRedisProvider] Failed to initialize Redis client:', err);
      }
    } else {
      console.warn('[UpstashRedisProvider] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. Cache is disabled.');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    
    try {
      const data = await this.client.get<T>(key);
      return data;
    } catch (err) {
      // Fail open: log the error and return null so the app falls back to DB
      console.error(`[UpstashRedisProvider] Error getting key "${key}":`, err);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      console.error(`[UpstashRedisProvider] Error setting key "${key}":`, err);
    }
  }

  async increment(key: string): Promise<number> {
    if (!this.client) return 0; // Return 0 to gracefully handle missing cache

    try {
      const newValue = await this.client.incr(key);
      return newValue;
    } catch (err) {
      console.error(`[UpstashRedisProvider] Error incrementing key "${key}":`, err);
      return 0; // Return 0 to force cache misses if counter can't be updated
    }
  }
}
