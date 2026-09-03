import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EmployerService } from '@/services/employer.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/**
 * A fresh, unique auth user for each employer row this file creates —
 * `employers` has UNIQUE(user_id, organization_id), so reusing the seeded
 * employer@coopsetu.test id across multiple inserts (or across test runs)
 * would collide.
 */
async function freshEmployerUserId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `employers-route-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    password: process.env.TEST_USER_PASSWORD ?? 'testpass123',
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  return data.user.id;
}

/**
 * Exercises EmployerService (the class the new /api/v1/employers routes call)
 * through real RLS, proving both the previously-dead listEmployers/
 * createEmployer/updateEmployer methods now have a working data path, and
 * that the write-scoping decisions from 0080/0082 hold at the service layer,
 * not just via raw SQL.
 */
describe('EmployerService against real RLS', () => {
  let superAdmin: SupabaseClient, instituteAdmin: SupabaseClient, admin: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    superAdmin = await asUser('super@coopsetu.test');
    instituteAdmin = await asUser('admin@coopsetu.test');
  }, 30000);

  it('SUPER_ADMIN can register an employer on behalf of a user, then list it', async () => {
    const userId = await freshEmployerUserId(admin);
    const svc = new EmployerService(superAdmin, ORG);
    const created = await svc.createEmployer({
      user_id: userId,
      company_name: `Integration Test Co ${Date.now()}`,
    });
    expect(created.id).toBeTruthy();

    const list = await svc.listEmployers({ search: created.company_name });
    expect(list.some(e => e.id === created.id)).toBe(true);
  });

  it('INSTITUTE_ADMIN cannot register an employer (admin-tier only)', async () => {
    const userId = await freshEmployerUserId(admin);
    const svc = new EmployerService(instituteAdmin, ORG);
    await expect(svc.createEmployer({
      user_id: userId,
      company_name: `Should Not Persist ${Date.now()}`,
    })).rejects.toThrow();
  });

  it('SUPER_ADMIN can update any employer in the org', async () => {
    const userId = await freshEmployerUserId(admin);
    const svc = new EmployerService(superAdmin, ORG);
    const created = await svc.createEmployer({
      user_id: userId,
      company_name: `Before Update ${Date.now()}`,
    });

    const updated = await svc.updateEmployer(created.id, { company_name: 'After Update' });
    expect(updated.company_name).toBe('After Update');
  });
});
