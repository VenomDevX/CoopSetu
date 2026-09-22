import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { AttendanceService } from '@/services/attendance.service';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordDeviceTap } from '@/lib/attendance/record-device-tap';
import { canDeviceAccessInstitution, InvalidCaptureTimeError, parseDeviceCaptureTime } from '@/lib/attendance/device-capture-time';

/**
 * Two callers, two credentials.
 *
 *  - An attendance terminal presents a device bearer token (0088). It has no
 *    cookie session, which is why the ESP32 firmware could not use this route
 *    at all before. It supplies trainee_id, because it just scanned that
 *    trainee's card or recognised their face. The device branch now delegates
 *    to the shared attendance core so the tap writes attendance_records and
 *    resolves a session — not just a device_attendance_events row.
 *  - A signed-in user scans the session QR in a browser. trainee_id is then
 *    resolved from their own session and never read from the body — otherwise
 *    anyone holding a session QR could mark anyone else present. This branch
 *    continues using AttendanceService unchanged.
 *
 * Previously this route made no authentication call of any kind.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate before touching the body, so a caller with no credential
    // never reaches request parsing.
    const device = await authenticateDevice(request);

    const body = await request.json();
    const { qr_token } = body;
    if (!qr_token) {
      return NextResponse.json({ error: 'qr_token required' }, { status: 400 });
    }

    if (device) {
      // ── Device branch: resolve trainee → member, delegate to shared core ──
      if (!body.trainee_id) {
        return NextResponse.json({ error: 'trainee_id required' }, { status: 400 });
      }

      const admin = createAdminClient();

      // Resolve trainee_id → organization_members.id
      const { data: trainee } = await admin
        .from('trainees')
        .select('id, user_id, organization_id')
        .eq('id', body.trainee_id)
        .maybeSingle();

      if (!trainee) {
        return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
      }

      const { data: orgMember } = await admin
        .from('organization_members')
        .select('id, institution_id')
        .eq('user_id', trainee.user_id)
        .eq('organization_id', trainee.organization_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!orgMember) {
        return NextResponse.json({ error: 'Organization member not found' }, { status: 404 });
      }
      if (trainee.organization_id !== device.organizationId ||
          !canDeviceAccessInstitution(device.institutionId, orgMember.institution_id)) {
        return NextResponse.json({ error: 'This person is outside the device institution' }, { status: 403 });
      }

      // The QR token must be a live session QR from this organization, and the
      // trainee must be enrolled in that session's batch — the same check the
      // web branch gets from markAttendanceByQR. Without it a device token alone
      // could mark any trainee present.
      const { data: qrSession } = await admin
        .from('attendance_sessions')
        .select('id, batch_id, qr_expires_at, batches!inner ( organization_id )')
        .eq('qr_token', qr_token)
        .eq('is_active', true)
        .eq('batches.organization_id', device.organizationId)
        .maybeSingle();
      if (!qrSession) {
        return NextResponse.json({ error: 'Invalid or expired QR code' }, { status: 400 });
      }
      if (!qrSession.qr_expires_at || new Date(qrSession.qr_expires_at) < new Date()) {
        return NextResponse.json({ error: 'QR code has expired' }, { status: 400 });
      }
      const { data: enrollment } = await admin
        .from('enrollments')
        .select('id')
        .eq('trainee_id', trainee.id)
        .eq('batch_id', qrSession.batch_id)
        .eq('status', 'ENROLLED')
        .limit(1)
        .maybeSingle();
      if (!enrollment) {
        return NextResponse.json({ error: 'Trainee is not enrolled in this session' }, { status: 403 });
      }

      const result = await recordDeviceTap({
        admin,
        memberId: orgMember.id,
        organizationId: trainee.organization_id,
        institutionId: orgMember.institution_id,
        deviceId: device.id,
        deviceInstitutionId: device.institutionId,
        method: 'QR',
        rawUid: qr_token,
        idempotencyKey: body.idempotency_key || null,
        at: parseDeviceCaptureTime(body.captured_at),
      });

      return NextResponse.json({
        success: true,
        attendance_marked: result.attendanceMarked,
        message: result.message,
        event_id: result.eventId,
        record_id: result.recordId,
        marked_at: result.markedAt,
        method: 'QR',
        status: result.status,
        session: result.session,
        resolution: result.resolution,
      }, { status: result.attendanceMarked ? 201 : 200 });

    } else {
      // ── Web branch: unchanged — uses AttendanceService ──
      const membership = await getCurrentMembership();
      if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { data: trainee } = await supabase
        .from('trainees')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('organization_id', membership.organizationId)
        .maybeSingle();

      if (!trainee) {
        return NextResponse.json(
          { error: 'Only a trainee can check themselves in. Use a terminal to mark others.' },
          { status: 403 },
        );
      }

      const svc = new AttendanceService(supabase as never);
      const record = await svc.markAttendanceByQR(qr_token, trainee.id);

      return NextResponse.json({ data: record }, { status: 201 });
    }
  } catch (err: any) {
    if (err instanceof InvalidCaptureTimeError) {
      return NextResponse.json({ error: 'invalid_capture_time', message: err.message }, { status: 400 });
    }
    const status = err.message.includes('expired') || err.message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
