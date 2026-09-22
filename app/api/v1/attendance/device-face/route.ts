import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { memberRoleCode } from '@/lib/auth/member-role';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordDeviceTap } from '@/lib/attendance/record-device-tap';
import { canDeviceAccessInstitution, InvalidCaptureTimeError, parseDeviceCaptureTime } from '@/lib/attendance/device-capture-time';

const MIN_FACE_CONFIDENCE = 0.62;

/**
 * Device face attendance — device-auth only.
 *
 * Called by the terminal's SCR_FACE screen after the CAM reports
 * FACE:<slot>:<confidence>. Resolves the slot→member via face_slots,
 * then delegates to the shared attendance core which handles deduplication,
 * session resolution, and record creation.
 *
 * This is separate from /api/v1/attendance/face which handles the web-based
 * embedding verification flow (session-scoped). This route handles the kiosk's
 * on-device ESP-DL recognition result (slot-based, not embedding-based).
 */

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const body = await request.json();
    const { slot, confidence, idempotency_key, captured_at } = body;

    if (typeof slot !== 'number' || slot < 0) {
      return NextResponse.json({ error: 'slot (non-negative integer) is required' }, { status: 400 });
    }
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < MIN_FACE_CONFIDENCE || confidence > 1) {
      return NextResponse.json({ error: 'low_confidence', message: 'Face match confidence is below the required threshold' }, { status: 422 });
    }

    const admin = createAdminClient();

    // Resolve the face slot to a member — this is device-specific and stays
    // inline (the shared core expects a memberId up front).
    const { data: faceSlot, error: slotErr } = await admin
      .from('face_slots')
      .select(`
        id, member_id, organization_id, institution_id,
        organization_members!inner (
          id, user_id,
          member_roles!organization_member_id ( roles ( code ) ),
          profiles:user_id ( full_name )
        )
      `)
      .eq('device_id', device.id)
      .eq('slot', slot)
      .maybeSingle();

    if (slotErr) {
      console.error('Face slot lookup error:', slotErr);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    if (!faceSlot) {
      return NextResponse.json({
        success: false,
        attendance_marked: false,
        error: 'unknown_slot',
        message: 'Face slot not registered on this device',
        slot,
      }, { status: 404 });
    }

    if (faceSlot.organization_id !== device.organizationId ||
        !canDeviceAccessInstitution(device.institutionId, faceSlot.institution_id)) {
      return NextResponse.json({ error: 'institution_mismatch', message: 'Face slot is outside this device scope' }, { status: 403 });
    }

    const member = faceSlot.organization_members as any;

    // Delegate to the shared attendance core — handles deduplication,
    // session resolution, attendance_records upsert, and resolution stamping.
    const result = await recordDeviceTap({
      admin,
      memberId: faceSlot.member_id,
      organizationId: faceSlot.organization_id,
      institutionId: faceSlot.institution_id,
      deviceId: device.id,
      deviceInstitutionId: device.institutionId,
      method: 'FACE',
      confidence: typeof confidence === 'number' ? confidence : null,
      idempotencyKey: idempotency_key || null,
      at: parseDeviceCaptureTime(captured_at),
    });

    // Fetch institution name for the response
    let instituteName: string | null = null;
    if (faceSlot.institution_id) {
      const { data: inst } = await admin
        .from('institutions')
        .select('name')
        .eq('id', faceSlot.institution_id)
        .maybeSingle();
      instituteName = inst?.name ?? null;
    }

    return NextResponse.json({
      success: true,
      attendance_marked: result.attendanceMarked,
      message: result.message,
      user: {
        id: member.id,
        name: member.profiles?.full_name ?? 'Unknown',
        role: memberRoleCode(member),
        institute: instituteName,
        institution_id: faceSlot.institution_id,
      },
      event_id: result.eventId,
      record_id: result.recordId,
      marked_at: result.markedAt,
      method: 'FACE',
      status: result.status,
      session: result.session,
      resolution: result.resolution,
      confidence,
    }, { status: result.attendanceMarked ? 201 : 200 });

  } catch (err: any) {
    if (err instanceof InvalidCaptureTimeError) {
      return NextResponse.json({ error: 'invalid_capture_time', message: err.message }, { status: 400 });
    }
    console.error('Device face attendance error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
