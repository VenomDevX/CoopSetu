import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { Errors } from '@/lib/api/errors';
import { GITHUB_OAUTH_STATE_COOKIE } from '@/lib/integrations/github-oauth';

export async function GET(req: NextRequest) {
  try {
    // Basic auth check
    await requireUser();

    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      throw Errors.internal('Missing GitHub Client ID');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/v1/integrations/github/callback`;
    const scope = 'repo,read:org';

    // CSRF protection: a real random state, stored in a short-lived httpOnly
    // cookie here and validated against the returned `state` query param in
    // the callback route before any token exchange happens.
    const state = crypto.randomBytes(24).toString('hex');

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

    const res = NextResponse.redirect(githubAuthUrl);
    res.cookies.set(GITHUB_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: error.status || 500 });
  }
}
