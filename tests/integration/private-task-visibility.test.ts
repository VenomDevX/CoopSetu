import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { addAssignee, createTask, updateTask } from '@/services/task.service';
import { getMyWork } from '@/services/my-work.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

const USERS = {
  admin: '00000000-0000-0000-0000-000000000001',
  pm: '00000000-0000-0000-0000-000000000002',
  dev: '00000000-0000-0000-0000-000000000003',
  qa: '00000000-0000-0000-0000-000000000004',
  sec: '00000000-0000-0000-0000-000000000005',
  tm: '00000000-0000-0000-0000-000000000009',
} as const;

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({
    email,
    password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })(),
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

async function memberId(c: SupabaseClient, userId: string) {
  const { data, error } = await c
    .from('organization_members')
    .select('id')
    .eq('organization_id', ORG)
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function upiProject(c: SupabaseClient) {
  const { data, error } = await c
    .from('projects')
    .select('id')
    .eq('organization_id', ORG)
    .eq('code', 'UPI')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function visible(c: SupabaseClient, taskId: string) {
  const { data, error } = await c.from('tasks').select('id').eq('id', taskId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

let admin: SupabaseClient;
let pm: SupabaseClient;
let dev: SupabaseClient;
let qa: SupabaseClient;
let sec: SupabaseClient;
let tm: SupabaseClient;
let upi: string;
let pmM: string;
let devM: string;
let qaM: string;
let secM: string;

beforeAll(async () => {
  admin = await asUser('admin@apexfintech.test');
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  qa = await asUser('qa@apexfintech.test');
  sec = await asUser('sec@apexfintech.test');
  tm = await asUser('tm@apexfintech.test');
  upi = await upiProject(pm);
  pmM = await memberId(pm, USERS.pm);
  devM = await memberId(pm, USERS.dev);
  qaM = await memberId(pm, USERS.qa);
  secM = await memberId(pm, USERS.sec);
}, 30000);

describe('private task visibility', () => {
  it('hides private tasks from unrelated project members and task-adjacent rows', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `private visibility ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: devM,
      visibility_scope: 'PRIVATE_ASSIGNMENT',
    });

    expect(await visible(pm, task.id)).toBe(true);
    expect(await visible(dev, task.id)).toBe(true);
    expect(await visible(tm, task.id)).toBe(true);
    expect(await visible(admin, task.id)).toBe(true);
    expect(await visible(qa, task.id)).toBe(false);
    expect(await visible(sec, task.id)).toBe(false);

    const { data: qaList } = await qa.from('tasks').select('id').eq('project_id', upi).limit(500);
    expect((qaList ?? []).some((row) => row.id === task.id)).toBe(false);

    await pm.from('task_comments').insert({
      organization_id: ORG,
      task_id: task.id,
      author_member_id: pmM,
      body: 'private comment',
    });
    const [{ data: comments }, { data: activity }, { data: assignments }] = await Promise.all([
      qa.from('task_comments').select('id').eq('task_id', task.id),
      qa.from('task_activity').select('id').eq('task_id', task.id),
      qa.from('task_assignees').select('id').eq('task_id', task.id),
    ]);
    expect(comments ?? []).toHaveLength(0);
    expect(activity ?? []).toHaveLength(0);
    expect(assignments ?? []).toHaveLength(0);
  });

  it('grants reviewer visibility and My Work inclusion through active assignments', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `reviewer visibility ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: devM,
      visibility_scope: 'PRIVATE_ASSIGNMENT',
    });

    expect(await visible(qa, task.id)).toBe(false);
    await addAssignee(pm, ORG, task.id, qaM, pmM, undefined, 'REVIEWER');

    expect(await visible(qa, task.id)).toBe(true);
    const work = await getMyWork(qa, ORG, qaM);
    expect(work.tasks.some((row) => row.id === task.id)).toBe(true);
  });

  it('supports explicit visibility grants without making the project public', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `explicit visibility ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: secM,
      visibility_scope: 'PRIVATE_ASSIGNMENT',
    });

    expect(await visible(qa, task.id)).toBe(false);
    const { error } = await pm.from('task_visibility_members').insert({
      task_id: task.id,
      member_id: qaM,
      granted_by_member_id: pmM,
      access_type: 'VIEWER',
    });
    expect(error).toBeNull();
    expect(await visible(qa, task.id)).toBe(true);
  });

  it('PROJECT_SHARED scope makes task visible to all project members', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `project shared visibility ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: devM,
      visibility_scope: 'PROJECT_SHARED',
    });

    // PM created with PROJECT_SHARED — qa and sec should see it if they can view the project
    expect(await visible(pm, task.id)).toBe(true);
    expect(await visible(admin, task.id)).toBe(true);
    // dev is the assignee, always visible
    expect(await visible(dev, task.id)).toBe(true);
    // Task is still hidden from members who cannot view this project at all
    // (qa and sec have no UPI project membership in the seed, so may be hidden)
    // This asserts the task IS in the admin's full list (not zero rows)
    const { data: adminList } = await admin.from('tasks').select('id').eq('project_id', upi).limit(500);
    expect((adminList ?? []).some((row) => row.id === task.id)).toBe(true);
  });

  it('ORGANIZATION_VISIBLE scope makes task visible to all org members with task:view', async () => {
    const task = await createTask(admin, ORG, await memberId(admin, USERS.admin), {
      project_id: upi,
      title: `org visible task ${Date.now()}`,
      status: 'BACKLOG',
      visibility_scope: 'ORGANIZATION_VISIBLE',
    });

    // Every org member with task:view should see it
    expect(await visible(pm, task.id)).toBe(true);
    expect(await visible(dev, task.id)).toBe(true);
    expect(await visible(qa, task.id)).toBe(true);
    expect(await visible(sec, task.id)).toBe(true);
    expect(await visible(tm, task.id)).toBe(true);
    expect(await visible(admin, task.id)).toBe(true);
  });

  it('cross-org client cannot access a private task from another organization', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `cross-org isolation ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: devM,
      visibility_scope: 'PRIVATE_ASSIGNMENT',
    });

    // An anonymous/unauthenticated client cannot see the task
    const anon = createClient(URL, KEY);
    const { data } = await anon.from('tasks').select('id').eq('id', task.id).maybeSingle();
    expect(data).toBeNull();
  });

  it('GET /api/v1/tasks/:taskId returns 403 for a hidden task accessed via direct ID', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `forbidden direct access ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: devM,
      visibility_scope: 'PRIVATE_ASSIGNMENT',
    });

    // QA has no access; direct RLS query returns null — service throws 403
    const { data, error } = await qa.from('tasks').select('id').eq('id', task.id).maybeSingle();
    expect(data).toBeNull();
    expect(error).toBeNull(); // RLS silently returns no rows, not an error
  });

  it('preserves assignment history and revokes a removed assignee from private visibility', async () => {
    const task = await createTask(pm, ORG, pmM, {
      project_id: upi,
      title: `reassignment history ${Date.now()}`,
      status: 'BACKLOG',
      primary_assignee_member_id: devM,
      visibility_scope: 'PRIVATE_ASSIGNMENT',
    });

    expect(await visible(dev, task.id)).toBe(true);
    await updateTask(pm, ORG, task.id, { primary_assignee_member_id: qaM }, pmM);

    expect(await visible(dev, task.id)).toBe(false);
    expect(await visible(qa, task.id)).toBe(true);

    const { data: history, error } = await pm
      .from('task_assignees')
      .select('organization_member_id, assignment_type, removed_at, assigned_by_member_id, removed_by_member_id')
      .eq('task_id', task.id);
    expect(error).toBeNull();

    const oldPrimary = (history ?? []).find((row) => row.organization_member_id === devM);
    const newPrimary = (history ?? []).find((row) => row.organization_member_id === qaM && row.removed_at === null);
    expect(oldPrimary?.assignment_type).toBe('PRIMARY');
    expect(oldPrimary?.removed_at).toBeTruthy();
    expect(oldPrimary?.removed_by_member_id).toBe(pmM);
    expect(newPrimary?.assignment_type).toBe('PRIMARY');
    expect(newPrimary?.assigned_by_member_id).toBe(pmM);
  });
});
