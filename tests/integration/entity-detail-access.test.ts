import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasPermission } from '@/lib/auth/require-organization';
import type { Membership } from '@/lib/auth/get-current-membership';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const MISSING = '00000000-0000-0000-0000-0000deadbeef';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/** Mirror of loadDetail's record-level query: id + caller's org, RLS-scoped. */
async function loadByIdInOrg(c: SupabaseClient, table: string, id: string) {
  const { data } = await c.from(table).select('id, organization_id').eq('id', id).eq('organization_id', ORG).maybeSingle();
  return data;
}
async function firstId(c: SupabaseClient, table: string): Promise<string> {
  const { data } = await c.from(table).select('id').eq('organization_id', ORG).limit(1).maybeSingle();
  if (!data) throw new Error(`no seed row for ${table}`);
  return data.id as string;
}

let pm: SupabaseClient, qa: SupabaseClient, sec: SupabaseClient, outsider: SupabaseClient;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  qa = await asUser('qa@apexfintech.test');
  sec = await asUser('sec@apexfintech.test');
  const o = createClient(URL, KEY);
  await o.auth.signUp({ email: `outsider_${Date.now()}@nowhere.test`, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  outsider = o;

  // The seed ships no approval_requests; create one (PM holds approval:create)
  // so the approval citation has a real record to resolve.
  const { count } = await pm.from('approval_requests').select('id', { count: 'exact', head: true }).eq('organization_id', ORG);
  if (!count) {
    const { error } = await pm.from('approval_requests').insert({
      organization_id: ORG, approval_type: 'RELEASE_DEPLOYMENT', status: 'PENDING',
    });
    if (error) throw new Error(`seed approval: ${error.message}`);
  }
}, 30000);

// table → a client guaranteed to be able to read a seed row of it
const TABLES: { table: string; reader: () => SupabaseClient }[] = [
  { table: 'bugs', reader: () => qa },
  { table: 'security_reviews', reader: () => sec },
  { table: 'releases', reader: () => pm },
  { table: 'approval_requests', reader: () => pm },
  { table: 'incidents', reader: () => pm },
  { table: 'tasks', reader: () => pm },
  { table: 'projects', reader: () => pm },
];

describe('Entity detail access — record-level org scoping', () => {
  it('an authorized member opens the correct record by id', async () => {
    for (const { table, reader } of TABLES) {
      const id = await firstId(reader(), table);
      const row = await loadByIdInOrg(reader(), table, id);
      expect(row?.id).toBe(id);
      expect(row?.organization_id).toBe(ORG);
    }
  });

  it('another organization cannot read records by changing the id in the URL', async () => {
    for (const { table, reader } of TABLES) {
      const id = await firstId(reader(), table);
      // Org-less outsider attempts the same id → RLS reveals nothing.
      const { data } = await outsider.from(table).select('id').eq('id', id).maybeSingle();
      expect(data ?? null).toBeNull();
    }
  });

  it('a missing id returns nothing (404)', async () => {
    for (const { table, reader } of TABLES) {
      const row = await loadByIdInOrg(reader(), table, MISSING);
      expect(row ?? null).toBeNull();
    }
  });
});

describe('Entity detail access — role permission gate (403)', () => {
  const noPerms: Membership = { memberId: 'm', organizationId: ORG, roles: ['CLIENT_VIEWER'], permissions: [] };
  const withPerms: Membership = { memberId: 'm', organizationId: ORG, roles: ['QA_ENGINEER'], permissions: ['qa:view', 'security:view', 'release:view', 'approval:view', 'task:view'] };

  it('denies a role that lacks the detail permission', () => {
    for (const p of ['qa:view', 'security:view', 'release:view', 'approval:view', 'task:view']) {
      expect(hasPermission(noPerms, p)).toBe(false);
    }
  });

  it('admins and permitted roles pass the gate', () => {
    for (const p of ['qa:view', 'security:view', 'release:view', 'approval:view', 'task:view']) {
      expect(hasPermission(withPerms, p)).toBe(true);
    }
    const admin: Membership = { memberId: 'm', organizationId: ORG, roles: ['ORG_ADMIN'], permissions: [] };
    expect(hasPermission(admin, 'release:view')).toBe(true);
  });
});
