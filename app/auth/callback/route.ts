import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function loginError(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin));
}

export async function GET(req: Request) {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const origin = `${protocol}://${host}`;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error') || url.searchParams.get('error_description');
  const nextParam = url.searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  if (oauthError) {
    console.error('OAuth callback error parameter:', oauthError);
    return loginError(origin, 'GitHub sign-in was cancelled or failed.');
  }

  if (!code) {
    return loginError(origin, 'Invalid sign-in request.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('Auth callback exchangeCodeForSession error:', error);
    return loginError(origin, 'Could not complete GitHub sign-in. Please try again.');
  }

  if (!data.user.email) {
    await supabase.auth.signOut();
    return loginError(origin, 'Your GitHub account must have a verified email address to sign in.');
  }

  // The /onboarding resolver checks profile completion, invites, membership, and
  // workspace setup, then redirects to the right destination (including /dashboard
  // for a fully set up user) — no need to duplicate that logic here.
  const target = safeNext ? `/onboarding?next=${encodeURIComponent(safeNext)}` : '/onboarding';
  return NextResponse.redirect(new URL(target, origin));
}
