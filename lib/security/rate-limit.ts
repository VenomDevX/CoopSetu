interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

/**
 * Clean up expired records to prevent memory leaks over time.
 * Runs occasionally.
 */
function cleanupStore() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}

// Run cleanup every 10 minutes in the background
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStore, 10 * 60 * 1000).unref?.();
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in ms
}

/**
 * Basic in-memory fixed-window rate limiter.
 * Ideal for Node.js container deployments. If deploying to serverless (Vercel),
 * this acts per-isolate. 
 *
 * @param identifier The unique key to rate limit (e.g. hashed IP + route category).
 * @param limit Maximum requests allowed in the window.
 * @param windowMs The time window in milliseconds.
 * @returns RateLimitResult containing headers and success flag.
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let record = store.get(identifier);

  if (!record || now > record.resetAt) {
    // New window
    record = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  record.count++;
  store.set(identifier, record);

  const remaining = Math.max(0, limit - record.count);

  return {
    success: record.count <= limit,
    limit,
    remaining,
    reset: record.resetAt,
  };
}

/**
 * Returns configuration for different route categories.
 */
export function getRateLimitConfig(pathname: string) {
  if (pathname.startsWith('/api/v1/auth') || pathname === '/login' || pathname === '/signup') {
    // 500 requests per 5 minutes for auth endpoints
    return { limit: 500, windowMs: 5 * 60 * 1000 };
  }
  
  if (pathname.startsWith('/api/v1/')) {
    // 100 requests per minute for standard API routes
    return { limit: 100, windowMs: 60 * 1000 };
  }

  // 1000 requests per minute for static/page assets
  return { limit: 1000, windowMs: 60 * 1000 };
}
