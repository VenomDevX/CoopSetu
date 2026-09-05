import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TraineeService } from '@/services/trainee.service';
import { TrainerService } from '@/services/trainer.service';
import { BatchService } from '@/services/batch.service';
import { AttendanceService } from '@/services/attendance.service';
import { CertificateService } from '@/services/certificate.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

const INSTITUTE_ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const TRAINER_ID = '00000000-0000-0000-0000-000000000003';
const TRAINEE_ID = '00000000-0000-0000-0000-000000000004';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/**
 * Proves the fix for the PostgREST embed crash: `trainees.user_id` and
 * `trainers.user_id` now FK to `profiles.id` (migration 0081), so the
 * `profiles:user_id(full_name, email)` embed used by 5 services resolves
 * instead of erroring with "Could not find a relationship between 'trainees'
 * and 'user_id' in the schema cache". Each service is exercised through its
 * real, unmodified query (no code changes were needed once the FK existed) —
 * this test would fail with a PGRST200 error against migrations 0001-0080
 * alone, and pass from 0081 onward.
 */
describe('Training-domain PostgREST embed fix (migration 0081)', () => {
  let instituteAdmin: SupabaseClient;
  let admin: SupabaseClient;
  let institutionId: string, programmeId: string, batchId: string, sessionId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    instituteAdmin = await asUser('admin@coopsetu.test');

    await admin.from('trainers').upsert(
      { user_id: TRAINER_ID, organization_id: ORG, status: 'ACTIVE' },
      { onConflict: 'user_id,organization_id' },
    );
    await admin.from('trainees').upsert(
      { user_id: TRAINEE_ID, organization_id: ORG, status: 'ACTIVE' },
      { onConflict: 'user_id,organization_id' },
    );

    const { data: institution } = await admin.from('institutions').insert({
      organization_id: ORG, name: `FK Test Institute ${Date.now()}`, code: `FK-${Date.now()}`, type: 'TRAINING_INSTITUTE',
    }).select('id').single();
    institutionId = institution!.id;

    const { data: programme } = await admin.from('programmes').insert({
      organization_id: ORG, institution_id: institutionId, title: 'FK Test Programme', duration_days: 30, status: 'ACTIVE',
    }).select('id').single();
    programmeId = programme!.id;

    const { data: trainer } = await admin.from('trainers').select('id').eq('user_id', TRAINER_ID).eq('organization_id', ORG).single();
    const { data: batch } = await admin.from('batches').insert({
      organization_id: ORG, programme_id: programmeId, name: 'FK Test Batch', trainer_id: trainer!.id, status: 'ACTIVE',
    }).select('id').single();
    batchId = batch!.id;

    const { data: session } = await admin.from('attendance_sessions').insert({
      batch_id: batchId, session_type: 'LECTURE',
    }).select('id').single();
    sessionId = session!.id;

    const { data: trainee } = await admin.from('trainees').select('id').eq('user_id', TRAINEE_ID).eq('organization_id', ORG).single();
    await admin.from('attendance_records').upsert(
      { session_id: sessionId, trainee_id: trainee!.id, method: 'MANUAL', status: 'PRESENT' },
      { onConflict: 'session_id,trainee_id' },
    );
    await admin.from('certificates').insert({
      trainee_id: trainee!.id, programme_id: programmeId, certificate_number: `FK-CERT-${Date.now()}`, title: 'FK Test Certificate',
    });
  }, 60000);

  afterAll(async () => {
    // Every prior run of this suite left its "FK Test..." fixtures in the
    // DB permanently (no teardown existed) — they piled up under the real
    // seeded trainer/trainee, e.g. surfacing as a trainer's dashboard
    // showing batches called "FK Test Batch" with no real enrollments.
    // Deleting `programmes` cascades away batches, attendance_sessions,
    // attendance_records, and certificates in one go (all FK'd to it with
    // ON DELETE CASCADE); institutions.programmes.institution_id is only
    // ON DELETE SET NULL, so the institution needs its own delete.
    // The trainer/trainee ACTIVE rows and the trainer/trainee upserts
    // above are NOT cleaned up here — those aren't per-run fixtures, they
    // represent the seeded users legitimately having a trainer/trainee
    // profile, and are idempotent (onConflict) across repeated runs.
    if (programmeId) await admin.from('programmes').delete().eq('id', programmeId);
    if (institutionId) await admin.from('institutions').delete().eq('id', institutionId);
  });

  it('TraineeService.list() resolves profiles.full_name without a PGRST200 error', async () => {
    const svc = new TraineeService(instituteAdmin, ORG);
    const trainees = await svc.list();
    expect(trainees.length).toBeGreaterThan(0);
    const withProfile = trainees.find((t: any) => t.user_id === TRAINEE_ID);
    expect(withProfile).toBeTruthy();
    expect((withProfile as any).profiles?.full_name).toBeTruthy();
  });

  it('TrainerService.getTrainers() resolves profiles.full_name (and the corrected avatar_path column)', async () => {
    const svc = new TrainerService(instituteAdmin);
    const trainers = await svc.getTrainers();
    expect(trainers?.length).toBeGreaterThan(0);
    const withProfile = trainers!.find((t: any) => t.user_id === TRAINER_ID);
    expect(withProfile).toBeTruthy();
    expect((withProfile as any).name).toBeTruthy();
    expect((withProfile as any).name).not.toBe('Unregistered Trainer');
  });

  it('BatchService.getBatches() resolves the nested trainers -> profiles embed', async () => {
    const svc = new BatchService(instituteAdmin);
    const batches = await svc.getBatches(programmeId);
    expect(batches?.length).toBeGreaterThan(0);
    expect(batches!.some((b: any) => b.id === batchId)).toBe(true);
  });

  it('AttendanceService.getSessionRecords() resolves the nested trainees -> profiles embed', async () => {
    const svc = new AttendanceService(instituteAdmin);
    const records = await svc.getSessionRecords(sessionId);
    expect(records?.length).toBeGreaterThan(0);
    const record = records!.find((r: any) => r.session_id === sessionId);
    expect((record as any)?.trainees?.profiles?.full_name).toBeTruthy();
  });

  it('CertificateService.listAll() resolves the nested trainees -> profiles embed', async () => {
    const svc = new CertificateService(instituteAdmin);
    const certificates = await svc.listAll(ORG);
    expect(certificates.length).toBeGreaterThan(0);
    const cert = certificates.find((c: any) => c.programme_id === programmeId);
    expect((cert as any)?.trainees?.profiles?.full_name).toBeTruthy();
  });
});
