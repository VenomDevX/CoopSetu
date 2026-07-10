import { CacheProvider } from './types';
import { MemoryProvider } from './memory-provider';
import { UpstashRedisProvider } from './redis-provider';

class CacheService {
  private provider: CacheProvider;

  constructor() {
    // In production/preview environments we prefer Redis, otherwise Memory
    if (process.env.NODE_ENV === 'production' || process.env.UPSTASH_REDIS_REST_URL) {
      this.provider = new UpstashRedisProvider();
    } else {
      this.provider = new MemoryProvider();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return this.provider.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    return this.provider.set(key, value, ttlSeconds);
  }

  /**
   * Retrieves the current version number for a given cache scope.
   * If it doesn't exist, it defaults to 0.
   */
  async getCacheVersion(scopeKey: string): Promise<number> {
    const version = await this.provider.get<number>(scopeKey);
    return version || 0;
  }

  /**
   * Increments the cache version for a specific scope, effectively invalidating
   * all cached items that rely on this version.
   */
  async incrementCacheVersion(scopeKey: string): Promise<number> {
    return this.provider.increment(scopeKey);
  }
}

// Export a singleton instance
export const cache = new CacheService();
