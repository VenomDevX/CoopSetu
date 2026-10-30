import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { rateLimit, getRateLimitConfig } from '@/lib/security/rate-limit';
import { NATIVE_HEADER, isNativeUserAgent } from '@/lib/native/is-native';

export async function middleware(request: NextRequest) {
  // 0. Bot Protection
  const userAgent = request.headers.get('user-agent') || '';
  if (request.nextUrl.pathname.startsWith('/api/v1/')) {
    const uaLower = userAgent.toLowerCase();
    if (!userAgent || uaLower.includes('curl') || uaLower.includes('python-requests')) {
      return NextResponse.json({ error: 'Forbidden: Invalid User-Agent' }, { status: 403 });
    }
  }

  // 1. Rate Limiting
  // Disabled only under the dedicated e2e test flag (set exclusively by
  // playwright.config.ts's webServer.env — never in dev/production). Real
  // browser test traffic (page loads, prefetches, notification polling)
  // shares one per-IP counter with everything else in the 'api' category, so
  // a full Playwright run can trip the limit on unrelated pages well before
  // any single endpoint's own request budget is exceeded. Rate limiting
  // itself stays fully enforced in dev and prod.
  const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  // Paths are grouped loosely into categories so slight path changes can't
  // bypass the limit; each category has its own counter.
  const { category, limit, windowMs } = getRateLimitConfig(request.nextUrl.pathname);
  const identifier = `${ip}:${category}`;

  const rl = rateLimitDisabled
    ? { success: true, limit, remaining: limit, reset: Date.now() + windowMs }
    : rateLimit(identifier, limit, windowMs);
  if (!rl.success) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rl.limit.toString(),
        'X-RateLimit-Remaining': rl.remaining.toString(),
        'X-RateLimit-Reset': rl.reset.toString(),
        'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString(),
      }
    });
  }

  // 2. Generate Nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // 2. Attach nonce to request headers so Server Components can read it
  request.headers.set('x-nonce', nonce);

  // 2b. Normalize the Capacitor UA sentinel into a single request header, so
  // server components read one boolean instead of each re-parsing the UA.
  // Same request-header mechanism as the nonce above. The delete is the
  // security-relevant half: without it any browser could simply send
  // `x-coopsetu-native: 1` and get the native UI. The blast radius is only
  // cosmetic, but the header must still not be caller-controlled.
  request.headers.delete(NATIVE_HEADER);
  if (isNativeUserAgent(userAgent)) request.headers.set(NATIVE_HEADER, '1');

  // 3. Let Supabase auth middleware handle session updates & route guarding
  const response = await updateSession(request);

  // 4. Construct Content Security Policy
  //
  // media-src and frame-src are open to https: because course content is
  // authored by institute staff and hosted wherever that institute keeps it —
  // a state portal, a CDN, an LMS export. Without them `default-src 'self'`
  // blocks every <video>, <audio> and PDF <iframe> in
  // components/learning/module-player.tsx, which is the entire lesson player.
  // frame-ancestors stays 'none', so widening frame-src lets us embed others
  // and still forbids anyone embedding us.
  const isDev = process.env.NODE_ENV === 'development';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let supabaseOrigin = '';
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  } catch (e) {
    // Ignore invalid URL errors if env var is missing during build/deploy
  }
  const supabaseWsOrigin = supabaseOrigin
    ? supabaseOrigin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    : '';
    
  const connectSrc = [
    "'self'",
    supabaseOrigin,
    supabaseWsOrigin,
    'http://127.0.0.1:54321',
    'ws://127.0.0.1:54321',
    'http://localhost:54321',
    'ws://localhost:54321',
    'https://*.supabase.co',
    'wss://*.supabase.co',
    ...(isDev ? ['ws://localhost:3000', 'ws://127.0.0.1:3000'] : []),
  ].filter(Boolean).join(' ');

  // Next.js fast refresh requires 'unsafe-eval' in dev for scripts.
  const scriptSrc = isDev
    ? `'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: ${supabaseOrigin} http://127.0.0.1:54321 http://localhost:54321;
    font-src 'self' data:;
    media-src 'self' blob: data: https:;
    frame-src 'self' https:;
    connect-src ${connectSrc};
    worker-src 'self' blob:;
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'self';
  `.replace(/\s{2,}/g, ' ').trim();

  // 5. Set Security Headers on the response
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
  response.headers.set('x-nonce', nonce);
  // NOTE: responses now vary by user-agent (see 2b). `Vary: User-Agent` is
  // declared in next.config.ts's headers() rather than here — Next discards a
  // Vary set from middleware on RSC document responses. See that file for why
  // the document responses are safe regardless (they are all no-store).
  
  // Rate Limit Headers for successful responses
  response.headers.set('X-RateLimit-Limit', rl.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rl.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rl.reset.toString());

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
