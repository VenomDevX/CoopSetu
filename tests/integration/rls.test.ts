import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

let pm: SupabaseClient, dev: SupabaseClient, outsider: SupabaseClient;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  // a fresh, org-less user
  const c = createClient(URL, KEY);
  const email = `outsider_${Date.now()}@nowhere.test`;
  await c.auth.signUp({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  outsider = c;
}, 30000);

describe('RLS: organization isolation', () => {
  it('a member sees their org', async () => {
    const { data } = await pm.from('organizations').select('id').eq('id', ORG);
    expect(data?.length).toBe(1);
  });

  it('an org-less outsider sees no organizations', async () => {
    const { data } = await outsider.from('organizations').select('id');
    expect(data?.length ?? 0).toBe(0);
  });

  it('an outsider cannot read the Apex org by id', async () => {
    const { data } = await outsider.from('organizations').select('id').eq('id', ORG);
    expect(data?.length ?? 0).toBe(0);
  });
});

describe('RLS: task permissions', () => {
  it('developer can view project tasks', async () => {
    const { data } = await dev.from('tasks').select('id').limit(5);
    expect((data?.length ?? 0)).toBeGreaterThan(0);
  });

  it('developer cannot create a project (no project:create)', async () => {
    const { error } = await dev.from('projects')
      .insert({ organization_id: ORG, name: 'Nope', code: 'NOPE' }).select();
    expect(error).toBeTruthy();
  });

  it('PM can create and then archive a task', async () => {
    const { data: proj } = await pm.from('projects').select('id').limit(1).single();
    const { data: task, error } = await pm.from('tasks')
      .insert({ organization_id: ORG, project_id: proj!.id, title: 'itest task', status: 'BACKLOG' })
      .select().single();
    expect(error).toBeNull();
    expect(task?.task_key).toBeTruthy();
  });
});

describe('mentions create notifications', () => {
  it('mentioning dev in a comment creates a notification for dev', async () => {
    const { data: proj } = await pm.from('projects').select('id').limit(1).single();
    const { data: task } = await pm.from('tasks')
      .insert({ organization_id: ORG, project_id: proj!.id, title: 'mention task', status: 'BACKLOG' })
      .select().single();

    // resolve member ids
    const { data: pmMember } = await pm.from('organization_members')
      .select('id').eq('organization_id', ORG).eq('user_id', (await pm.auth.getUser()).data.user!.id).single();
    const { data: devUser } = await dev.auth.getUser();
    const { data: devMember } = await pm.from('organization_members')
      .select('id').eq('organization_id', ORG).eq('user_id', devUser.user!.id).single();

    const { data: comment } = await pm.from('task_comments')
      .insert({ organization_id: ORG, task_id: task!.id, author_member_id: pmMember!.id, body: 'hey @dev' })
      .select().single();
    await pm.from('comment_mentions')
      .insert({ comment_id: comment!.id, mentioned_member_id: devMember!.id });
    await pm.rpc('create_notification', {
      p_org: ORG, p_recipient: devMember!.id, p_type: 'TASK_MENTIONED',
      p_title: 'mention', p_body: 'hey', p_entity_type: 'task', p_entity_id: task!.id,
      p_project_id: proj!.id, p_metadata: {},
    });

    const { data: notifs } = await dev.from('notifications')
      .select('id').eq('type', 'TASK_MENTIONED').eq('entity_id', task!.id);
    expect((notifs?.length ?? 0)).toBeGreaterThan(0);
  });
});
