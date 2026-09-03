import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

// Seeded CoopSetu-persona accounts (supabase/seed.sql) — all members of ORG.
const INSTITUTE_ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const TRAINER_ID = '00000000-0000-0000-0000-000000000003';
const TRAINEE_ID = '00000000-0000-0000-0000-000000000004';
const EMPLOYER_ID = '00000000-0000-0000-0000-000000000005';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

let instituteAdmin: SupabaseClient, trainer: SupabaseClient, trainee: SupabaseClient, employer: SupabaseClient, outsider: SupabaseClient;
let admin: SupabaseClient;

// Fixtures created via the admin (service-role) client — RLS-bypassing setup,
// exactly like the seed script's own inserts. These are the parent rows the
// policy checks below need to exist first.
let programmeId: string, courseId: string, institutionId: string;
let ownTraineeRowId: string, otherTraineeRowId: string;
let employerRowId: string, jobId: string;

beforeAll(async () => {
  admin = createClient(URL, ADMIN_KEY);
  instituteAdmin = await asUser('admin@coopsetu.test');
  trainer = await asUser('trainer@coopsetu.test');
  trainee = await asUser('trainee@coopsetu.test');
  employer = await asUser('employer@coopsetu.test');

  const outsiderEmail = `training-rls-outsider-${Date.now()}@example.com`;
  const c = createClient(URL, KEY);
  await c.auth.signUp({ email: outsiderEmail, password: process.env.TEST_USER_PASSWORD ?? 'testpass123' });
  outsider = c;

  const { data: programme } = await admin.from('programmes').insert({
    organization_id: ORG, title: `RLS Test Programme ${Date.now()}`, duration_days: 30, status: 'ACTIVE',
  }).select('id').single();
  programmeId = programme!.id;

  const { data: course } = await admin.from('courses').insert({
    programme_id: programmeId, title: 'RLS Test Course', status: 'ACTIVE',
  }).select('id').single();
  courseId = course!.id;

  const { data: ownTrainee } = await admin.from('trainees')
    .upsert({ user_id: TRAINEE_ID, organization_id: ORG, status: 'ACTIVE' }, { onConflict: 'user_id,organization_id' })
    .select('id').single();
  ownTraineeRowId = ownTrainee!.id;

  const { data: otherAuthUser } = await admin.auth.admin.createUser({
    email: `training-rls-other-trainee-${Date.now()}@example.com`,
    password: process.env.TEST_USER_PASSWORD ?? 'testpass123',
    email_confirm: true,
  });
  const { data: otherTrainee } = await admin.from('trainees').insert({
    user_id: otherAuthUser!.user!.id, organization_id: ORG, status: 'ACTIVE',
  }).select('id').single();
  otherTraineeRowId = otherTrainee!.id;

  const { data: employerRow } = await admin.from('employers')
    .upsert({ user_id: EMPLOYER_ID, organization_id: ORG, company_name: 'RLS Test Co', status: 'ACTIVE' }, { onConflict: 'user_id,organization_id' })
    .select('id').single();
  employerRowId = employerRow!.id;

  const { data: job } = await admin.from('jobs').insert({
    employer_id: employerRowId, title: 'RLS Test Job', status: 'OPEN',
  }).select('id').single();
  jobId = job!.id;

  const { data: institution } = await admin.from('institutions').insert({
    organization_id: ORG, name: `RLS Test Institute ${Date.now()}`, code: `RLS-${Date.now()}`, type: 'TRAINING_INSTITUTE',
  }).select('id').single();
  institutionId = institution!.id;
}, 60000);

