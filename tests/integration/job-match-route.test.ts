import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { SkillService } from '@/services/skill.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const EMPLOYER_USER_ID = '00000000-0000-0000-0000-000000000005'; // employer@coopsetu.test
const TRAINEE_USER_ID = '00000000-0000-0000-0000-000000000004'; // trainee@coopsetu.test

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function freshTraineeRow(admin: SupabaseClient): Promise<{ userId: string; traineeId: string }> {
  const email = `job-match-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = process.env.TEST_USER_PASSWORD ?? 'testpass123';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  await admin.from('organization_members').insert({ organization_id: ORG, user_id: data.user.id, is_active: true });
  const { data: role } = await admin.from('roles').select('id').eq('code', 'TRAINEE').is('organization_id', null).single();
  const { data: member } = await admin.from('organization_members').select('id').eq('organization_id', ORG).eq('user_id', data.user.id).single();
  await admin.from('member_roles').insert({ organization_member_id: member!.id, role_id: role!.id });
  const { data: trainee } = await admin.from('trainees').insert({ user_id: data.user.id, organization_id: ORG, status: 'ACTIVE' }).select('id').single();
  return { userId: data.user.id, traineeId: trainee!.id };
}

describe('SkillService job-matching against real RLS', () => {
  let admin: SupabaseClient;
  let jobId: string, skillId: string, traineeId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);

    let { data: employerRow } = await admin.from('employers').select('id').eq('user_id', EMPLOYER_USER_ID).eq('organization_id', ORG).maybeSingle();
    if (!employerRow) {
      const { data } = await admin.from('employers').insert({ user_id: EMPLOYER_USER_ID, organization_id: ORG, company_name: 'Job Match Test Co', status: 'ACTIVE' }).select('id').single();
      employerRow = data;
    }
    const { data: job } = await admin.from('jobs').insert({ employer_id: employerRow!.id, title: `Job Match Test Job ${Date.now()}`, status: 'OPEN' }).select('id').single();
    jobId = job!.id;

    const skillName = `Job Match Test Skill ${Date.now()}`;
    const { data: skill } = await admin.from('skills').insert({ name: skillName, category: 'Technical' }).select('id').single();
    skillId = skill!.id;
    await admin.from('job_skills').insert({ job_id: jobId, skill_id: skillId, importance: 'REQUIRED' });

    const { data: trainee } = await admin.from('trainees').select('id').eq('user_id', TRAINEE_USER_ID).eq('organization_id', ORG).single();
    traineeId = trainee!.id;
    await admin.from('trainee_skills').upsert({ trainee_id: traineeId, skill_id: skillId, proficiency: 100 }, { onConflict: 'trainee_id,skill_id' });
  }, 60000);

  it('calculateJobMatchScore/getSkillGapAnalysis resolve real skills through real RLS', async () => {
    const employer = await asUser('employer@coopsetu.test');
    const svc = new SkillService(employer);

    const score = await svc.calculateJobMatchScore(traineeId, jobId);
    expect(score).toBe(100);

    const gap = await svc.getSkillGapAnalysis(traineeId, jobId);
    expect(gap.matched.length).toBe(1);
    expect(gap.missing.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/jobs/[jobId]/match — the trainee-identity ownership check lives
// entirely in the route (calculateJobMatchScore/getSkillGapAnalysis are pure
// reads with no concept of "whose request this is"), so it's exercised here
// the same way as the assessments route-layer tests: mocked auth resolvers,
// each resolving to a REAL signed-in Supabase client, running the real route
// body against real RLS.
// ---------------------------------------------------------------------------
const mockGetCurrentMembership = vi.fn();
vi.mock('@/lib/auth/get-current-membership', () => ({
  getCurrentMembership: (...args: any[]) => mockGetCurrentMembership(...args),
}));
const mockGetAuthContext = vi.fn();
vi.mock('@/lib/auth/require-user', () => ({
  getAuthContext: (...args: any[]) => mockGetAuthContext(...args),
}));

describe('GET /api/v1/jobs/[jobId]/match: trainee-identity enforcement', () => {
  let admin: SupabaseClient;
  let jobId: string;
  let selfTraineeUserId: string, selfTraineeId: string;
  let otherTraineeId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);

    let { data: employerRow } = await admin.from('employers').select('id').eq('user_id', EMPLOYER_USER_ID).eq('organization_id', ORG).maybeSingle();
    if (!employerRow) {
      const { data } = await admin.from('employers').insert({ user_id: EMPLOYER_USER_ID, organization_id: ORG, company_name: 'Job Match Route Test Co', status: 'ACTIVE' }).select('id').single();
      employerRow = data;
    }
    const { data: job } = await admin.from('jobs').insert({ employer_id: employerRow!.id, title: `Job Match Route Test Job ${Date.now()}`, status: 'OPEN' }).select('id').single();
    jobId = job!.id;

    const { data: selfTrainee } = await admin.from('trainees').select('id, user_id').eq('user_id', TRAINEE_USER_ID).eq('organization_id', ORG).single();
    selfTraineeUserId = selfTrainee!.user_id;
    selfTraineeId = selfTrainee!.id;

    const other = await freshTraineeRow(admin);
    otherTraineeId = other.traineeId;
  }, 60000);

  it('a trainee with no trainee_id query param gets their own match score', async () => {
    const { GET: GetJobMatch } = await import('@/app/api/v1/jobs/[jobId]/match/route');
    const traineeClient = await asUser('trainee@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm1', organizationId: ORG, roles: ['TRAINEE'], permissions: [] });
    mockGetAuthContext.mockResolvedValue({ user: { id: selfTraineeUserId }, supabase: traineeClient });

    const res = await GetJobMatch(new NextRequest(`http://localhost:3000/api/v1/jobs/${jobId}/match`), { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.data.matchScore).toBe('number');
  });

  it('a trainee asking about a DIFFERENT trainee_id is rejected — not repeating the /api/v1/skills?trainee_id= mistake', async () => {
    const { GET: GetJobMatch } = await import('@/app/api/v1/jobs/[jobId]/match/route');
    const traineeClient = await asUser('trainee@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm1', organizationId: ORG, roles: ['TRAINEE'], permissions: [] });
    mockGetAuthContext.mockResolvedValue({ user: { id: selfTraineeUserId }, supabase: traineeClient });

    const res = await GetJobMatch(new NextRequest(`http://localhost:3000/api/v1/jobs/${jobId}/match?trainee_id=${otherTraineeId}`), { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(403);
    expect(selfTraineeId).not.toBe(otherTraineeId); // sanity: this really was a different trainee
  });

  it('an EMPLOYER (no trainees row of their own) may request any in-org trainee_id', async () => {
    const { GET: GetJobMatch } = await import('@/app/api/v1/jobs/[jobId]/match/route');
    const employerClient = await asUser('employer@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm2', organizationId: ORG, roles: ['EMPLOYER'], permissions: [] });
    mockGetAuthContext.mockResolvedValue({ user: { id: EMPLOYER_USER_ID }, supabase: employerClient });

    const res = await GetJobMatch(new NextRequest(`http://localhost:3000/api/v1/jobs/${jobId}/match?trainee_id=${otherTraineeId}`), { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(200);
  });

  it('a caller with no trainee_id and no trainees row of their own must specify one', async () => {
    const { GET: GetJobMatch } = await import('@/app/api/v1/jobs/[jobId]/match/route');
    const employerClient = await asUser('employer@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm2', organizationId: ORG, roles: ['EMPLOYER'], permissions: [] });
    mockGetAuthContext.mockResolvedValue({ user: { id: EMPLOYER_USER_ID }, supabase: employerClient });

    const res = await GetJobMatch(new NextRequest(`http://localhost:3000/api/v1/jobs/${jobId}/match`), { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(400);
  });
});
