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
async function memberId(c: SupabaseClient, userId: string) {
  const { data } = await c.from('organization_members').select('id').eq('organization_id', ORG).eq('user_id', userId).single();
  return data!.id as string;
}
async function upiTask(c: SupabaseClient) {
  const { data } = await c.from('tasks').select('id, project:project_id(code)').limit(200);
  return (data as unknown as { id: string; project: { code: string } | null }[])
    .find((t) => t.project?.code === 'UPI')!.id;
}

let pm: SupabaseClient, tm: SupabaseClient, dev: SupabaseClient, owner: SupabaseClient;
const DEV_U = '00000000-0000-0000-0000-000000000003';
const SEC_U = '00000000-0000-0000-0000-000000000005';

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  tm = await asUser('tm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  owner = await asUser('owner@apexfintech.test');
}, 30000);

describe('ORG_OWNER', () => {
  it('has every permission', async () => {
    const ownerMem = await memberId(owner, '00000000-0000-0000-0000-000000000008');
    const { data } = await owner.rpc('member_permissions', { p_member: ownerMem });
    expect((data as unknown[]).length).toBeGreaterThanOrEqual(48);
  });
});

describe('TEAM_MANAGER team-scoped task assignment', () => {
  it('employee cannot assign anyone', async () => {
    const task = await upiTask(pm);
    const devM = await memberId(pm, DEV_U);
    const { error } = await dev.from('task_assignees').insert({ task_id: task, organization_member_id: devM }).select();
    expect(error).toBeTruthy();
  });

  it('team manager can assign a member of their team', async () => {
    const task = await upiTask(pm);
    const devM = await memberId(pm, DEV_U);
    const { error } = await tm.from('task_assignees')
      .upsert({ task_id: task, organization_member_id: devM }, { onConflict: 'task_id,organization_member_id' }).select();
    expect(error).toBeNull();
  });

  it('team manager cannot assign a non-team member', async () => {
    const task = await upiTask(pm);
    const secM = await memberId(pm, SEC_U);
    const { error } = await tm.from('task_assignees').insert({ task_id: task, organization_member_id: secM }).select();
    expect(error).toBeTruthy();
  });
});
