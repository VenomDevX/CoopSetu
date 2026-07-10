import { createAdminClient } from '@/lib/supabase/admin';

// In-memory fallback used when the DB rate-limit RPC is unavailable.
// Keyed by `${ip}:${maxAttempts}:${windowSeconds}` so different limits don't collide.
const _fallback = new Map<string, { count: number; expiresAt: number }>();

function checkInMemory(ip: string, maxAttempts: number, windowSeconds: number): boolean {
  const key = `${ip}:${maxAttempts}:${windowSeconds}`;
  const now = Date.now();
  const entry = _fallback.get(key);

  if (!entry || entry.expiresAt <= now) {
    _fallback.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

// Distributed Rate Limiter backed by Supabase RPC.
// Falls back to an in-memory counter (per instance) when the DB is unavailable,
// so the limiter fails closed rather than open.
export async function checkRateLimit(
  ip: string | undefined,
  maxAttempts = 5,
  windowSeconds = 300,
): Promise<boolean> {
  if (!ip) return true;
  if (process.env.NODE_ENV === 'development') return true;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip: ip,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error('Rate limit RPC error — falling back to in-memory limiter:', error);
      return checkInMemory(ip, maxAttempts, windowSeconds);
    }

    return data as boolean;
  } catch (err) {
    console.error('Rate limit error — falling back to in-memory limiter:', err);
    return checkInMemory(ip, maxAttempts, windowSeconds);
  }
}
