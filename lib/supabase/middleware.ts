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

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/v1/auth/') ||
    pathname.startsWith('/api/v1/dev/') ||
    pathname.startsWith('/api/v1/demo/') ||
    pathname.startsWith('/auth/') ||
    /\.[a-zA-Z0-9]+$/.test(pathname) // static assets
  );
}

/**
 * Refreshes the auth session on every request and guards /dashboard routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  const { data: { user } } = await supabase.auth.getUser();
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
  if (!user && pathname.startsWith('/api/v1/') && !isPublic(pathname)) {
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
