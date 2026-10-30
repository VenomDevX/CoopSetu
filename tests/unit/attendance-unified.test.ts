import { describe, expect, it } from 'vitest';
import { istClock, istDayKey } from '@/lib/attendance/time';
import { resolveAttendanceTarget, selectBestMatchingSlot, statusForSlot } from '@/lib/attendance/session-resolver';
import { recordDeviceTap } from '@/lib/attendance/record-device-tap';

const day = '2026-09-19';
const slot = (id: string, start = '09:00:00', end = '10:00:00') => ({ id, start_time: start, end_time: end });

function adminWith(responses: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const chain: any = {};
      for (const method of ['select', 'eq', 'in', 'not', 'neq', 'order', 'gte', 'lte', 'lt', 'gt', 'limit', 'insert', 'update']) chain[method] = () => chain;
      const next = () => Promise.resolve(responses[table]?.shift() ?? { data: null, error: null });
      chain.single = next;
      chain.maybeSingle = next;
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => next().then(resolve, reject);
      return chain;
    },
  } as any;
}

describe('unified attendance resolution', () => {
  it('uses IST for midnight rollover and per-second clock output', () => {
    expect(istDayKey('2026-09-19T18:30:00.000Z')).toBe('2026-09-20');
    expect(istClock('2026-09-19T18:30:07.000Z')).toBe('00:00:07');
  });

  it('includes both grace boundaries and excludes one millisecond beyond', () => {
    const candidate = slot('a');
    expect(selectBestMatchingSlot([candidate], day, new Date(`${day}T08:40:00+05:30`))?.id).toBe('a');
    expect(selectBestMatchingSlot([candidate], day, new Date(`${day}T10:15:00+05:30`))?.id).toBe('a');
    expect(selectBestMatchingSlot([candidate], day, new Date(`${day}T10:15:00.001+05:30`))).toBeNull();
  });

  it('uses midpoint, start, then id for overlapping slots', () => {
    expect(selectBestMatchingSlot([
      slot('later', '09:30:00', '10:30:00'),
      slot('earlier', '09:00:00', '10:00:00'),
    ], day, new Date(`${day}T09:45:00+05:30`))?.id).toBe('earlier');
    expect(selectBestMatchingSlot([slot('b'), slot('a')], day, new Date(`${day}T09:30:00+05:30`))?.id).toBe('a');
  });

  it('marks late only after the ten-minute threshold', () => {
    expect(statusForSlot(slot('a'), day, new Date(`${day}T09:10:00+05:30`))).toBe('PRESENT');
    expect(statusForSlot(slot('a'), day, new Date(`${day}T09:10:00.001+05:30`))).toBe('LATE');
  });

  it('resolves a non-trainee as staff attendance', async () => {
    const admin = adminWith({
      organization_members: [{ data: { user_id: 'user-1' }, error: null }],
      trainees: [{ data: null, error: null }],
    });
    const result = await resolveAttendanceTarget({ admin, memberId: 'member-1', organizationId: 'org-1', deviceInstitutionId: null });
    expect(result).toMatchObject({ resolved: true, sessionId: null, resolution: 'STAFF', traineeId: null });
  });

  it('distinguishes no enrolment from no batch', async () => {
    const common = () => ({
      organization_members: [{ data: { user_id: 'user-1' }, error: null }],
      trainees: [{ data: { id: 'trainee-1', user_id: 'user-1' }, error: null }],
    });
    const none = await resolveAttendanceTarget({
      admin: adminWith({ ...common(), enrollments: [{ data: [], error: null }] }),
      memberId: 'member-1', organizationId: 'org-1', deviceInstitutionId: null,
    });
    const noBatch = await resolveAttendanceTarget({
      admin: adminWith({ ...common(), enrollments: [{ data: [{ batch_id: null, batches: null }], error: null }] }),
      memberId: 'member-1', organizationId: 'org-1', deviceInstitutionId: null,
    });
    expect(none).toMatchObject({ resolved: false, resolution: 'NO_ENROLMENT' });
    expect(noBatch).toMatchObject({ resolved: false, resolution: 'NO_BATCH' });
  });

  it('falls back to an existing KIOSK session', async () => {
    const admin = adminWith({
      organization_members: [{ data: { user_id: 'user-1' }, error: null }],
      trainees: [{ data: { id: 'trainee-1', user_id: 'user-1' }, error: null }],
      enrollments: [{ data: [{ batch_id: 'batch-1', batches: { id: 'batch-1', name: 'Batch A', programme_id: 'program-1', programmes: { institution_id: 'inst-1' } } }], error: null }],
      timetable_slots: [{ data: [], error: null }],
      attendance_sessions: [{ data: { id: 'kiosk-1' }, error: null }],
    });
    const result = await resolveAttendanceTarget({ admin, memberId: 'member-1', organizationId: 'org-1', deviceInstitutionId: 'inst-1' });
    expect(result).toMatchObject({ resolved: true, sessionId: 'kiosk-1', sessionType: 'KIOSK', resolution: 'LINKED' });
  });
});

