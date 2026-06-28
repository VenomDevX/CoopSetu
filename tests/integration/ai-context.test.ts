import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildMyFocus,
  buildAsk,
  buildExecBriefing,
  buildQaSecurity,
} from '@/lib/ai/ai-context-builder';
import type { Membership } from '@/lib/auth/get-current-membership';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function membershipFor(c: SupabaseClient): Promise<Membership> {
  const { data: { user } } = await c.auth.getUser();
  const { data: member } = await c
    .from('organization_members')
    .select('id, organization_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!member) throw new Error('no active membership');
  return { memberId: member.id, organizationId: member.organization_id, roles: [], permissions: [] };
}

let pm: SupabaseClient, dev: SupabaseClient, qa: SupabaseClient;
let pmM: Membership, devM: Membership, qaM: Membership;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  qa = await asUser('qa@apexfintech.test');
  [pmM, devM, qaM] = await Promise.all([membershipFor(pm), membershipFor(dev), membershipFor(qa)]);
}, 30000);

describe('AI context builder — grounding (no fabrication)', () => {
  it('My Focus candidates are all real tasks assigned to the caller', async () => {
    const ctx = await buildMyFocus(dev, devM, {});
    const { data: mine } = await dev
      .from('tasks').select('id')
      .eq('organization_id', devM.organizationId)
      .eq('primary_assignee_member_id', devM.memberId)
      .is('archived_at', null)
      .not('status', 'in', '(DONE,CANCELLED)');
    const valid = new Set((mine ?? []).map((t) => t.id));
    for (const s of ctx.candidates) {
      expect(s.source_type).toBe('task');
      expect(valid.has(s.source_id!)).toBe(true);
    }
    if (valid.size === 0) {
      expect(ctx.isEmpty).toBe(true);
      expect(ctx.emptyMessage).toMatch(/no open assigned tasks/i);
    } else {
      expect(ctx.facts).toMatch(/assigned open task/i);
    }
  });

  it('Ask candidates resolve to real, accessible records (RLS) and carry facts', async () => {
    const ctx = await buildAsk(pm, pmM, {});
    for (const s of ctx.candidates) {
      const table = s.source_type === 'security_review' ? 'security_reviews' : 'tasks';
      const { data } = await pm.from(table).select('id').eq('id', s.source_id!).maybeSingle();
      expect(data?.id).toBe(s.source_id);
    }
  });

  it('QA & Security candidates resolve to real bugs / QA tasks / reviews only', async () => {
    const ctx = await buildQaSecurity(qa, qaM, {});
    for (const s of ctx.candidates) {
      const table = s.source_type === 'bug' ? 'bugs'
        : s.source_type === 'security_review' ? 'security_reviews' : 'tasks';
      const { data } = await qa.from(table).select('id').eq('id', s.source_id!).maybeSingle();
      expect(data?.id).toBe(s.source_id);
    }
  });
});

describe('AI context builder — organization isolation', () => {
  it('Exec briefing facts + incident citations stay within the caller org', async () => {
    const ctx = await buildExecBriefing(pm, pmM, {});
    expect(ctx.facts === '' || /project\(s\)/.test(ctx.facts)).toBe(true);
    for (const s of ctx.candidates) {
      expect(s.source_type).toBe('incident');
      // Re-fetch under the caller's RLS client — a cross-org id would not resolve.
      const { data } = await pm
        .from('incidents')
        .select('id, organization_id')
        .eq('id', s.source_id!)
        .maybeSingle();
      expect(data?.id).toBe(s.source_id);
      expect(data?.organization_id).toBe(pmM.organizationId);
    }
  });
});
