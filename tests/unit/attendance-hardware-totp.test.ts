import { describe, it, expect } from 'vitest';
import { TOTP } from 'totp-generator';
import { AttendanceService } from '@/services/attendance.service';

// `trainees` has no `batch_id` column — the real linkage is through
// `enrollments.batch_id`. verifyHardwareTotpAndMark() used to query the
// nonexistent column directly; this test proves it now resolves the trainee's
// active batch via their ENROLLED enrollment instead.
const SECRET = 'JBSWY3DPEHPK3PXP'; // valid base32, fixed so the test is deterministic

/**
 * Minimal chainable Supabase stub. `verifyHardwareTotpAndMark` touches each
 * table at most once per call, in a fixed order (profiles -> trainees ->
 * enrollments -> [attendance_sessions -> attendance_records] on the happy
 * path), so a per-table canned response is enough — no need to match on the
 * specific filters applied along the way.
 */
function mockSupabase(responses: Record<string, { data: any; error?: any }>) {
  return {
    from(table: string) {
      const result = responses[table] ?? { data: null, error: null };
      const chain: any = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        eq: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
  } as any;
}

describe('AttendanceService.verifyHardwareTotpAndMark — enrollments-based batch resolution', () => {
  it('marks attendance via the trainee\'s ENROLLED enrollment batch, not a nonexistent trainees.batch_id', async () => {
    const now = Date.now();
    const { otp } = await TOTP.generate(SECRET, { timestamp: now });

    const supabase = mockSupabase({
      profiles: { data: { totp_secret: SECRET } },
      trainees: { data: { id: 'trainee-1' } },
      enrollments: { data: { batch_id: 'batch-1' } },
      attendance_sessions: { data: { id: 'session-1' } },
      attendance_records: {
        data: { id: 'record-1', session_id: 'session-1', trainee_id: 'trainee-1', method: 'QR', status: 'PRESENT' },
      },
    });

    const svc = new AttendanceService(supabase);
    const result = await svc.verifyHardwareTotpAndMark('user-1', otp);

    expect(result).toMatchObject({ session_id: 'session-1', trainee_id: 'trainee-1', method: 'QR' });
  });

  it('throws a clear error when the trainee has no active (ENROLLED, batch-assigned) enrollment', async () => {
    const now = Date.now();
    const { otp } = await TOTP.generate(SECRET, { timestamp: now });

    const supabase = mockSupabase({
      profiles: { data: { totp_secret: SECRET } },
      trainees: { data: { id: 'trainee-1' } },
      enrollments: { data: null }, // no ENROLLED row with a batch_id
    });

    const svc = new AttendanceService(supabase);
    await expect(svc.verifyHardwareTotpAndMark('user-1', otp))
      .rejects.toThrow('You are not currently assigned to a batch.');
  });

  it('rejects an invalid TOTP token', async () => {
    const supabase = mockSupabase({
      profiles: { data: { totp_secret: SECRET } },
    });

    const svc = new AttendanceService(supabase);
    await expect(svc.verifyHardwareTotpAndMark('user-1', '000000'))
      .rejects.toThrow('Invalid or expired QR code');
  });
});
