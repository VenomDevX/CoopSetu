/**
 * Record a device tap — the single orchestrator for all device attendance routes.
 *
 * Handles RFID, QR, and Face taps from hardware terminals uniformly:
 *   1. Idempotency-key replay check (re-submitted offline events are no-ops).
 *   2. Deduplicate within a configurable window (same member+device+method).
 *   3. Insert the raw device_attendance_events row (always — it's the audit trail).
 *   4. Resolve the attendance target via session-resolver.
 *   5. Upsert attendance_records (never downgrade an existing PRESENT).
 *   6. Stamp the resolution on the device_attendance_events row.
 *   7. Return a uniform result for the terminal to display.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAttendanceTarget, type ResolveResult } from './session-resolver';
import { DEDUPE_WINDOW_MIN, istClock, istDayKey } from './time';

// -------------------------------------------------------------------------- types

export interface DeviceTapInput {
  /** Service-role Supabase client. */
  admin: SupabaseClient;
  /** organization_members.id of the person tapping. */
  memberId: string;
  /** Organization the member belongs to. */
  organizationId: string;
  /** Institution the member belongs to. */
  institutionId: string | null;
  /** Device that recorded this tap. */
  deviceId: string;
  /** Institution the device is in. */
  deviceInstitutionId: string | null;
  /** Method used: RFID, QR, or FACE. */
  method: 'RFID' | 'QR' | 'FACE';
  /** Raw UID for audit trail (RFID hex, QR token, etc.). */
  rawUid?: string | null;
  /** Face recognition confidence (0–1). */
  confidence?: number | null;
  /** Client-generated idempotency key for offline replay safety. */
  idempotencyKey?: string | null;
  /** Timestamp of the tap (defaults to now). */
  at?: Date;
}

export interface TapResult {
  /** Whether new attendance was recorded. */
  attendanceMarked: boolean;
  /** Human-readable message for the terminal. */
  message: string;
  /** The device_attendance_events.id. */
  eventId: string;
  /** The attendance_records.id, if created. */
  recordId: string | null;
  /** Attendance status (PRESENT, LATE, null if duplicate). */
  status: string | null;
  /** When the attendance was marked. */
  markedAt: string;
  /** Session info for the terminal display. */
  session: {
    type: string;
    batchName: string | null;
    courseTitle: string | null;
  } | null;
  /** Resolution of the tap. */
  resolution: string;
  resolutionNote: string;
}

// -------------------------------------------------------------------------- main

