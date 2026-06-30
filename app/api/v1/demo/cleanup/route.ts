import { NextRequest, NextResponse } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw Errors.unauthenticated('Invalid cron secret');
    }

    const admin = createAdminClient();

    // Find expired demo sessions
    const { data: expiredSessions, error: findError } = await admin
      .from('demo_sessions')
      .select('id, organization_id, auth_user_id')
      .lt('expires_at', new Date().toISOString());

    if (findError) {
      throw Errors.internal(`Failed to find expired sessions: ${findError.message}`);
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const session of expiredSessions ?? []) {
      try {
        // 1. Delete organization (cascades to demo_sessions and all demo data)
        const { error: orgError } = await admin
          .from('organizations')
          .delete()
          .eq('id', session.organization_id)
          .eq('is_demo', true);

        if (orgError) {
          errors.push(`Failed to delete org ${session.organization_id}: ${orgError.message}`);
          continue;
        }

        // 2. Delete anonymous auth user
        const { error: authError } = await admin.auth.admin.deleteUser(session.auth_user_id);
        if (authError) {
          errors.push(`Failed to delete auth user ${session.auth_user_id}: ${authError.message}`);
        }

        deletedCount++;
      } catch (err: any) {
        errors.push(`Unexpected error cleaning up session ${session.id}: ${err.message}`);
      }
    }

    return ok({
      success: true,
      processed: expiredSessions?.length ?? 0,
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  });
}
