import { headers } from 'next/headers';
import { createHmac } from 'crypto';

export interface RequestContext {
  request_id: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
}

// Signing secret for audit-log IP/user-agent hashes. Prefer a dedicated
// AUDIT_HMAC_SECRET, fall back to the server-only SUPABASE_SECRET_KEY. Never
// hardcode a fallback: a known constant would let anyone forge these hashes.
// Outside development we require one to be configured and fail closed.
function getHmacSecret(): string {
  const secret = process.env.AUDIT_HMAC_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUDIT_HMAC_SECRET (or SUPABASE_SECRET_KEY) must be set to hash audit-log request context.',
    );
  }
  // Development/test only: derive an ephemeral per-process secret so hashes are
  // still non-trivial and no constant is baked into the source.
  return `dev-only-${process.pid}-${Math.random().toString(36).slice(2)}`;
}

// Resolve the secret lazily on first use rather than at module load. Evaluating
// it at import time would throw during the Next.js production build (page-data
// collection imports route modules before runtime env vars are available). The
// fail-closed check still runs — just at request time, where it belongs.
let cachedSecret: string | null = null;
function hmacSecret(): string {
  if (cachedSecret === null) cachedSecret = getHmacSecret();
  return cachedSecret;
}

function hashValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHmac('sha256', hmacSecret()).update(value).digest('hex');
}

export async function getRequestContext(): Promise<RequestContext> {
  try {
    const headersList = await headers();

    // Resolve client IP safely
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    let rawIp = realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : null);

    const rawUserAgent = headersList.get('user-agent');

    // Rely on hosting provider (e.g. Vercel) providing a request ID, fallback to generating one
    const requestId = headersList.get('x-request-id') || crypto.randomUUID();

    return {
      request_id: requestId,
      ip_hash: hashValue(rawIp),
      user_agent_hash: hashValue(rawUserAgent),
    };
  } catch {
    // headers() throws outside an active Next.js request (service-layer
    // tests, background jobs, scripts calling services directly) — audit
    // logging should still proceed without request metadata rather than
    // silently dropping the log entry.
    return {
      request_id: crypto.randomUUID(),
      ip_hash: null,
      user_agent_hash: null,
    };
  }
}