describe('device tap orchestration', () => {
  function deviceAdmin(responses: Record<string, unknown[]>) {
    const writes: { table: string; kind: string; value: unknown }[] = [];
    const admin = {
      from(table: string) {
        const chain: any = {};
        for (const method of ['select', 'eq', 'in', 'not', 'neq', 'order', 'gte', 'lte', 'lt', 'gt', 'limit']) chain[method] = () => chain;
        chain.insert = (value: unknown) => { writes.push({ table, kind: 'insert', value }); return chain; };
        chain.update = (value: unknown) => { writes.push({ table, kind: 'update', value }); return chain; };
        const next = () => Promise.resolve(responses[table]?.shift() ?? { data: null, error: null });
        chain.single = next;
        chain.maybeSingle = next;
        chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => next().then(resolve, reject);
        return chain;
      },
    } as any;
    return { admin, writes };
  }

  const baseTap = {
    memberId: 'member-1', organizationId: 'org-1', institutionId: 'inst-1',
    deviceId: 'device-1', deviceInstitutionId: 'inst-1', method: 'RFID' as const,
    at: new Date('2026-09-19T04:00:00.000Z'),
  };

  it('replays an idempotency key without creating another event', async () => {
    const { admin, writes } = deviceAdmin({
      device_attendance_events: [{ data: { id: 'event-1', marked_at: baseTap.at.toISOString(), resolution: 'LINKED', resolution_note: 'done' }, error: null }],
    });
    const result = await recordDeviceTap({ ...baseTap, admin, idempotencyKey: 'replay-1' });
    expect(result).toMatchObject({ attendanceMarked: false, eventId: 'event-1' });
    expect(writes).toHaveLength(0);
  });

  it('keeps a raw audit row for a tap inside the dedupe window', async () => {
    const { admin, writes } = deviceAdmin({
      device_attendance_events: [
        { data: { id: 'recent-1', marked_at: baseTap.at.toISOString() }, error: null },
        { data: { id: 'duplicate-1', marked_at: baseTap.at.toISOString() }, error: null },
      ],
    });
    const result = await recordDeviceTap({ ...baseTap, admin });
    expect(result).toMatchObject({ attendanceMarked: false, eventId: 'duplicate-1', resolution: 'DUPLICATE' });
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'device_attendance_events', kind: 'insert',
      value: expect.objectContaining({ resolution: 'DUPLICATE' }),
    }));
  });

  it('does not downgrade or replace an existing PRESENT session record', async () => {
    const { admin, writes } = deviceAdmin({
      device_attendance_events: [
        { data: null, error: null },
        { data: { id: 'event-2', marked_at: baseTap.at.toISOString() }, error: null },
        { data: null, error: null },
      ],
      organization_members: [{ data: { user_id: 'user-1' }, error: null }],
      trainees: [{ data: { id: 'trainee-1', user_id: 'user-1' }, error: null }],
      enrollments: [{ data: [{ batch_id: 'batch-1', batches: { id: 'batch-1', name: 'Batch A', programme_id: 'program-1', programmes: { institution_id: 'inst-1' } } }], error: null }],
      timetable_slots: [{ data: [{
        id: 'slot-1', batch_id: 'batch-1', start_time: '09:00:00', end_time: '10:00:00',
        session_type: 'LECTURE', attendance_session_id: 'session-1', courses: { title: 'Accounting' },
      }], error: null }],
      attendance_records: [{ data: { id: 'record-1', status: 'PRESENT' }, error: null }],
    });
    const result = await recordDeviceTap({ ...baseTap, admin, at: new Date('2026-09-19T04:45:00.000Z') });
    expect(result).toMatchObject({ attendanceMarked: false, recordId: 'record-1', status: 'PRESENT', resolution: 'DUPLICATE' });
    expect(writes.filter(write => write.table === 'attendance_records')).toHaveLength(0);
  });
});
