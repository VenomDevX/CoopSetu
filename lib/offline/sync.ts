/**
 * Flushes the offline queues (lib/offline/db.ts) once the app is back
 * online. Two independent queue types, each synced against the real routes
 * they'd have hit had the request not been offline in the first place — no
 * separate "sync" backend, no invented endpoint:
 *
 *  - pendingSubmissions -> POST /api/v1/assessments/[id]/results (Phase 4's
 *    real grading route — the server still computes the score; queuing
 *    never trusts a client-computed score any more than the online path
 *    does).
 *  - pendingProgress -> POST /api/v1/courses/[id]/progress (wires
 *    CourseService.updateProgress, previously zero-caller).
 *
 * Known limitation (documented per this plan's Phase 8 scope, not silently
 * ignored): single-writer/last-write-wins. If the trainee's attempts_allowed
 * was exhausted online (e.g. from another device) before this queued
 * attempt syncs, the server's real attempts check still rejects it — the
 * queued item is dropped with its error surfaced, not silently retried
 * forever or forced through.
 */

import {
  listPendingSubmissions, removePendingSubmission,
  listPendingProgress, removePendingProgress,
  type PendingSubmission, type PendingProgress,
  listPendingAttendance,
  removePendingAttendance,
  type PendingAttendance,
} from '@/lib/offline/db';

export interface SyncResult {
  attendanceSynced: number;
  attendanceFailed: { item: PendingAttendance; error: string }[];
  submissionsSynced: number;
  submissionsFailed: { item: PendingSubmission; error: string }[];
  progressSynced: number;
  progressFailed: { item: PendingProgress; error: string }[];
}

async function syncSubmission(item: PendingSubmission): Promise<void> {
  const res = await fetch(`/api/v1/assessments/${item.assessmentId}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: item.answers }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Sync failed: HTTP ${res.status}`);
  }
}

async function syncProgress(item: PendingProgress): Promise<void> {
  const res = await fetch(`/api/v1/courses/${item.courseId}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module_id: item.moduleId, progress_pct: item.progressPct }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Sync failed: HTTP ${res.status}`);
  }
}

/**
 * Attempts every queued item once. A network error (still offline) leaves
 * an item queued for the next attempt; a real server rejection (4xx/5xx —
 * e.g. attempts exhausted) removes it from the queue and reports it as
 * failed rather than retrying forever.
 */
export async function flushOfflineQueues(): Promise<SyncResult> {
  const result: SyncResult = {
    submissionsSynced: 0, submissionsFailed: [],
    progressSynced: 0, progressFailed: [],
    attendanceSynced: 0, attendanceFailed: [],
  };

  for (const item of await listPendingSubmissions()) {
    try {
      await syncSubmission(item);
      await removePendingSubmission(item.id);
      result.submissionsSynced++;
    } catch (err: any) {
      if (err instanceof TypeError) continue; // still offline — leave queued, retry next time
      await removePendingSubmission(item.id);
      result.submissionsFailed.push({ item, error: err.message ?? 'Unknown error' });
    }
  }

  for (const item of await listPendingProgress()) {
    try {
      await syncProgress(item);
      await removePendingProgress(item.id);
      result.progressSynced++;
    } catch (err: any) {
      if (err instanceof TypeError) continue; // still offline — leave queued, retry next time
      await removePendingProgress(item.id);
      result.progressFailed.push({ item, error: err.message ?? 'Unknown error' });
    }
  }

  // Attendance replays through the same route a live check-in uses, so the
  // server re-validates the QR token and its expiry. A token that expired while
  // the device was offline is rejected here rather than silently accepted —
  // recording someone present for a session that had already closed would be
  // worse than losing the mark.
  for (const item of await listPendingAttendance()) {
    try {
      await syncAttendance(item);
      await removePendingAttendance(item.id);
      result.attendanceSynced++;
    } catch (err: any) {
      if (err instanceof TypeError) continue; // still offline — leave queued
      await removePendingAttendance(item.id);
      result.attendanceFailed.push({ item, error: err.message ?? 'Unknown error' });
    }
  }

  return result;
}

async function syncAttendance(item: PendingAttendance): Promise<void> {
  const res = await fetch('/api/v1/attendance/qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qr_token: item.qrToken, trainee_id: item.traineeId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Attendance sync failed (${res.status})`);
  }
}

let listenerRegistered = false;

/** Registers a one-time `online` listener that flushes both queues. Safe to call multiple times. */
export function registerOfflineSync(onSynced?: (result: SyncResult) => void): void {
  if (typeof window === 'undefined' || listenerRegistered) return;
  listenerRegistered = true;
  window.addEventListener('online', () => {
    flushOfflineQueues().then((result) => onSynced?.(result));
  });
}
