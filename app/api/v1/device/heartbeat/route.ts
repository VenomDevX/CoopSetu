import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Device heartbeat — device-auth only.
 *
 * Called by the terminal every ~60 seconds regardless of attendance activity.
 * Updates last_seen_at and status on device_tokens so the web dashboard's
 * Devices page reflects true liveness rather than only activity-driven bumps
 * (authenticateDevice already does a best-effort bump, but only on attendance).
 */
export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('device_tokens')
      .update({
        last_seen_at: new Date().toISOString(),
        status: 'ACTIVE',
      })
      .eq('id', device.id);

    if (error) {
      console.error('Heartbeat update error:', error);
      return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      server_time: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('Heartbeat error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
