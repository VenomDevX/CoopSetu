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
  const { data, error } = await c.from('tasks').select('id, project:project_id(code)').limit(200);
  if (error) throw new Error(JSON.stringify(error));
  return (data as unknown as { id: string; project: { code: string } | null }[])
    .find((t) => t.project?.code === 'UPI')!.id;
}

let pm: SupabaseClient, dev: SupabaseClient;
const PM_U = '00000000-0000-0000-0000-000000000002';

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
}, 30000);

describe('comment edit/delete ownership (RLS)', () => {
  async function newComment() {
    const task = await upiTask(pm);
    const pmM = await memberId(pm, PM_U);
    const { data, error } = await pm.from('task_comments')
      .insert({ organization_id: ORG, task_id: task, author_member_id: pmM, body: 'original body' })
      .select('id').single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  it('author can edit own comment (sets edited_at)', async () => {
    const id = await newComment();
    const { data, error } = await pm.from('task_comments')
      .update({ body: 'edited body', edited_at: new Date().toISOString() })
      .eq('id', id).select('body, edited_at');
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].edited_at).toBeTruthy();
  });

  it('non-author cannot edit another user\'s comment', async () => {
    const id = await newComment();
    const { data } = await dev.from('task_comments')
      .update({ body: 'hacked' }).eq('id', id).select('id');
    expect(data ?? []).toHaveLength(0); // RLS update_own blocks → 0 rows
  });

  it('author can soft-delete own comment (sets deleted_at, row survives)', async () => {
    const id = await newComment();
    const { data, error } = await pm.from('task_comments')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id, deleted_at');
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].deleted_at).toBeTruthy();
  });

  it('non-author cannot soft-delete another user\'s comment', async () => {
    const id = await newComment();
    const { data } = await dev.from('task_comments')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id');
    expect(data ?? []).toHaveLength(0);
  });
});
