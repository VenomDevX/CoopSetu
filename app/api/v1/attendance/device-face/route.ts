import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Device face attendance — device-auth only.
 *
 * Called by the terminal's SCR_FACE screen after the CAM reports
 * FACE:<slot>:<confidence>. Resolves the slot→member via face_slots,
 * then inserts a device_attendance_event.
 *
 * This is separate from /api/v1/attendance/face which handles the web-based
 * embedding verification flow (session-scoped). This route handles the kiosk's
 * on-device ESP-DL recognition result (slot-based, not embedding-based).
 */

const DEDUPE_WINDOW_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    if (!device) {
      return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
    }

    const body = await request.json();
    const { slot, confidence, idempotency_key } = body;

    if (typeof slot !== 'number' || slot < 0) {
      return NextResponse.json({ error: 'slot (non-negative integer) is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve the face slot to a member
    const { data: faceSlot, error: slotErr } = await admin
      .from('face_slots')
      .select(`
        id, member_id, organization_id, institution_id,
        organization_members!inner (
          id, role, user_id,
          profiles:user_id ( full_name, avatar_url )
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

    // Dedupe check
    const windowStart = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from('device_attendance_events')
      .select('id, marked_at')
      .eq('member_id', faceSlot.member_id)
      .eq('device_id', device.id)
      .eq('method', 'FACE')
      .gte('marked_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const member = faceSlot.organization_members as any;
      return NextResponse.json({
        success: true,
        attendance_marked: false,
        message: 'Attendance already marked',
        user: {
          id: member.id,
          name: member.profiles?.full_name ?? 'Unknown',
          role: member.role,
          institute: faceSlot.institution_id,
        },
        marked_at: existing.marked_at,
      });
    }

    // Insert attendance event
    const now = new Date().toISOString();
    const { data: event, error: insertErr } = await admin
      .from('device_attendance_events')
      .insert({
        member_id: faceSlot.member_id,
        organization_id: faceSlot.organization_id,
        institution_id: faceSlot.institution_id,
        device_id: device.id,
        method: 'FACE',
        status: 'PRESENT',
        confidence: typeof confidence === 'number' ? confidence : null,
        idempotency_key: idempotency_key || null,
        marked_at: now,
      })
      .select('id, marked_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505' && idempotency_key) {
        const member = faceSlot.organization_members as any;
        return NextResponse.json({
          success: true,
          attendance_marked: false,
          message: 'Attendance already recorded (replay)',
          user: {
            id: member.id,
            name: member.profiles?.full_name ?? 'Unknown',
            role: member.role,
            institute: faceSlot.institution_id,
          },
        });
      }
      console.error('Face attendance insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
    }

    const member = faceSlot.organization_members as any;

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
      attendance_marked: true,
      message: 'Attendance marked successfully',
      user: {
        id: member.id,
        name: member.profiles?.full_name ?? 'Unknown',
        role: member.role,
        institute: instituteName,
        institution_id: faceSlot.institution_id,
      },
      event_id: event.id,
      marked_at: event.marked_at,
      method: 'FACE',
      confidence,
    }, { status: 201 });

  } catch (err: any) {
    console.error('Device face attendance error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
