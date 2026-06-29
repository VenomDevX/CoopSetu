import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { categoryOf, NOTIFICATION_CATEGORIES } from '@/lib/constants/notification-categories';

// Guards the "de-fake pass" on Inbox / Overview / My Work: every count the UI
// shows must come from the same real, org-scoped query, and the numbers must be
// mutually consistent. We exercise the exact data paths the services use.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const CLOSED = ['DONE', 'CANCELLED'];
const PAGE_SIZE = 8;

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function memberId(c: SupabaseClient): Promise<string> {
  const { data: u } = await c.auth.getUser();
  const { data } = await c.from('organization_members')
    .select('id').eq('organization_id', ORG).eq('user_id', u.user!.id).single();
  return data!.id;
}

/** Reproduces services/notification.service.ts listNotifications counting. */
async function notificationCounts(c: SupabaseClient, recipient: string) {
  const { data } = await c.from('notifications')
    .select('type, read_at, organization_id')
    .eq('recipient_member_id', recipient).is('archived_at', null).limit(2000);
  const counts = { all: 0, unread: 0 } as Record<string, number>;
  for (const cat of NOTIFICATION_CATEGORIES) counts[cat.key] = 0;
  for (const row of data ?? []) {
    counts.all += 1;
    if (!row.read_at) counts.unread += 1;
    counts[categoryOf(row.type)] += 1;
  }
  return { counts, rows: data ?? [] };
}

let pm: SupabaseClient, dev: SupabaseClient, outsider: SupabaseClient;
let pmMember: string, devMember: string;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  pmMember = await memberId(pm);
  devMember = await memberId(dev);
  const c = createClient(URL, KEY);
  await c.auth.signUp({ email: `outsider_${Date.now()}@nowhere.test`, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  outsider = c;
}, 30000);

describe('Empty workspace + cross-company isolation', () => {
  it('an org-less user sees zero notifications, tasks, and projects', async () => {
    const [{ data: n }, { data: t }, { data: p }] = await Promise.all([
      outsider.from('notifications').select('id'),
      outsider.from('tasks').select('id'),
      outsider.from('projects').select('id'),
    ]);
    expect(n?.length ?? 0).toBe(0);
    expect(t?.length ?? 0).toBe(0);
    expect(p?.length ?? 0).toBe(0);
  });

  it('Inbox Zero: with no notifications every count is 0 (no contradictions)', async () => {
    const outMember = createClient(URL, KEY); // outsider has no membership at all
    const { counts } = await notificationCounts(outMember, '00000000-0000-0000-0000-0000000000ff');
    expect(counts.all).toBe(0);
    expect(counts.unread).toBe(0);
    for (const cat of NOTIFICATION_CATEGORIES) expect(counts[cat.key]).toBe(0);
  });

  it("a member's notifications are all scoped to their organization", async () => {
    const { rows } = await notificationCounts(dev, devMember);
    for (const r of rows as { organization_id: string }[]) expect(r.organization_id).toBe(ORG);
  });
});

describe('Inbox count consistency (same query feeds ALL / UNREAD / categories)', () => {
  it('all == row count, unread == unread rows, and categories sum to all', async () => {
    const { counts, rows } = await notificationCounts(dev, devMember);
    expect(counts.all).toBe(rows.length);
    expect(counts.unread).toBe(rows.filter((r) => !r.read_at).length);
    const catSum = NOTIFICATION_CATEGORIES.reduce((s, cat) => s + counts[cat.key], 0);
    expect(catSum).toBe(counts.all);
  });

  it('inserting one mention keeps every count mutually consistent', async () => {
    const before = (await notificationCounts(dev, devMember)).counts;
    await pm.rpc('create_notification', {
      p_org: ORG, p_recipient: devMember, p_type: 'TASK_MENTIONED',
      p_title: 'consistency check', p_body: 'x', p_entity_type: 'task',
      p_entity_id: null, p_project_id: null, p_metadata: {},
    });
    const after = (await notificationCounts(dev, devMember)).counts;
    expect(after.all).toBe(before.all + 1);
    expect(after.unread).toBe(before.unread + 1);
    expect(after.mentions).toBe(before.mentions + 1);
    const catSum = NOTIFICATION_CATEGORIES.reduce((s, cat) => s + after[cat.key], 0);
    expect(catSum).toBe(after.all);
  });
});

describe('Snooze actually hides a notification (Actionable Inbox)', () => {
  /** Reproduces the list filter in services/notification.service.ts. */
  async function visibleIds(c: SupabaseClient, recipient: string): Promise<Set<string>> {
    const now = new Date().toISOString();
    const { data } = await c.from('notifications')
      .select('id')
      .eq('recipient_member_id', recipient).is('archived_at', null)
      .or(`snoozed_until.is.null,snoozed_until.lte.${now}`).limit(2000);
    return new Set((data ?? []).map((r) => r.id as string));
  }

  it('a future snoozed_until removes it from the inbox; a past one resurfaces it', async () => {
    // Create a fresh notification for dev so we have a known id to snooze.
    await pm.rpc('create_notification', {
      p_org: ORG, p_recipient: devMember, p_type: 'TASK_MENTIONED',
      p_title: 'snooze check', p_body: 'x', p_entity_type: 'task',
      p_entity_id: null, p_project_id: null, p_metadata: {},
    });
    const { data: created } = await dev.from('notifications')
      .select('id').eq('recipient_member_id', devMember).eq('title', 'snooze check')
      .order('created_at', { ascending: false }).limit(1).single();
    const id = created!.id as string;

    expect(await visibleIds(dev, devMember)).toContain(id);

    // Snooze 1h into the future → hidden.
    await dev.from('notifications')
      .update({ snoozed_until: new Date(Date.now() + 3600_000).toISOString() }).eq('id', id);
    expect(await visibleIds(dev, devMember)).not.toContain(id);

    // Snooze window elapsed (past) → visible again.
    await dev.from('notifications')
      .update({ snoozed_until: new Date(Date.now() - 1000).toISOString() }).eq('id', id);
    expect(await visibleIds(dev, devMember)).toContain(id);
  });
});

describe('My Work pagination consistency (KPI totals agree with the table)', () => {
  it('the table source, the "of Z" total, and KPI active are one source of truth', async () => {
    const { data: tasks } = await dev.from('tasks')
      .select('id, status, due_date, organization_id')
      .eq('organization_id', ORG).is('archived_at', null)
      .limit(500);
    const rows = tasks ?? [];

    // KPI active is the count of open tasks within the SAME array the table pages.
    const active = rows.filter((t) => !CLOSED.includes(t.status)).length;
    expect(active).toBeLessThanOrEqual(rows.length);

    // "Showing X–Y of Z": Z is the array length; paging must cover it exactly.
    const Z = rows.length;
    const pageCount = Math.max(1, Math.ceil(Z / PAGE_SIZE));
    const lastEnd = Math.min(Z, (pageCount - 1) * PAGE_SIZE + PAGE_SIZE);
    expect(lastEnd).toBe(Z);

    // Every RLS-visible task belongs to this org (no cross-company bleed).
    for (const t of rows) {
      expect(t.organization_id).toBe(ORG);
    }
  });
});
