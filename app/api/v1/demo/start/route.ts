import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { provisionDemoWorkspace } from '@/lib/demo/provision-demo-workspace';

const schema = z.object({
  role: z.string(),
}).strict();

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  
  // Demo start: 5 requests per 15 minutes per IP
  if (!(await checkRateLimit(ip, 5, 900))) {
    return NextResponse.json({ data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many demo requests. Please try again later.' } }, { status: 429 });
  }

  return handle(async () => {
    const body = schema.parse(await req.json());
    const supabase = await createClient();

    // Prevent overwriting an active demo if they already have one
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      if (currentUser.is_anonymous) {
        throw Errors.validation('You already have an active demo session. Please exit or reset it first.');
      } else {
        throw Errors.validation('You are already logged into a real account. Please sign out before starting a demo.');
      }
    }

    // 1. Sign in anonymously
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError || !authData.user) {
      throw Errors.internal(`Failed to initialize anonymous session: ${authError?.message}`);
    }

    const authUserId = authData.user.id;

    // 2. Provision Demo Workspace
    try {
      await provisionDemoWorkspace(authUserId, body.role);
    } catch (e: any) {
      throw Errors.internal(`Failed to provision demo workspace: ${e.message}`);
    }

    const cookieStore = require('next/headers').cookies();
    cookieStore.set('handoff_demo_session', 'true', {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24
    });

    return ok({ redirectUrl: '/dashboard' });
  });
}
