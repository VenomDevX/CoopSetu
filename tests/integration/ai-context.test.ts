import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildMyFocus,
  buildAsk,
  buildExecBriefing,
  buildQaSecurity,
  buildMyLearning,
} from '@/lib/ai/ai-context-builder';
import type { Membership } from '@/lib/auth/get-current-membership';

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
  it('My Focus candidates are all real tasks visible to the caller', async () => {
    const ctx = await buildMyFocus(dev, devM, {});
    const { data: visible } = await dev
      .from('tasks').select('id')
      .eq('organization_id', devM.organizationId)
      .is('archived_at', null)
      .not('status', 'in', '(DONE,CANCELLED)');
    const valid = new Set((visible ?? []).map((t) => t.id));
    for (const s of ctx.candidates) {
      expect(s.source_type).toBe('task');
      expect(valid.has(s.source_id!)).toBe(true);
    }
    if (valid.size === 0) {
      expect(ctx.isEmpty).toBe(true);
      expect(ctx.emptyMessage).toMatch(/no open visible tasks/i);
    } else {
      expect(ctx.facts).toMatch(/visible open task/i);
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

// ---------------------------------------------------------------------------
// buildMyLearning (Career AI / 'my-learning' intent, Phase 5). Unlike every
// other builder above, `Membership` carries no trainee id — the builder must
// independently resolve the caller's own `trainees` row via auth.getUser(),
// exactly like the trainee-facing API routes do. These tests exist mainly to
// prove that resolution is both correct (a trainee sees their own data) and
// isolating (never another trainee's).
// ---------------------------------------------------------------------------
describe('buildMyLearning — trainee-identity resolution (no fabrication)', () => {
  let admin: SupabaseClient;
  let trainee: SupabaseClient, employer: SupabaseClient;
  let traineeM: Membership, employerM: Membership;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    trainee = await asUser('trainee@coopsetu.test');
    employer = await asUser('employer@coopsetu.test');
    [traineeM, employerM] = await Promise.all([membershipFor(trainee), membershipFor(employer)]);

    // buildMyLearning cross-references open jobs and courses — seed at least
    // one of each so this file's assertions don't depend on another
    // integration file having already run in the same process.
    let { data: employerRow } = await admin.from('employers').select('id').eq('user_id', '00000000-0000-0000-0000-000000000005').eq('organization_id', ORG).maybeSingle();
    if (!employerRow) {
      const { data } = await admin.from('employers').insert({ user_id: '00000000-0000-0000-0000-000000000005', organization_id: ORG, company_name: 'AI Context Test Co', status: 'ACTIVE' }).select('id').single();
      employerRow = data;
    }
    await admin.from('jobs').insert({ employer_id: employerRow!.id, title: `AI Context Test Job ${Date.now()}`, status: 'OPEN' });

    const { data: programme } = await admin.from('programmes').insert({
      organization_id: ORG, title: `AI Context Test Programme ${Date.now()}`, duration_days: 30, status: 'ACTIVE',
    }).select('id').single();
    await admin.from('courses').insert({ programme_id: programme!.id, title: 'AI Context Test Course', status: 'ACTIVE' });
  }, 30000);

  it('resolves the caller\'s own trainees row and only cites real, in-org jobs/courses', async () => {
    const ctx = await buildMyLearning(trainee, traineeM, {});
    expect(ctx.facts).toMatch(/employment readiness/i);

    for (const s of ctx.candidates) {
      expect(['job', 'course']).toContain(s.source_type);
      const table = s.source_type === 'job' ? 'jobs' : 'courses';
      // Re-fetch under the trainee's own RLS client — a fabricated or
      // out-of-org id would not resolve.
      const { data } = await trainee.from(table).select('id').eq('id', s.source_id!).maybeSingle();
      expect(data?.id).toBe(s.source_id);
    }
  });

  it('a caller with no trainees row of their own gets a truthful empty result, not another trainee\'s data', async () => {
    const ctx = await buildMyLearning(employer, employerM, {});
    expect(ctx.isEmpty).toBe(true);
    expect(ctx.emptyMessage).toMatch(/only available to trainees/i);
    expect(ctx.facts).toBe('');
    expect(ctx.candidates).toEqual([]);
  });

  it('is scoped to the caller\'s own skills — never leaks a different trainee\'s profile', async () => {
    const { data: skill } = await admin.from('skills')
      .insert({ name: `AI Context Test Skill ${Date.now()}`, category: 'Technical' })
      .select('id, name').single();

    const { data: traineeRow } = await admin.from('trainees')
      .select('id').eq('user_id', '00000000-0000-0000-0000-000000000004').eq('organization_id', ORG).single();
    await admin.from('trainee_skills').upsert(
      { trainee_id: traineeRow!.id, skill_id: skill!.id, proficiency: 100 },
      { onConflict: 'trainee_id,skill_id' },
    );

    // A second, independent trainee gets a *different* distinctive skill —
    // proves the first trainee's facts don't leak into an unrelated caller.
    const otherEmail = `ai-context-other-trainee-${Date.now()}@example.com`;
    const { data: otherUser } = await admin.auth.admin.createUser({
      email: otherEmail, password: process.env.TEST_USER_PASSWORD ?? 'testpass123', email_confirm: true,
    });
    await admin.from('trainees').insert({ user_id: otherUser!.user!.id, organization_id: ORG, status: 'ACTIVE' });
    const { data: otherSkill } = await admin.from('skills')
      .insert({ name: `AI Context Other Skill ${Date.now()}`, category: 'Technical' })
      .select('id').single();
    const { data: otherTrainee } = await admin.from('trainees').select('id').eq('user_id', otherUser!.user!.id).single();
    await admin.from('trainee_skills').insert({ trainee_id: otherTrainee!.id, skill_id: otherSkill!.id, proficiency: 100 });

    const ctx = await buildMyLearning(trainee, traineeM, {});
    expect(ctx.facts).toContain(skill!.name);
    expect(ctx.facts).not.toContain('AI Context Other Skill');
  });
});
