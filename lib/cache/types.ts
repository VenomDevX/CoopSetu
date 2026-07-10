export interface CacheProvider {
  /**
   * Retrieves a value from the cache.
   * @param key The cache key
   * @returns The parsed value, or null if not found or expired.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Stores a value in the cache with a specified Time-To-Live (TTL).
   * @param key The cache key
   * @param value The value to store
   * @param ttlSeconds TTL in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Increments a numeric counter in the cache (useful for versioned invalidation).
   * If the key does not exist, it starts at 0 and increments to 1.
   * @param key The cache key
   * @returns The incremented value
   */
  increment(key: string): Promise<number>;
}
