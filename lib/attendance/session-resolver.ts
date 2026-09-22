/**
 * Session resolver — maps a member + timestamp to the right attendance session.
 *
 * Given "member X tapped their card at time T on device D", this module:
 *   1. Determines if the member is a trainee or staff.
 *   2. For trainees, finds their enrolled batch(es).
 *   3. Matches a timetable slot (class happening now ± grace periods).
 *   4. Reuses or creates the attendance session for that slot.
 *   5. Falls back to a KIOSK day-session when no timetable slot matches.
 *   6. Determines PRESENT vs LATE based on timing.
 *
 * The resolver never stores a record — that's record-device-tap.ts's job.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  IST_TZ,
  GRACE_BEFORE_MIN,
  GRACE_AFTER_MIN,
  LATE_AFTER_MIN,
  istDayKey,
  istDateTime,
} from './time';

// -------------------------------------------------------------------------- types

export type ResolutionKind =
  | 'LINKED'         // matched to a timetable slot or KIOSK session
  | 'STAFF'          // member is not a trainee — staff day entry
  | 'NO_ENROLMENT'   // trainee has no ENROLLED enrolment with a batch
  | 'NO_BATCH'       // trainee has enrollments but no batch set
  | 'DUPLICATE'      // already marked within dedupe window (handled upstream)
  | 'UNKNOWN_CARD';  // card not in rfid_cards (handled upstream)

export interface ResolvedTarget {
  /** Whether we successfully resolved to a record-able target. */
  resolved: true;
  /** attendance_sessions.id — NULL for staff day entries. */
  sessionId: string | null;
  /** The batch for this session, if any. */
  batchId: string | null;
  batchName: string | null;
  /** Course title from the timetable slot, if any. */
  courseTitle: string | null;
  /** Session type (LECTURE, LAB, KIOSK, etc.). */
  sessionType: string;
  /** PRESENT or LATE. */
  status: 'PRESENT' | 'LATE';
  /** The trainee_id if the member is a trainee (for the LMS chain). */
  traineeId: string | null;
  /** How this was resolved. */
  resolution: ResolutionKind;
  /** Human-readable note. */
  resolutionNote: string;
}

export interface UnresolvedTarget {
  resolved: false;
  resolution: ResolutionKind;
  resolutionNote: string;
}

export type ResolveResult = ResolvedTarget | UnresolvedTarget;

export interface ResolveInput {
  /** Service-role Supabase client. */
  admin: SupabaseClient;
  /** organization_members.id of the person tapping. */
  memberId: string;
  /** The org this member belongs to. */
  organizationId: string;
  /** Institution the device is in (for KIOSK session scoping). */
  deviceInstitutionId: string | null;
  /** Timestamp of the tap (defaults to now). */
  at?: Date;
}

export interface TimetableSlotLike {
  id: string;
  start_time: string;
  end_time: string;
  [key: string]: unknown;
}

/** Pure, deterministic slot selection shared by the resolver tests. */
export function selectBestMatchingSlot<T extends TimetableSlotLike>(slots: T[], day: string, at: Date): T | null {
  const scored = slots.flatMap(slot => {
    const start = istDateTime(day, slot.start_time);
    const end = istDateTime(day, slot.end_time);
    if (at.getTime() < start.getTime() - GRACE_BEFORE_MIN * 60_000) return [];
    if (at.getTime() > end.getTime() + GRACE_AFTER_MIN * 60_000) return [];
    return [{
      slot,
      distance: Math.abs(at.getTime() - (start.getTime() + end.getTime()) / 2),
      startMs: start.getTime(),
    }];
  });
  scored.sort((a, b) => a.distance - b.distance || a.startMs - b.startMs || a.slot.id.localeCompare(b.slot.id));
  return scored[0]?.slot ?? null;
}

export function statusForSlot(slot: TimetableSlotLike, day: string, at: Date): 'PRESENT' | 'LATE' {
  const lateAt = istDateTime(day, slot.start_time).getTime() + LATE_AFTER_MIN * 60_000;
  return at.getTime() > lateAt ? 'LATE' : 'PRESENT';
}

// -------------------------------------------------------------------------- main

