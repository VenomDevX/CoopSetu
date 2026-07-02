import { NextRequest, NextResponse } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { resetDemoWorkspace } from '@/lib/demo/reset-demo-workspace';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const supabase = await createClient();

    // 1. Validate Anonymous User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.is_anonymous) {
      throw Errors.unauthenticated('No active demo session found.');
    }

    // Rate Limit: 3 resets per hour per demo session
    if (!(await checkRateLimit(`demo_reset_${user.id}`, 3, 3600))) {
      return NextResponse.json({ data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many demo resets. Please try again later.' } }, { status: 429 });
    }

    try {
      await resetDemoWorkspace(user.id);
    } catch (e: any) {
      throw Errors.internal(e.message);
    }

    return ok({ success: true });
  });
}
