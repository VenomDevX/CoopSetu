import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const INSTITUTE_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000002'; // admin@coopsetu.test
const TRAINEE_USER_ID = '00000000-0000-0000-0000-000000000004'; // trainee@coopsetu.test

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// Same "mocked-auth-resolvers-with-real-clients" technique as
// job-match-route.test.ts / assessments-route.test.ts: mock only the auth
// resolvers to return a real signed-in Supabase client, so the route
// handler's business logic runs against real RLS.
const mockGetCurrentMembership = vi.fn();
vi.mock('@/lib/auth/get-current-membership', () => ({
  getCurrentMembership: (...args: any[]) => mockGetCurrentMembership(...args),
}));
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/require-user', () => ({
  requireUser: (...args: any[]) => mockRequireUser(...args),
}));

describe('GET /api/v1/dashboard/overview: training personas get a real, persona-scoped data path', () => {
  beforeAll(async () => {
    // Ensure at least one active trainee/trainer/batch exists in this org so
    // the INSTITUTE_ADMIN assertion below is a genuine non-trivial check,
    // not just "didn't crash". Idempotent: safe to run against a DB that
    // already has seeded rows from supabase/seed.sql.
    const admin = createClient(URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })());
    const { count } = await admin.from('trainees').select('id', { count: 'exact', head: true }).eq('organization_id', ORG).eq('status', 'ACTIVE');
    expect(count ?? 0).toBeGreaterThan(0); // sanity: seed.sql already registers an active trainee in this org
  }, 30000);

  it('TRAINEE gets the training data path, not the apexfintech all-zero fallback', async () => {
    const { GET } = await import('@/app/api/v1/dashboard/overview/route');
    const traineeClient = await asUser('trainee@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm-trainee', organizationId: ORG, roles: ['TRAINEE'], permissions: [] });
    mockRequireUser.mockResolvedValue({ user: { id: TRAINEE_USER_ID }, supabase: traineeClient });

    const res = await GET(new NextRequest('http://localhost:3000/api/v1/dashboard/overview'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.persona).toBe('TRAINEE');
    // getTrainingOverview()'s metrics shape has no apexfintech fields at
    // all (unlike getRoleAwareOverview()'s, which zero-initializes both
    // sets) — their absence here is itself confirmation this response came
    // from the training data path, not the old all-zero fallthrough.
    expect(body.data.metrics.activeProjects).toBeUndefined();
    expect(typeof body.data.metrics.myCertificates).toBe('number');
    expect(typeof body.data.metrics.assessmentsTaken).toBe('number');
    expect(typeof body.data.metrics.coursesInProgress).toBe('number');
  });

  it('INSTITUTE_ADMIN sees real org-wide training counts, not zeros', async () => {
    const { GET } = await import('@/app/api/v1/dashboard/overview/route');
    const adminClient = await asUser('admin@coopsetu.test');

    mockGetCurrentMembership.mockResolvedValue({ memberId: 'm-admin', organizationId: ORG, roles: ['INSTITUTE_ADMIN'], permissions: [] });
    mockRequireUser.mockResolvedValue({ user: { id: INSTITUTE_ADMIN_USER_ID }, supabase: adminClient });

    const res = await GET(new NextRequest('http://localhost:3000/api/v1/dashboard/overview?cachebust=' + Date.now()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.persona).toBe('INSTITUTE_ADMIN');
    // Real seeded data: this org already has an active trainee (asserted in
    // beforeAll) — genuinely non-zero, not a hollow shape check.
    expect(body.data.metrics.activeTrainees).toBeGreaterThan(0);
  });
});
