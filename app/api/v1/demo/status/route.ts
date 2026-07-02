import { NextRequest, NextResponse } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const supabase = await createClient();

    // 1. Check User
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.is_anonymous) {
      return ok({ active: false });
    }

    // 2. Check Session
    const admin = createAdminClient();
    const { data: session } = await admin
      .from('demo_sessions')
      .select('*')
      .eq('auth_user_id', user.id)
      .is('ended_at', null)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return ok({ active: false });
    }
    
    // 3. Update last_active_at asynchronously (fire and forget)
    admin.from('demo_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', session.id)
      .then();

    return ok({
      active: true,
      role: session.active_demo_role,
      expiresAt: session.expires_at,
    });
  });
}
