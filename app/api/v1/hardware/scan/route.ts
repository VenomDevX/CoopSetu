import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AttendanceService } from '@/services/attendance.service';
import { authenticateDevice } from '@/lib/auth/device-auth';

/**
 * HARDWARE SCAN API
 *
 * Called by an attendance terminal after it scans a trainee's rotating QR.
 * Payload: { "scanned_text": "coopsetu:TRAINEE_ID:TOTP_CODE" }
 *
 * This route previously had **no authentication at all** while building a
 * service-role client, so RLS was bypassed and the trainee's TOTP was the only
 * thing standing between the open internet and an attendance write — with no
 * device identity, no audit of which terminal wrote it, and no way to revoke
 * one. It now requires a device bearer token (0088). The TOTP remains as the
 * second factor: the token says *which terminal*, the TOTP says *which trainee,
 * present now*.
 */
export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const body = await request.json();
    const { scanned_text } = body;

    if (!scanned_text || typeof scanned_text !== 'string') {
      return NextResponse.json({ error: 'scanned_text is required' }, { status: 400 });
    }

    const parts = scanned_text.split(':');
    if (parts.length !== 3 || parts[0] !== 'coopsetu') {
      return NextResponse.json({ error: 'Invalid QR code format' }, { status: 400 });
    }

    const traineeId = parts[1];
    const totpCode = parts[2];

    // Still service-role: the device is not a user and has no RLS identity.
    // The device token is what authorises it, and its organization scope is
    // checked below.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );
    const svc = new AttendanceService(supabase as any);

    const record = await svc.verifyHardwareTotpAndMark(traineeId, totpCode);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Attendance marked successfully via hardware',
        device: device.label,
        record
      }
    });

  } catch (err: any) {
    const status = err.message.includes('No active') || err.message.includes('Invalid') || err.message.includes('not currently assigned') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
