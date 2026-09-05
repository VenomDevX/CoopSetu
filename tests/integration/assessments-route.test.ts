import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { AssessmentService } from '@/services/course.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const TRAINEE_USER_ID = '00000000-0000-0000-0000-000000000004'; // trainee@coopsetu.test

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function freshTraineeRow(admin: SupabaseClient): Promise<{ userId: string; traineeId: string; client: SupabaseClient }> {
  const email = `assessments-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = process.env.TEST_USER_PASSWORD ?? 'testpass123';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);

  await admin.from('organization_members').insert({ organization_id: ORG, user_id: data.user.id, is_active: true });
  const { data: role } = await admin.from('roles').select('id').eq('code', 'TRAINEE').is('organization_id', null).single();
  const { data: member } = await admin.from('organization_members').select('id').eq('organization_id', ORG).eq('user_id', data.user.id).single();
  await admin.from('member_roles').insert({ organization_member_id: member!.id, role_id: role!.id });

  const { data: trainee } = await admin.from('trainees').insert({ user_id: data.user.id, organization_id: ORG, status: 'ACTIVE' }).select('id').single();

  const client = createClient(URL, KEY);
  await client.auth.signInWithPassword({ email, password });
  return { userId: data.user.id, traineeId: trainee!.id, client };
}

describe('AssessmentService against real RLS', () => {
  let admin: SupabaseClient, trainer: SupabaseClient;
  let courseId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    trainer = await asUser('trainer@coopsetu.test');

    const { data: programme } = await admin.from('programmes').insert({
      organization_id: ORG, title: `Assessments Test Programme ${Date.now()}`, duration_days: 30, status: 'ACTIVE',
    }).select('id').single();
    const { data: course } = await admin.from('courses').insert({
      programme_id: programme!.id, title: 'Assessments Test Course', status: 'ACTIVE',
    }).select('id').single();
    courseId = course!.id;
  }, 60000);

  it('a TRAINER can create an assessment, add questions, and a trainee can submit their own attempt which the TRAINER can then read', async () => {
    const trainerSvc = new AssessmentService(trainer);
    const assessment = await trainerSvc.create({ course_id: courseId, title: 'Round Trip Quiz', max_score: 5, passing_score: 3, attempts_allowed: 2 });

    const q1 = await trainerSvc.addQuestion({ assessment_id: assessment.id, question_type: 'MCQ', question_text: '2 + 2 = ?', options: ['3', '4', '5'], correct_answer: '4', marks: 3 });
    await trainerSvc.addQuestion({ assessment_id: assessment.id, question_type: 'TRUE_FALSE', question_text: 'The sky is blue.', options: [], correct_answer: 'True', marks: 2 });

    const { client, traineeId } = await freshTraineeRow(admin);
    const traineeSvc = new AssessmentService(client);

    // Grade the way the route does: fetch the real questions, grade with the
    // service's pure grader, never trust a client-supplied score.
    const fullAssessment = await traineeSvc.getById(assessment.id);
    const score = traineeSvc.gradeAnswers(fullAssessment.assessment_questions ?? [], { [q1.id]: '4' }); // only the MCQ answered correctly
    expect(score).toBe(3);

    const result = await traineeSvc.submitResult({
      assessment_id: assessment.id, trainee_id: traineeId, score, max_score: assessment.max_score, answers: { [q1.id]: '4' }, attempt_number: 1,
    });
    expect(result.score).toBe(3);
    expect(result.passed).toBe(true); // 3 >= passing_score(3) per the service's own >= max_score*0.4 rule (5*0.4=2, 3>=2)

    const results = await trainerSvc.getResults(assessment.id);
    expect(results.some((r: any) => r.id === result.id)).toBe(true);
  });

  it('a trainee cannot submit a result on behalf of another trainee (RLS rejects even a real trainee_id)', async () => {
    const assessment = await new AssessmentService(trainer).create({ course_id: courseId, title: 'Impersonation Test Quiz' });
    const { client } = await freshTraineeRow(admin);
    const { traineeId: otherTraineeId } = await freshTraineeRow(admin);

    const svc = new AssessmentService(client);
    await expect(svc.submitResult({ assessment_id: assessment.id, trainee_id: otherTraineeId, score: 100, max_score: 100 })).rejects.toThrow();
  });

  it('a bare trainee cannot create assessments or add questions (assessment:manage is required)', async () => {
    const trainee = await asUser('trainee@coopsetu.test');
    const svc = new AssessmentService(trainee);
    await expect(svc.create({ course_id: courseId, title: 'Should Be Rejected' })).rejects.toThrow();

    const assessment = await new AssessmentService(trainer).create({ course_id: courseId, title: 'Question Guard Quiz' });
    await expect(svc.addQuestion({ assessment_id: assessment.id, question_text: 'Should be rejected', question_type: 'MCQ' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Route-level business logic that lives only in the route handlers, not the
// service: attempts_allowed enforcement and stripping correct_answer from
// non-staff responses. getCurrentMembership/getAuthContext/createClient are
// mocked (the usual way to unit-test a Next.js route outside a request
// context — see tests/unit/*-auth-guard.test.ts), but every mock resolves to
// a REAL signed-in Supabase client, so the route body runs against real RLS
// and real data, not stubbed responses.
// ---------------------------------------------------------------------------
const mockGetCurrentMembership = vi.fn();
vi.mock('@/lib/auth/get-current-membership', () => ({
  getCurrentMembership: (...args: any[]) => mockGetCurrentMembership(...args),
}));
const mockGetAuthContext = vi.fn();
vi.mock('@/lib/auth/require-user', () => ({
  getAuthContext: (...args: any[]) => mockGetAuthContext(...args),
}));
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('Assessment routes: business logic that only lives at the route layer', () => {
  let admin: SupabaseClient, trainer: SupabaseClient;
  let courseId: string;
  let traineeUser: { id: string };

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    trainer = await asUser('trainer@coopsetu.test');

    const { data: programme } = await admin.from('programmes').insert({
      organization_id: ORG, title: `Assessments Route Test Programme ${Date.now()}`, duration_days: 30, status: 'ACTIVE',
    }).select('id').single();
    const { data: course } = await admin.from('courses').insert({
      programme_id: programme!.id, title: 'Assessments Route Test Course', status: 'ACTIVE',
    }).select('id').single();
    courseId = course!.id;

    const { data } = await admin.from('trainees').select('user_id').eq('user_id', TRAINEE_USER_ID).eq('organization_id', ORG).single();
    traineeUser = { id: data!.user_id };
  }, 60000);

  it('POST /results rejects a submission once attempts_allowed is exhausted', async () => {
    const { POST: SubmitResult } = await import('@/app/api/v1/assessments/[assessmentId]/results/route');

    const assessment = await new AssessmentService(trainer).create({ course_id: courseId, title: 'One Attempt Quiz', attempts_allowed: 1 });
    const traineeClient = await asUser('trainee@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm1', organizationId: ORG, roles: ['TRAINEE'], permissions: [] });
    mockGetAuthContext.mockResolvedValue({ user: { id: traineeUser.id }, supabase: traineeClient });

    const req = () => new NextRequest(`http://localhost:3000/api/v1/assessments/${assessment.id}/results`, {
      method: 'POST', body: JSON.stringify({ answers: {} }), headers: { 'Content-Type': 'application/json' },
    });

    const first = await SubmitResult(req(), { params: Promise.resolve({ assessmentId: assessment.id }) });
    expect(first.status).toBe(201);

    const second = await SubmitResult(req(), { params: Promise.resolve({ assessmentId: assessment.id }) });
    expect(second.status).toBe(403);
    const body = await second.json();
    expect(body.error).toMatch(/no attempts remaining/i);
  });

  it('GET /api/v1/assessments/[assessmentId] strips correct_answer for a caller without assessment:manage, but not for one with it', async () => {
    const { GET: GetAssessment } = await import('@/app/api/v1/assessments/[assessmentId]/route');

    const assessment = await new AssessmentService(trainer).create({ course_id: courseId, title: 'Answer Key Secrecy Quiz' });
    await new AssessmentService(trainer).addQuestion({ assessment_id: assessment.id, question_type: 'MCQ', question_text: 'Pick one', options: ['A', 'B'], correct_answer: 'A', marks: 1 });

    const traineeClient = await asUser('trainee@coopsetu.test');
    const req = new NextRequest(`http://localhost:3000/api/v1/assessments/${assessment.id}`);

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm1', organizationId: ORG, roles: ['TRAINEE'], permissions: [] });
    mockCreateClient.mockResolvedValue(traineeClient);
    const asTrainee = await GetAssessment(req, { params: Promise.resolve({ assessmentId: assessment.id }) });
    const traineeBody = await asTrainee.json();
    expect(traineeBody.data.assessment_questions[0].correct_answer).toBeUndefined();

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm2', organizationId: ORG, roles: ['TRAINER'], permissions: ['assessment:manage'] });
    mockCreateClient.mockResolvedValue(trainer);
    const asTrainer = await GetAssessment(req, { params: Promise.resolve({ assessmentId: assessment.id }) });
    const trainerBody = await asTrainer.json();
    expect(trainerBody.data.assessment_questions[0].correct_answer).toBe('A');
  });
});
