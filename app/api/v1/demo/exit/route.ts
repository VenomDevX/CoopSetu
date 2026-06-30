import { NextRequest, NextResponse } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const supabase = await createClient();

    // 1. Validate User
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user && user.is_anonymous) {
      // 2. End session in DB
      const admin = createAdminClient();
      await admin
        .from('demo_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('auth_user_id', user.id);
        
      // 3. Sign out
      await supabase.auth.signOut();
    }
    
    // Clear demo session cookie
    const cookieStore = require('next/headers').cookies();
    cookieStore.delete('handoff_demo_session');

    // Always redirect to login on exit
    return ok({ redirectUrl: '/login' });
  });
}
