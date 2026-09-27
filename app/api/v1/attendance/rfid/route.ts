import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { memberRoleCode } from '@/lib/auth/member-role';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordDeviceTap } from '@/lib/attendance/record-device-tap';
import { canDeviceAccessInstitution, InvalidCaptureTimeError, parseDeviceCaptureTime } from '@/lib/attendance/device-capture-time';
import { hashCardCredential, verifyCardCredential } from '@/lib/attendance/rfid-credential';

/**
 * RFID attendance — device-auth only.
 *
 * Called by the terminal's SCR_RFID screen after nfcPoll() reads a card UID.
 * Looks up the UID in rfid_cards → organization_members, validates the card,
 * then delegates to the shared attendance core which handles deduplication,
 * session resolution, and record creation.
 *
 * Response includes session/course info so the terminal can show:
 *   "Name — Course, Morning — Marked Present 10:42:07"
 */

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const body = await request.json();
    const { rfid_uid, idempotency_key, captured_at, card_credential } = body;

    if (!rfid_uid || typeof rfid_uid !== 'string') {
      return NextResponse.json({ error: 'rfid_uid is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const normalizedUid = rfid_uid.toUpperCase().trim();

    // A waiting enrollment capture owns the next card tap. Do this before card
    // lookup so brand-new cards can be captured without creating attendance.
    const { data: waitingCapture } = await admin
      .from('rfid_capture_requests')
      .select('id')
      .eq('device_id', device.id)
      .eq('status', 'WAITING')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (waitingCapture) {
      const { error: captureError } = await admin
        .from('rfid_capture_requests')
        .update({
          rfid_uid: normalizedUid,
          credential_hash: typeof card_credential === 'string'
            ? hashCardCredential(card_credential)
            : null,
          status: 'CAPTURED',
        })
        .eq('id', waitingCapture.id)
        .eq('status', 'WAITING');
      if (captureError) throw new Error(`Failed to capture RFID: ${captureError.message}`);
      return NextResponse.json({ success: true, capture: true, attendance_marked: false, message: 'Card captured for enrollment' });
    }

    // Look up the RFID card
    const { data: card, error: cardErr } = await admin
      .from('rfid_cards')
      .select(`
        id, member_id, organization_id, institution_id, status, credential_hash, security_level,
        organization_members!inner (
          id, user_id, institution_id,
          member_roles!organization_member_id ( roles ( code ) ),
          profiles:user_id ( full_name )
        )
      `)
      .eq('rfid_uid', normalizedUid)
      .maybeSingle();

    if (cardErr) {
      console.error('RFID lookup error:', cardErr);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    if (!card) {
      return NextResponse.json({
        success: false,
        attendance_marked: false,
        error: 'unknown_rfid',
        message: 'RFID card not registered',
        rfid_uid: rfid_uid.toUpperCase().trim(),
      }, { status: 404 });
    }

    if (card.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        attendance_marked: false,
        error: 'card_revoked',
        message: 'RFID card has been revoked',
      }, { status: 403 });
    }

    if (card.credential_hash) {
      if (typeof card_credential !== 'string') {
        return NextResponse.json({ error: 'card_credential_required', message: 'Secure card credential is missing' }, { status: 403 });
      }
      if (!verifyCardCredential(card_credential, card.credential_hash)) {
        return NextResponse.json({ error: 'invalid_card_credential', message: 'Secure card authentication failed' }, { status: 403 });
      }
    }

    // Verify the card belongs to the same organization as the device
    if (card.organization_id !== device.organizationId) {
      return NextResponse.json({
        success: false,
        attendance_marked: false,
        error: 'org_mismatch',
        message: 'Card does not belong to this organization',
      }, { status: 403 });
    }

    if (!canDeviceAccessInstitution(device.institutionId, card.institution_id)) {
      return NextResponse.json({
        success: false,
        attendance_marked: false,
        error: 'institution_mismatch',
        message: 'Card is not valid at this institution',
      }, { status: 403 });
    }

    const member = card.organization_members as any;

    // Delegate to the shared attendance core
    const result = await recordDeviceTap({
      admin,
      memberId: card.member_id,
      organizationId: card.organization_id,
      institutionId: card.institution_id,
      deviceId: device.id,
      deviceInstitutionId: device.institutionId,
      method: 'RFID',
      rawUid: normalizedUid,
      idempotencyKey: idempotency_key || null,
      at: parseDeviceCaptureTime(captured_at),
    });

    // Fetch institution name for the response
    let instituteName: string | null = null;
    if (card.institution_id) {
      const { data: inst } = await admin
        .from('institutions')
        .select('name')
        .eq('id', card.institution_id)
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
        institution_id: card.institution_id,
      },
      event_id: result.eventId,
      record_id: result.recordId,
      marked_at: result.markedAt,
      method: 'RFID',
      status: result.status,
      session: result.session,
      resolution: result.resolution,
    }, { status: result.attendanceMarked ? 201 : 200 });

  } catch (err: any) {
    if (err instanceof InvalidCaptureTimeError) {
      return NextResponse.json({ error: 'invalid_capture_time', message: err.message }, { status: 400 });
    }
    console.error('RFID attendance error:', err);
    return legacyError(err);
  }
}
