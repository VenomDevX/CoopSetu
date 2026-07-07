import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, getRateLimitConfig } from '@/lib/security/rate-limit';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limit and blocks when exceeded', () => {
    const ip = '127.0.0.1';
    const limit = 2;
    const windowMs = 1000;

    // Request 1
    let res = rateLimit(ip, limit, windowMs);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(1);

    // Request 2
    res = rateLimit(ip, limit, windowMs);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(0);

    // Request 3 (Exceeds limit)
    res = rateLimit(ip, limit, windowMs);
    expect(res.success).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it('resets window after expiration', () => {
    const ip = '192.168.1.1';
    const limit = 1;
    const windowMs = 5000;

    let res = rateLimit(ip, limit, windowMs);
    expect(res.success).toBe(true);
    
    res = rateLimit(ip, limit, windowMs);
    expect(res.success).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(5001);

    // Should succeed again
    res = rateLimit(ip, limit, windowMs);
    expect(res.success).toBe(true);
  });

  it('returns correct configurations based on route', () => {
    expect(getRateLimitConfig('/api/v1/auth/login').limit).toBe(500);
    expect(getRateLimitConfig('/login').limit).toBe(500);
    expect(getRateLimitConfig('/api/v1/projects').limit).toBe(100);
    expect(getRateLimitConfig('/dashboard').limit).toBe(1000);
  });
});