describe('Training-domain RLS: previously SELECT-only tables now accept staff writes', () => {
  it('INSTITUTE_ADMIN can register a trainer', async () => {
    const { data, error } = await instituteAdmin.from('trainers').insert({
      user_id: TRAINER_ID, organization_id: ORG, status: 'ACTIVE',
    }).select('id').maybeSingle();
    // Row may already exist from a prior run (unique on user_id,organization_id) —
    // the assertion that matters is that RLS did not reject the write.
    expect(error === null || error.code === '23505').toBe(true);
    void data;
  });

  it('INSTITUTE_ADMIN can create a batch', async () => {
    const { data, error } = await instituteAdmin.from('batches').insert({
      organization_id: ORG, programme_id: programmeId, name: 'RLS Test Batch', status: 'UPCOMING',
    }).select('id').single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it('TRAINER (granted batch:manage) can also create a batch', async () => {
    const { data, error } = await trainer.from('batches').insert({
      organization_id: ORG, programme_id: programmeId, name: 'RLS Test Batch (trainer)', status: 'UPCOMING',
    }).select('id').single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it('TRAINER cannot create an institution (institution:manage not granted to TRAINER)', async () => {
    const { data, error } = await trainer.from('institutions').insert({
      organization_id: ORG, name: 'Should Not Exist', code: `NOPE-${Date.now()}`, type: 'TRAINING_INSTITUTE',
    }).select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it('a trainee can self-register their own trainees row', async () => {
    // Already created in beforeAll via admin — re-assert the self-insert path
    // directly using upsert-style idempotency (unique on user_id,organization_id).
    const { error } = await trainee.from('trainees').upsert(
      { user_id: TRAINEE_ID, organization_id: ORG, status: 'ACTIVE' },
      { onConflict: 'user_id,organization_id' },
    );
    expect(error).toBeNull();
  });

  it('a trainee cannot self-register a row under someone else\'s user_id', async () => {
    const { data, error } = await trainee.from('trainees').insert({
      user_id: '00000000-0000-0000-0000-0000000000ff', organization_id: ORG, status: 'ACTIVE',
    }).select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });
});

describe('Training-domain RLS: previously zero-policy tables now readable and writable', () => {
  it('a trainee can self-enroll in a programme', async () => {
    const { data, error } = await trainee.from('enrollments').insert({
      trainee_id: ownTraineeRowId, programme_id: programmeId, status: 'PENDING',
    }).select('id').maybeSingle();
    expect(error === null || error.code === '23505').toBe(true);
    void data;
  });

  it('a trainee cannot enroll on behalf of another trainee', async () => {
    const { data, error } = await trainee.from('enrollments').insert({
      trainee_id: otherTraineeRowId, programme_id: programmeId, status: 'PENDING',
    }).select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it('TRAINER (assessment:manage) can create an assessment and a question on it', async () => {
    const { data: assessment, error: aErr } = await trainer.from('assessments').insert({
      course_id: courseId, title: 'RLS Test Quiz',
    }).select('id').single();
    expect(aErr).toBeNull();
    expect(assessment?.id).toBeTruthy();

    const { data: question, error: qErr } = await trainer.from('assessment_questions').insert({
      assessment_id: assessment!.id, question_text: 'What is 2+2?', question_type: 'MCQ',
    }).select('id').single();
    expect(qErr).toBeNull();
    expect(question?.id).toBeTruthy();
  });

  it('a trainee can submit their own assessment result but not one for another trainee', async () => {
    const { data: assessment } = await admin.from('assessments').insert({
      course_id: courseId, title: 'RLS Submit Test',
    }).select('id').single();

    const { error: ownErr } = await trainee.from('assessment_results').insert({
      assessment_id: assessment!.id, trainee_id: ownTraineeRowId, score: 80, max_score: 100,
    });
    expect(ownErr).toBeNull();

    const { data: othersRows, error: othersErr } = await trainee.from('assessment_results').insert({
      assessment_id: assessment!.id, trainee_id: otherTraineeRowId, score: 80, max_score: 100,
    }).select('id');
    expect(othersRows ?? []).toHaveLength(0);
    expect(othersErr).not.toBeNull();
  });

  it('a trainee can mark their own attendance but not another trainee\'s', async () => {
    const { data: batch } = await admin.from('batches').insert({
      organization_id: ORG, programme_id: programmeId, name: 'RLS Attendance Batch', status: 'ACTIVE',
    }).select('id').single();
    const { data: session } = await admin.from('attendance_sessions').insert({
      batch_id: batch!.id, session_type: 'LECTURE',
    }).select('id').single();

    const { error: ownErr } = await trainee.from('attendance_records').insert({
      session_id: session!.id, trainee_id: ownTraineeRowId, method: 'MANUAL', status: 'PRESENT',
    });
    expect(ownErr).toBeNull();

    const { data: othersRows, error: othersErr } = await trainee.from('attendance_records').insert({
      session_id: session!.id, trainee_id: otherTraineeRowId, method: 'MANUAL', status: 'PRESENT',
    }).select('id');
    expect(othersRows ?? []).toHaveLength(0);
    expect(othersErr).not.toBeNull();
  });

  it('a trainee can declare their own skill but not add one to another trainee', async () => {
    const { data: skill } = await admin.from('skills').insert({ name: `RLS Skill ${Date.now()}`, category: 'GENERAL' }).select('id').single();

    const { error: ownErr } = await trainee.from('trainee_skills').insert({
      trainee_id: ownTraineeRowId, skill_id: skill!.id, proficiency: 50, source: 'SELF_DECLARED',
    });
    expect(ownErr).toBeNull();

    const { data: othersRows, error: othersErr } = await trainee.from('trainee_skills').insert({
      trainee_id: otherTraineeRowId, skill_id: skill!.id, proficiency: 50, source: 'SELF_DECLARED',
    }).select('id');
    expect(othersRows ?? []).toHaveLength(0);
    expect(othersErr).not.toBeNull();
  });

  it('a trainee can apply to a job for themself but not on behalf of another trainee', async () => {
    const { error: ownErr } = await trainee.from('job_applications').insert({
      job_id: jobId, trainee_id: ownTraineeRowId, status: 'APPLIED',
    });
    expect(ownErr).toBeNull();

    const { data: othersRows, error: othersErr } = await trainee.from('job_applications').insert({
      job_id: jobId, trainee_id: otherTraineeRowId, status: 'APPLIED',
    }).select('id');
    expect(othersRows ?? []).toHaveLength(0);
    expect(othersErr).not.toBeNull();
  });

  it('the posting employer sees and can shortlist their own job\'s application', async () => {
    const { data: apps, error: selErr } = await employer.from('job_applications')
      .select('id, trainee_id, status')
      .eq('job_id', jobId)
      .eq('trainee_id', ownTraineeRowId);
    expect(selErr).toBeNull();
    expect(apps?.length).toBeGreaterThan(0);

    const { data: updated, error: updErr } = await employer.from('job_applications')
      .update({ status: 'SHORTLISTED' })
      .eq('job_id', jobId)
      .eq('trainee_id', ownTraineeRowId)
      .select('status')
      .single();
    expect(updErr).toBeNull();
    expect(updated?.status).toBe('SHORTLISTED');
  });
});

describe('Training-domain RLS: org isolation still holds after adding write policies', () => {
  it('an outsider (no org membership) sees zero trainees, institutions, or job applications', async () => {
    const { data: t } = await outsider.from('trainees').select('id');
    expect(t ?? []).toHaveLength(0);

    const { data: i } = await outsider.from('institutions').select('id');
    expect(i ?? []).toHaveLength(0);

    const { data: j } = await outsider.from('job_applications').select('id');
    expect(j ?? []).toHaveLength(0);
  });

  it('an outsider cannot insert into any training table even supplying real ORG ids', async () => {
    const { data, error } = await outsider.from('batches').insert({
      organization_id: ORG, programme_id: programmeId, name: 'Outsider Batch', status: 'UPCOMING',
    }).select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });
});
