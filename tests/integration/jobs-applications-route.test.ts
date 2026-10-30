import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { JobService } from '@/services/employer.service';

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

async function freshTraineeRow(admin: SupabaseClient): Promise<{ userId: string; traineeId: string; client: SupabaseClient }> {
  const email = `jobs-applications-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
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

/**
 * Proves JobService.applyToJob/getApplications/updateApplicationStatus/
 * updateJob — all zero-caller before this phase — work against real RLS, and
 * that a caller cannot apply on another trainee's behalf (the same
 * trainee-identity decision applied server-side in
 * app/api/v1/jobs/[jobId]/apply/route.ts).
 */
describe('JobService applications flow against real RLS', () => {
  let admin: SupabaseClient, superAdmin: SupabaseClient, employer: SupabaseClient;
  let jobId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    superAdmin = await asUser('super@coopsetu.test');
    employer = await asUser('employer@coopsetu.test');

    let { data: employerRow } = await admin.from('employers').select('id').eq('user_id', EMPLOYER_USER_ID).eq('organization_id', ORG).maybeSingle();
    if (!employerRow) {
      const { data } = await admin.from('employers').insert({ user_id: EMPLOYER_USER_ID, organization_id: ORG, company_name: 'Applications Test Co', status: 'ACTIVE' }).select('id').single();
      employerRow = data;
    }

    const { data: job } = await admin.from('jobs').insert({ employer_id: employerRow!.id, title: `Applications Test Job ${Date.now()}`, status: 'OPEN' }).select('id').single();
    jobId = job!.id;
  }, 60000);

  it('a trainee can apply for themselves, and the posting employer can list and shortlist it', async () => {
    const { client, traineeId } = await freshTraineeRow(admin);
    const applySvc = new JobService(client);
    const application = await applySvc.applyToJob({ job_id: jobId, trainee_id: traineeId });
    expect(application.status).toBe('APPLIED');

    const employerSvc = new JobService(employer);
    const applications = await employerSvc.getApplications(jobId);
    expect(applications.some((a: any) => a.id === application.id)).toBe(true);

    const updated = await employerSvc.updateApplicationStatus(application.id, 'SHORTLISTED');
    expect(updated.status).toBe('SHORTLISTED');
  });

  it('a trainee cannot apply on behalf of another trainee (RLS rejects even a real trainee_id)', async () => {
    const { client } = await freshTraineeRow(admin);
    const { traineeId: otherTraineeId } = await freshTraineeRow(admin);

    const svc = new JobService(client);
    await expect(svc.applyToJob({ job_id: jobId, trainee_id: otherTraineeId })).rejects.toThrow();
  });

  it('a second trainee applying to the same job is independent of the first', async () => {
    const { client, traineeId } = await freshTraineeRow(admin);
    const svc = new JobService(client);
    const application = await svc.applyToJob({ job_id: jobId, trainee_id: traineeId });
    expect(application.trainee_id).toBe(traineeId);
  });

  it('SUPER_ADMIN can update a job (updateJob, previously zero-caller)', async () => {
    const svc = new JobService(superAdmin);
    const updated = await svc.updateJob(jobId, { title: 'Renamed via updateJob' });
    expect(updated.title).toBe('Renamed via updateJob');
  });
});
