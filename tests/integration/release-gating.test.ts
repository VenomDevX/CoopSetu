import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(error.message);
  return c;
}

let pm: SupabaseClient;

beforeAll(async () => { pm = await asUser('pm@apexfintech.test'); }, 20000);

describe('release_can_deploy gating', () => {
  it('blocks deploy until all required approvals pass', async () => {
    const { data: proj } = await pm.from('projects').select('id').limit(1).single();

    const { data: rel } = await pm.from('releases').insert({
      organization_id: ORG, project_id: proj!.id, name: 'Gate Test', version: 'v9.9', status: 'DRAFT',
    }).select().single();

    // create the three required gates
    await pm.from('release_approvals').insert([
      { release_id: rel!.id, approval_type: 'QA', status: 'PENDING' },
      { release_id: rel!.id, approval_type: 'SECURITY', status: 'PENDING' },
      { release_id: rel!.id, approval_type: 'RELEASE_MANAGER', status: 'PENDING' },
    ]);

    let { data: canDeploy } = await pm.rpc('release_can_deploy', { p_release: rel!.id });
    expect(canDeploy).toBe(false);

    // approve QA + SECURITY only — still blocked
    await pm.from('release_approvals').update({ status: 'APPROVED' }).eq('release_id', rel!.id).in('approval_type', ['QA', 'SECURITY']);
    ({ data: canDeploy } = await pm.rpc('release_can_deploy', { p_release: rel!.id }));
    expect(canDeploy).toBe(false);

    // approve the final gate — now allowed
    await pm.from('release_approvals').update({ status: 'APPROVED' }).eq('release_id', rel!.id).eq('approval_type', 'RELEASE_MANAGER');
    ({ data: canDeploy } = await pm.rpc('release_can_deploy', { p_release: rel!.id }));
    expect(canDeploy).toBe(true);
  }, 20000);

  it('compliance-required release also needs COMPLIANCE gate', async () => {
    const { data: proj } = await pm.from('projects').select('id').limit(1).single();
    const { data: rel } = await pm.from('releases').insert({
      organization_id: ORG, project_id: proj!.id, name: 'Compliance Gate', version: 'v9.8',
      status: 'DRAFT', requires_compliance_approval: true,
    }).select().single();

    await pm.from('release_approvals').insert([
      { release_id: rel!.id, approval_type: 'QA', status: 'APPROVED' },
      { release_id: rel!.id, approval_type: 'SECURITY', status: 'APPROVED' },
      { release_id: rel!.id, approval_type: 'RELEASE_MANAGER', status: 'APPROVED' },
    ]);
    // COMPLIANCE missing => still blocked
    let { data: canDeploy } = await pm.rpc('release_can_deploy', { p_release: rel!.id });
    expect(canDeploy).toBe(false);

    await pm.from('release_approvals').insert({ release_id: rel!.id, approval_type: 'COMPLIANCE', status: 'APPROVED' });
    ({ data: canDeploy } = await pm.rpc('release_can_deploy', { p_release: rel!.id }));
    expect(canDeploy).toBe(true);
  }, 20000);
});
