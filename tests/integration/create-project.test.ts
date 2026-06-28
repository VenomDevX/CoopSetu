import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

let owner: SupabaseClient, dev: SupabaseClient;

beforeAll(async () => {
  owner = await asUser('owner@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
}, 30000);

describe('create_project RPC (regression: INSERT...RETURNING vs projects_select)', () => {
  it('authorized user can create a project and read it back', async () => {
    const code = 'ITP' + Math.floor(Math.random() * 1e6);
    const { data, error } = await owner
      .rpc('create_project', { p_org: ORG, p_payload: { name: 'Integration Test Project', code, priority: 'MEDIUM', status: 'PLANNING' } })
      .single<{ id: string; code: string; organization_id: string }>();
    expect(error).toBeNull();
    expect(data?.code).toBe(code);
    expect(data?.organization_id).toBe(ORG);

    // The created row is visible afterward (projects_select passes once committed).
    const { data: readBack } = await owner.from('projects').select('id, code').eq('code', code).maybeSingle();
    expect(readBack?.code).toBe(code);
  });

  it('user without project:create is rejected', async () => {
    const { error } = await dev
      .rpc('create_project', { p_org: ORG, p_payload: { name: 'Should Fail', code: 'DEVFAIL' + Math.floor(Math.random() * 1e6) } });
    expect(error).toBeTruthy(); // FORBIDDEN raised by the RPC
  });
});
