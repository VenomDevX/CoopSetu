import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

import { checkRateLimit } from '@/lib/auth/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('returns true immediately when there is no IP', async () => {
    expect(await checkRateLimit(undefined, 5, 60)).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('delegates to the DB RPC and returns its result', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    const result = await checkRateLimit('203.0.113.5', 5, 60);
    expect(result).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith('check_rate_limit', {
      p_ip: '203.0.113.5',
      p_max_attempts: 5,
      p_window_seconds: 60,
    });
  });

  it('falls back to an in-memory limiter and enforces it when the RPC errors', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc unavailable') });
    const key = `account:fallback-test-${Date.now()}@example.com`;

    expect(await checkRateLimit(key, 2, 60)).toBe(true);
    expect(await checkRateLimit(key, 2, 60)).toBe(true);
    expect(await checkRateLimit(key, 2, 60)).toBe(false);
  });

  it('keys the fallback limiter per identifier+threshold so different accounts do not collide', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc unavailable') });
    const keyA = `account:a-${Date.now()}@example.com`;
    const keyB = `account:b-${Date.now()}@example.com`;

    expect(await checkRateLimit(keyA, 1, 60)).toBe(true);
    expect(await checkRateLimit(keyA, 1, 60)).toBe(false);
    // A different account's own budget is untouched by A's lockout.
    expect(await checkRateLimit(keyB, 1, 60)).toBe(true);
  });
});
