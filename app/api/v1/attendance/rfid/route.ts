import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice, type DeviceIdentity } from '@/lib/auth/device-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * RFID attendance — device-auth only.
 *
 * Called by the terminal's SCR_RFID screen after nfcPoll() reads a card UID.
 * Looks up the UID in rfid_cards → organization_members, checks for duplicates
 * within a configurable window, and inserts a device_attendance_event.
 */

const DEDUPE_WINDOW_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const body = await request.json();
    const { rfid_uid, idempotency_key } = body;

    if (!rfid_uid || typeof rfid_uid !== 'string') {
      return NextResponse.json({ error: 'rfid_uid is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Look up the RFID card
    const { data: card, error: cardErr } = await admin
      .from('rfid_cards')
      .select(`
        id, member_id, organization_id, institution_id, status,
        organization_members!inner (
          id, role, user_id, institution_id,
          profiles:user_id ( full_name, avatar_url )
        )
      `)
      .eq('rfid_uid', rfid_uid.toUpperCase().trim())
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

    // Verify the card belongs to the same organization as the device
    if (card.organization_id !== device.organizationId) {
      return NextResponse.json({
        success: false,
        attendance_marked: false,
        error: 'org_mismatch',
        message: 'Card does not belong to this organization',
      }, { status: 403 });
    }

    // Dedupe check: has this member already marked attendance on this device recently?
    const windowStart = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from('device_attendance_events')
      .select('id, marked_at')
      .eq('member_id', card.member_id)
      .eq('device_id', device.id)
      .eq('method', 'RFID')
      .gte('marked_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const member = card.organization_members as any;
      return NextResponse.json({
        success: true,
        attendance_marked: false,
        message: 'Attendance already marked',
        user: {
          id: member.id,
          name: member.profiles?.full_name ?? 'Unknown',
          role: member.role,
          institute: card.institution_id,
        },
        marked_at: existing.marked_at,
      });
    }

    // Insert the attendance event
    const now = new Date().toISOString();
    const { data: event, error: insertErr } = await admin
      .from('device_attendance_events')
      .insert({
        member_id: card.member_id,
        organization_id: card.organization_id,
        institution_id: card.institution_id,
        device_id: device.id,
        method: 'RFID',
        status: 'PRESENT',
        raw_uid: rfid_uid.toUpperCase().trim(),
        idempotency_key: idempotency_key || null,
        marked_at: now,
      })
      .select('id, marked_at')
      .single();

    if (insertErr) {
      // Idempotency key conflict means this is a replay — treat as success
      if (insertErr.code === '23505' && idempotency_key) {
        const member = card.organization_members as any;
        return NextResponse.json({
          success: true,
          attendance_marked: false,
          message: 'Attendance already recorded (replay)',
          user: {
            id: member.id,
            name: member.profiles?.full_name ?? 'Unknown',
            role: member.role,
            institute: card.institution_id,
          },
        });
      }
      console.error('Attendance insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
    }

    const member = card.organization_members as any;

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
      attendance_marked: true,
      message: 'Attendance marked successfully',
      user: {
        id: member.id,
        name: member.profiles?.full_name ?? 'Unknown',
        role: member.role,
        institute: instituteName,
        institution_id: card.institution_id,
      },
      event_id: event.id,
      marked_at: event.marked_at,
      method: 'RFID',
    }, { status: 201 });

  } catch (err: any) {
    console.error('RFID attendance error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
