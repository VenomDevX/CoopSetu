import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AttendanceService } from '@/services/attendance.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const PASSWORD = process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

// Distinct, well-separated face descriptors (Euclidean distance between any
// two of these is far above the 0.6 match threshold).
const face = (seed: number) => Array.from({ length: 128 }, (_, i) => Math.sin(seed * 7 + i) * 0.5);
const nudge = (v: number[], d: number) => v.map((x, i) => (i === 0 ? x + d : x));

let admin: SupabaseClient;
let staff: AttendanceService;
let programmeId: string;

async function makeTrainee(label: string, embedding: number[] | null): Promise<string> {
  const { data: u } = await admin.auth.admin.createUser({
    email: `face-id-${label}-${Date.now()}@example.com`, password: PASSWORD, email_confirm: true,
  });
  await admin.from('organization_members').insert({ organization_id: ORG, user_id: u!.user!.id, is_active: true });
  const { data: t } = await admin.from('trainees').insert({
    user_id: u!.user!.id, organization_id: ORG, status: 'ACTIVE', face_embedding: embedding,
  }).select('id').single();
  return t!.id;
}

async function makeSession(traineeIds: string[]): Promise<string> {
  const { data: batch } = await admin.from('batches').insert({
    organization_id: ORG, programme_id: programmeId, name: `Face ID Batch ${Date.now()}`, status: 'ACTIVE',
  }).select('id').single();
  for (const id of traineeIds) {
    await admin.from('enrollments').insert({ trainee_id: id, programme_id: programmeId, batch_id: batch!.id, status: 'ENROLLED' });
  }
  const { data: session } = await admin.from('attendance_sessions').insert({
    batch_id: batch!.id, session_type: 'LECTURE', is_active: true,
  }).select('id').single();
  return session!.id;
}

beforeAll(async () => {
  admin = createClient(URL, ADMIN_KEY);
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email: 'admin@coopsetu.test', password: PASSWORD });
  if (error) throw new Error(`login: ${error.message}`);
  staff = new AttendanceService(c);

  const { data: programme } = await admin.from('programmes').insert({
    organization_id: ORG, title: `Face ID Programme ${Date.now()}`, duration_days: 30, status: 'ACTIVE',
  }).select('id').single();
  programmeId = programme!.id;
}, 60000);

describe('identifyFaceAndMarkAttendance (staff face check-in without a trainee id)', () => {
  it('marks the matching trainee, and only once', async () => {
    const alice = await makeTrainee('alice', face(1));
    const bob = await makeTrainee('bob', face(2));
    const sessionId = await makeSession([alice, bob]);

    const first = await staff.identifyFaceAndMarkAttendance(sessionId, nudge(face(1), 0.05));
    expect(first).toMatchObject({ verified: true, alreadyMarked: false, trainee: { id: alice } });

    const again = await staff.identifyFaceAndMarkAttendance(sessionId, face(1));
    expect(again).toMatchObject({ verified: true, alreadyMarked: true, trainee: { id: alice } });

    const { data: rows } = await admin.from('attendance_records').select('trainee_id, method').eq('session_id', sessionId);
    expect(rows).toEqual([{ trainee_id: alice, method: 'FACE' }]);
  });

  it('marks nobody when no enrolled face is close enough', async () => {
    const carol = await makeTrainee('carol', face(3));
    const sessionId = await makeSession([carol]);

    const res = await staff.identifyFaceAndMarkAttendance(sessionId, face(9));
    expect(res.verified).toBe(false);
    const { data: rows } = await admin.from('attendance_records').select('id').eq('session_id', sessionId);
    expect(rows).toHaveLength(0);
  });

  it('refuses to guess between two near-identical enrolled faces', async () => {
    const twinA = await makeTrainee('twin-a', face(4));
    const twinB = await makeTrainee('twin-b', nudge(face(4), 0.02));
    const sessionId = await makeSession([twinA, twinB]);

    const res = await staff.identifyFaceAndMarkAttendance(sessionId, nudge(face(4), 0.01));
    expect(res).toMatchObject({ verified: false, ambiguous: true });
    const { data: rows } = await admin.from('attendance_records').select('id').eq('session_id', sessionId);
    expect(rows).toHaveLength(0);
  });

  it('ignores trainees outside the session\'s batch', async () => {
    const insider = await makeTrainee('insider', face(5));
    const outsider = await makeTrainee('outsider', face(6));
    const sessionId = await makeSession([insider]);
    void outsider;

    const res = await staff.identifyFaceAndMarkAttendance(sessionId, face(6));
    expect(res.verified).toBe(false);
  });
});
