import { headers } from 'next/headers';
import { createHmac } from 'crypto';

export interface RequestContext {
  request_id: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
}

// Fallback to SUPABASE_SECRET_KEY if AUDIT_HMAC_SECRET is not provided, 
// and finally a hardcoded dev secret if neither is present.
const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || process.env.SUPABASE_SECRET_KEY || 'dev-fallback-secret';

function hashValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHmac('sha256', HMAC_SECRET).update(value).digest('hex');
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
