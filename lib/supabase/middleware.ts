import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/', '/login', '/signup', '/forgot-password', '/reset-password',
  '/pricing', '/product', '/solutions', '/enterprise', '/ai', '/security',
];

const MULTIPART_API_PATHS = new Set([
  '/api/v1/projects/imports/preview',
  '/api/v1/profile/avatar',
]);

// Routes that call authenticateDevice() themselves and so may be reached with
// only a device bearer token. /api/v1/rfid/* (register, [uid]) is matched by
// prefix at the call site. Every endpoint in firmware/CoopSetuTerminal/api.cpp
// that validates a device token must be listed, or the terminal gets a 401 here
// before its route ever runs.
const DEVICE_AUTH_PATHS = new Set([
  '/api/v1/attendance/qr',
  '/api/v1/attendance/rfid',
  '/api/v1/attendance/device-face',
  '/api/v1/device/heartbeat',
  '/api/v1/hardware/scan',
  '/api/v1/users/search',
  '/api/v1/rfid/capture',
  '/api/v1/face-slots',
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/v1/auth/') ||
    pathname.startsWith('/api/v1/dev/') ||
    pathname.startsWith('/api/v1/demo/') ||
    // Attendance hardware has no cookie session, so it cannot pass this guard.
    // These routes authenticate the device themselves with a bearer token
    // (lib/auth/device-auth.ts) — being listed here means "the route owns its
    // own auth", not "open". /api/v1/hardware/scan was genuinely unauthenticated
    // until 0088 added that check.
    pathname.startsWith('/api/v1/hardware/') ||
    pathname.startsWith('/api/v1/attendance/totp') ||
    // Public certificate verification: anyone holding a certificate number
    // (e.g. an employer scanning its QR code) must be able to check it without
    // an account. Scoped to the exact verify path — the rest of
    // /api/v1/certificates (list/issue/revoke) stays authenticated.
    pathname === '/api/v1/certificates/verify' ||
    // Public contact form (app/contact/page.tsx): anonymous visitors must be
    // able to submit it without an account.
    pathname === '/api/v1/contact' ||
    pathname.startsWith('/auth/') ||
    /\.[a-zA-Z0-9]+$/.test(pathname) // static assets
  );
}

/**
 * Refreshes the auth session on every request and guards /dashboard routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  let user = null;
  const supabaseUrl = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
              response = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options),
              );
            },
          },
        },
      );
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (e) {
      // Ignore auth errors if misconfigured
    }
  }

  const { pathname } = request.nextUrl;

  // 1. CSRF Mitigation for API routes (enforce application/json for state-changing requests)
  if (pathname.startsWith('/api/v1/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const contentType = request.headers.get('content-type') || '';
    const allowedMultipart = MULTIPART_API_PATHS.has(pathname) && contentType.includes('multipart/form-data');
    if (!contentType.includes('application/json') && !allowedMultipart) {
      return NextResponse.json({ error: 'Unsupported Media Type: Must be application/json' }, { status: 415 });
    }
  }

  // 2. Global API Guarding (Reject unauthenticated /api/v1/* requests)
  //
  // One exception: an attendance terminal presents `Authorization: Bearer` and
  // has no cookie, so it would be rejected here before its route could check
  // the credential. Only the attendance endpoints that actually implement
  // device auth are exempted, and only when such a header is present — the
  // route still validates it, so a bogus bearer gains nothing.
  const bearsDeviceToken =
    /^Bearer\s+\S+/i.test(request.headers.get('authorization') || '') &&
    (DEVICE_AUTH_PATHS.has(pathname) || pathname.startsWith('/api/v1/rfid/'));

  if (!user && pathname.startsWith('/api/v1/') && !isPublic(pathname) && !bearsDeviceToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (!user && pathname.startsWith('/invite/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const redirectRes = NextResponse.redirect(url);
    redirectRes.cookies.set('invite_return_to', pathname, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    return redirectRes;
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export { isPublic };