export async function recordDeviceTap(input: DeviceTapInput): Promise<TapResult> {
  const {
    admin, memberId, organizationId, institutionId,
    deviceId, deviceInstitutionId, method,
    rawUid, confidence, idempotencyKey,
    at = new Date(),
  } = input;

  const markedAt = at.toISOString();

  // Step 1: Idempotency-key replay check
  if (idempotencyKey) {
    const { data: existingEvent } = await admin
      .from('device_attendance_events')
      .select('id, marked_at, resolution, resolution_note')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      return {
        attendanceMarked: false,
        message: 'Attendance already recorded (replay)',
        eventId: existingEvent.id,
        recordId: null,
        status: null,
        markedAt: existingEvent.marked_at,
        session: null,
        resolution: existingEvent.resolution || 'DUPLICATE',
        resolutionNote: existingEvent.resolution_note || 'Idempotency key replay',
      };
    }
  }

  // Step 2: Deduplicate within window
  const windowStart = new Date(at.getTime() - DEDUPE_WINDOW_MIN * 60_000).toISOString();
  const { data: recentEvent } = await admin
    .from('device_attendance_events')
    .select('id, marked_at')
    .eq('member_id', memberId)
    .eq('device_id', deviceId)
    .eq('method', method)
    .gte('marked_at', windowStart)
    .limit(1)
    .maybeSingle();

  if (recentEvent) {
    const duplicateNote = `Duplicate within ${DEDUPE_WINDOW_MIN}min window`;
    const { data: duplicateEvent, error: duplicateError } = await admin
      .from('device_attendance_events')
      .insert({
        member_id: memberId,
        organization_id: organizationId,
        institution_id: institutionId,
        device_id: deviceId,
        method,
        status: 'PRESENT',
        confidence: confidence ?? null,
        raw_uid: rawUid ?? null,
        idempotency_key: idempotencyKey ?? null,
        marked_at: markedAt,
        resolution: 'DUPLICATE',
        resolution_note: duplicateNote,
      })
      .select('id, marked_at')
      .single();

    if (duplicateError || !duplicateEvent) {
      throw new Error(`Failed to record duplicate device event: ${duplicateError?.message || 'unknown'}`);
    }

    return {
      attendanceMarked: false,
      message: 'Already marked',
      eventId: duplicateEvent.id,
      recordId: null,
      status: null,
      markedAt: duplicateEvent.marked_at,
      session: null,
      resolution: 'DUPLICATE',
      resolutionNote: duplicateNote,
    };
  }

  // Step 3: Insert the raw device_attendance_events row (always — audit trail)
  const { data: event, error: eventErr } = await admin
    .from('device_attendance_events')
    .insert({
      member_id: memberId,
      organization_id: organizationId,
      institution_id: institutionId,
      device_id: deviceId,
      method,
      status: 'PRESENT', // provisional — will be updated by resolver
      confidence: confidence ?? null,
      raw_uid: rawUid ?? null,
      idempotency_key: idempotencyKey ?? null,
      marked_at: markedAt,
    })
    .select('id, marked_at')
    .single();

  if (eventErr || !event) {
    // Idempotency key conflict — treat as replay
    if (eventErr?.code === '23505' && idempotencyKey) {
      const { data: existing } = await admin
        .from('device_attendance_events')
        .select('id, marked_at')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      return {
        attendanceMarked: false,
        message: 'Attendance already recorded (replay)',
        eventId: existing?.id || '',
        recordId: null,
        status: null,
        markedAt: existing?.marked_at || markedAt,
        session: null,
        resolution: 'DUPLICATE',
        resolutionNote: 'Idempotency key conflict',
      };
    }
    throw new Error(`Failed to insert device event: ${eventErr?.message || 'unknown'}`);
  }

  // Step 4: Resolve attendance target
  const resolved: ResolveResult = await resolveAttendanceTarget({
    admin,
    memberId,
    organizationId,
    deviceInstitutionId,
    at,
  });

  if (!resolved.resolved) {
    // Stamp resolution on the event
    await admin
      .from('device_attendance_events')
      .update({
        resolution: resolved.resolution,
        resolution_note: resolved.resolutionNote,
      })
      .eq('id', event.id);

    return {
      attendanceMarked: false,
      message: resolved.resolutionNote,
      eventId: event.id,
      recordId: null,
      status: null,
      markedAt: event.marked_at,
      session: null,
      resolution: resolved.resolution,
      resolutionNote: resolved.resolutionNote,
    };
  }

  // Step 5: Upsert attendance_records — never downgrade PRESENT to LATE
  let recordId: string | null = null;
  let finalStatus = resolved.status;

  if (resolved.sessionId && resolved.traineeId) {
    // Trainee with session — check for existing record
    const { data: existing } = await admin
      .from('attendance_records')
      .select('id, status')
      .eq('session_id', resolved.sessionId)
      .eq('trainee_id', resolved.traineeId)
      .maybeSingle();

    if (existing) {
      // A session attendance row is first-mark provenance. A later tap may
      // upgrade LATE to PRESENT, but it must not replace its method/device/event.
      finalStatus = existing.status === 'PRESENT' ? 'PRESENT' : resolved.status;
      recordId = existing.id;
      if (existing.status === 'LATE' && resolved.status === 'PRESENT') {
        await admin.from('attendance_records').update({ status: 'PRESENT' }).eq('id', existing.id);
      }
      await admin.from('device_attendance_events').update({
        status: finalStatus,
        resolution: 'DUPLICATE',
        resolution_note: 'Attendance already exists for this session',
      }).eq('id', event.id);
      return {
        attendanceMarked: false,
        message: 'Already marked',
        eventId: event.id,
        recordId,
        status: finalStatus,
        markedAt: event.marked_at,
        session: {
          type: resolved.sessionType,
          batchName: resolved.batchName,
          courseTitle: resolved.courseTitle,
        },
        resolution: 'DUPLICATE',
        resolutionNote: 'Attendance already exists for this session',
      };
    } else {
      // Insert new record
      const { data: newRecord, error: recErr } = await admin
        .from('attendance_records')
        .insert({
          session_id: resolved.sessionId,
          trainee_id: resolved.traineeId,
          member_id: memberId,
          method,
          status: resolved.status,
          marked_at: markedAt,
          device_id: deviceId,
          device_event_id: event.id,
          source: 'DEVICE',
        })
        .select('id')
        .single();

      if (recErr) {
        // Unique constraint violation — concurrent insert race, read the winner
        if (recErr.code === '23505') {
          const { data: winner } = await admin
            .from('attendance_records')
            .select('id, status')
            .eq('session_id', resolved.sessionId)
            .eq('trainee_id', resolved.traineeId)
            .maybeSingle();
          recordId = winner?.id ?? null;
          finalStatus = winner?.status ?? resolved.status;
        } else throw new Error(`Failed to insert attendance record: ${recErr.message}`);
      } else {
        recordId = newRecord?.id ?? null;
      }
    }
  } else if (resolved.resolution === 'STAFF') {
    // Staff day entry — no session, no trainee
    const { data: staffRecord, error: staffErr } = await admin
      .from('attendance_records')
      .insert({
        session_id: null,
        trainee_id: null,
        member_id: memberId,
        method,
        status: 'PRESENT',
        marked_at: markedAt,
        device_id: deviceId,
        device_event_id: event.id,
        source: 'DEVICE',
      })
      .select('id')
      .single();

    if (staffErr) {
      // Unique constraint on staff daily — already checked in today
      if (staffErr.code === '23505') {
        const day = istDayKey(at);
        const dayStart = new Date(`${day}T00:00:00+05:30`);
        const dayEnd = new Date(dayStart.getTime() + 86_400_000);
        const { data: winner } = await admin
          .from('attendance_records')
          .select('id')
          .eq('member_id', memberId)
          .is('session_id', null)
          .gte('marked_at', dayStart.toISOString())
          .lt('marked_at', dayEnd.toISOString())
          .maybeSingle();
        recordId = winner?.id ?? null;
      } else throw new Error(`Failed to insert staff attendance record: ${staffErr.message}`);
    } else {
      recordId = staffRecord?.id ?? null;
    }
    finalStatus = 'PRESENT';
  }

  if (!recordId) {
    await admin.from('device_attendance_events').update({
      resolution: 'NO_BATCH',
      resolution_note: 'Attendance target resolved but record creation failed',
    }).eq('id', event.id);
    throw new Error('Attendance target resolved but record creation failed');
  }

  // Step 6: Stamp resolution on the device_attendance_events row
  await admin
    .from('device_attendance_events')
    .update({
      status: finalStatus,
      resolution: resolved.resolution,
      resolution_note: resolved.resolutionNote,
    })
    .eq('id', event.id);

  // Step 7: Return uniform result
  const timeStr = istClock(at);

  return {
    attendanceMarked: true,
    message: `Marked ${finalStatus} at ${timeStr}`,
    eventId: event.id,
    recordId,
    status: finalStatus,
    markedAt: event.marked_at,
    session: {
      type: resolved.sessionType,
      batchName: resolved.batchName,
      courseTitle: resolved.courseTitle,
    },
    resolution: resolved.resolution,
    resolutionNote: resolved.resolutionNote,
  };
}
