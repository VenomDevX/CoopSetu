import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/services/attendance.service';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { recordDeviceTap } from '@/lib/attendance/record-device-tap';
import { TOTP } from 'totp-generator';
import { InvalidCaptureTimeError, parseDeviceCaptureTime } from '@/lib/attendance/device-capture-time';

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
    // Two legitimate callers, and neither is anonymous:
    //   * an attendance terminal presenting a device bearer token;
    //   * a trainer scanning a trainee's ID from their own phone
    //     (components/attendance/qr-scanner.tsx), authenticated by session.
    //
    // The session path exists so an institute without hardware can still take
    // attendance. It is not a weaker door: it requires a real membership, and
    // the trainee's rotating TOTP is still the second factor either way.
    const device = await authenticateDevice(request);
    let scannedBy = device?.label ?? null;

    if (!device) {
      const membership = await getCurrentMembership();
      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
      }
      const sessionClient = await createSessionClient();
      const { data: auth } = await sessionClient.auth.getUser();
      if (!auth?.user) {
        return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
      }
      scannedBy = 'browser session';
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

    const userId = parts[1];
    const totpCode = parts[2];

    const admin = createAdminClient();

    if (device) {
      const capturedAt = parseDeviceCaptureTime(body.captured_at);
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, totp_secret')
        .eq('id', userId)
        .maybeSingle();
      if (!profile?.totp_secret) {
        return NextResponse.json({ error: 'User QR is not registered' }, { status: 404 });
      }

      const now = capturedAt.getTime();
      let valid = false;
      for (let offset = -30_000; offset <= 30_000; offset += 30_000) {
        const { otp } = await TOTP.generate(profile.totp_secret, { timestamp: now + offset });
        if (otp === totpCode) {
          valid = true;
          break;
        }
      }
      if (!valid) {
        return NextResponse.json({ error: 'Invalid or expired QR code' }, { status: 400 });
      }

      let memberQuery = admin
        .from('organization_members')
        .select('id, organization_id, institution_id')
        .eq('user_id', userId)
        .eq('organization_id', device.organizationId)
        .eq('is_active', true);
      // Same rule as canDeviceAccessInstitution: a pinned device accepts its own
      // institution's members and national-scope members (institution NULL).
      if (device.institutionId) {
        memberQuery = memberQuery.or(`institution_id.eq.${device.institutionId},institution_id.is.null`);
      }
      const { data: member } = await memberQuery.maybeSingle();
      if (!member) {
        return NextResponse.json(
          { error: 'This person does not belong to the device institution' },
          { status: 403 },
        );
      }

      const result = await recordDeviceTap({
        admin,
        memberId: member.id,
        organizationId: member.organization_id,
        institutionId: member.institution_id,
        deviceId: device.id,
        deviceInstitutionId: device.institutionId,
        method: 'QR',
        // Do not persist the rotating one-time code in the audit trail.
        rawUid: `TOTP:${userId}`,
        idempotencyKey: body.idempotency_key || null,
        at: capturedAt,
      });

      return NextResponse.json({
        success: true,
        attendance_marked: result.attendanceMarked,
        message: result.message,
        user: { name: profile.full_name || 'Unknown' },
        event_id: result.eventId,
        record_id: result.recordId,
        marked_at: result.markedAt,
        method: 'QR',
        status: result.status,
        session: result.session,
        resolution: result.resolution,
      }, { status: result.attendanceMarked ? 201 : 200 });
    }

    // Browser/trainer path retains the session-scoped service flow.
    const svc = new AttendanceService(admin as never);
    const record = await svc.verifyHardwareTotpAndMark(userId, totpCode);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Attendance marked successfully via hardware',
        scanned_by: scannedBy,
        record
      }
    });

  } catch (err: any) {
    if (err instanceof InvalidCaptureTimeError) {
      return NextResponse.json({ error: 'invalid_capture_time', message: err.message }, { status: 400 });
    }
    const status = err.message.includes('No active') || err.message.includes('Invalid') || err.message.includes('not currently assigned') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
