import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Dedicated exchange endpoint for the password-recovery link (separate from
 * /auth/callback, which is OAuth-specific and always routes through the
 * onboarding resolver — recovery must land directly on /reset-password, not
 * get funneled through onboarding).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/forgot-password', url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/forgot-password', url.origin));
  }

  return NextResponse.redirect(new URL('/reset-password', url.origin));
}