export async function resolveAttendanceTarget(input: ResolveInput): Promise<ResolveResult> {
  const { admin, memberId, organizationId, at = new Date() } = input;
  const todayIST = istDayKey(at);

  // Step 1: Is the member a trainee?
  const { data: member, error: memberError } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (memberError || !member?.user_id) {
    return {
      resolved: false,
      resolution: 'NO_ENROLMENT',
      resolutionNote: 'Active organization member was not found',
    };
  }

  const { data: trainee } = await admin
    .from('trainees')
    .select('id, user_id')
    .eq('user_id', member.user_id)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!trainee) {
    // Staff member (trainer, admin, director) — no session, just a day entry
    return {
      resolved: true,
      sessionId: null,
      batchId: null,
      batchName: null,
      courseTitle: null,
      sessionType: 'KIOSK',
      status: 'PRESENT',
      traineeId: null,
      resolution: 'STAFF',
      resolutionNote: 'Staff day check-in (not a trainee)',
    };
  }

  // Step 2: Find enrolled batches
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('batch_id, batches(id, name, programme_id, programmes(institution_id))')
    .eq('trainee_id', trainee.id)
    .eq('status', 'ENROLLED');

  if (!enrollments?.length) {
    return {
      resolved: false,
      resolution: 'NO_ENROLMENT',
      resolutionNote: 'Trainee has no active enrolment',
    };
  }

  const candidateBatches = (enrollments || [])
    .filter((e: any) => {
      if (!e.batch_id || !e.batches) return false;
      const batchInstitution = e.batches.programmes?.institution_id ?? null;
      return !input.deviceInstitutionId || batchInstitution === input.deviceInstitutionId;
    })
    .map((e: any) => ({
      batchId: e.batch_id as string,
      batchName: (e.batches as any).name as string,
      programmeId: (e.batches as any).programme_id as string,
    }))
    .sort((a, b) => a.batchId.localeCompare(b.batchId));

  if (candidateBatches.length === 0) {
    return {
      resolved: false,
      resolution: 'NO_BATCH',
      resolutionNote: 'Trainee has active enrolment but no batch',
    };
  }

  // Step 3: Find timetable slots for today on candidate batches
  const batchIds = candidateBatches.map((b) => b.batchId);
  const { data: slots } = await admin
    .from('timetable_slots')
    .select('id, batch_id, course_id, start_time, end_time, session_type, attendance_session_id, courses(title)')
    .in('batch_id', batchIds)
    .eq('date', todayIST)
    .neq('status', 'CANCELLED')
    .order('start_time', { ascending: true });

  const selectedSlot = selectBestMatchingSlot((slots || []) as TimetableSlotLike[], todayIST, at) as any;

  if (selectedSlot) {
    // Step 3a: Pick the best slot — nearest midpoint, tiebreak by start_time then id
    const bestSlot = selectedSlot;
    const batch = candidateBatches.find((b) => b.batchId === bestSlot.batch_id)!;
    const courseTitle = (bestSlot.courses as any)?.title ?? null;

    // Step 4: Reuse or create the attendance session
    let sessionId = bestSlot.attendance_session_id as string | null;

    if (!sessionId) {
      // Create the session and write the ID back to the slot
      const { data: newSession, error: sessErr } = await admin
        .from('attendance_sessions')
        .insert({
          batch_id: bestSlot.batch_id,
          date: todayIST,
          session_type: bestSlot.session_type || 'LECTURE',
          session_slot: 'MORNING', // default, the timetable has start/end times
          is_active: true,
        })
        .select('id')
        .single();

      if (sessErr || !newSession) {
        return {
          resolved: false,
          resolution: 'NO_BATCH',
          resolutionNote: `Failed to create session: ${sessErr?.message || 'unknown'}`,
        };
      }

      sessionId = newSession.id;

      // Write back to the slot
      await admin
        .from('timetable_slots')
        .update({ attendance_session_id: sessionId })
        .eq('id', bestSlot.id);
    }

    // Determine LATE
    const status = statusForSlot(bestSlot, todayIST, at);

    return {
      resolved: true,
      sessionId,
      batchId: batch.batchId,
      batchName: batch.batchName,
      courseTitle,
      sessionType: bestSlot.session_type || 'LECTURE',
      status,
      traineeId: trainee.id,
      resolution: 'LINKED',
      resolutionNote: `Matched timetable slot ${bestSlot.id}${status === 'LATE' ? ' (late)' : ''}`,
    };
  }

  // Step 5: No timetable slot — find or create KIOSK day session
  // Pick the "best" candidate batch (first by programme, deterministic)
  const bestBatch = candidateBatches[0];

  // Find existing KIOSK session for this batch + date
  const { data: existingKiosk } = await admin
    .from('attendance_sessions')
    .select('id')
    .eq('batch_id', bestBatch.batchId)
    .eq('date', todayIST)
    .eq('session_type', 'KIOSK')
    .maybeSingle();

  let kioskSessionId: string;

  if (existingKiosk) {
    kioskSessionId = existingKiosk.id;
  } else {
    const { data: newKiosk, error: kioskErr } = await admin
      .from('attendance_sessions')
      .insert({
        batch_id: bestBatch.batchId,
        date: todayIST,
        session_type: 'KIOSK',
        session_slot: 'FULL_DAY',
        is_active: true,
      })
      .select('id')
      .single();

    if (kioskErr || !newKiosk) {
      // Concurrent insert race — try to read again
      const { data: retry } = await admin
        .from('attendance_sessions')
        .select('id')
        .eq('batch_id', bestBatch.batchId)
        .eq('date', todayIST)
        .eq('session_type', 'KIOSK')
        .maybeSingle();

      if (!retry) {
        return {
          resolved: false,
          resolution: 'NO_BATCH',
          resolutionNote: `Failed to create KIOSK session: ${kioskErr?.message || 'unknown'}`,
        };
      }
      kioskSessionId = retry.id;
    } else {
      kioskSessionId = newKiosk.id;
    }
  }

  return {
    resolved: true,
    sessionId: kioskSessionId,
    batchId: bestBatch.batchId,
    batchName: bestBatch.batchName,
    courseTitle: null,
    sessionType: 'KIOSK',
    status: 'PRESENT', // KIOSK day sessions are always PRESENT (no slot to be late for)
    traineeId: trainee.id,
    resolution: 'LINKED',
    resolutionNote: 'KIOSK day session (no timetable slot matched)',
  };
}
