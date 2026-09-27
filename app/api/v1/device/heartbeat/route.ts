import { legacyError } from '@/lib/api/response';
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
    const body = await request.json().catch(() => ({}));
    const telemetry = body?.telemetry && typeof body.telemetry === 'object' && !Array.isArray(body.telemetry)
      ? body.telemetry
      : {};
    if (JSON.stringify(telemetry).length > 4096) {
      return NextResponse.json({ error: 'Telemetry payload too large' }, { status: 413 });
    }
    const bootedAt = typeof body.booted_at === 'string' && Number.isFinite(Date.parse(body.booted_at))
      ? new Date(body.booted_at).toISOString()
      : null;

    const { error } = await admin
      .from('device_tokens')
      .update({
        last_seen_at: new Date().toISOString(),
        status: 'ACTIVE',
        firmware_version: typeof body.firmware_version === 'string' ? body.firmware_version.slice(0, 64) : null,
        telemetry,
        last_boot_at: bootedAt,
        last_reset_reason: typeof body.reset_reason === 'string' ? body.reset_reason.slice(0, 128) : null,
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
    return legacyError(err);
  }
}
