import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createIncident, addTimelineEvent, upsertPostmortem } from '@/services/incident.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('KEY missing'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('PWD missing'); })();

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

async function memberId(c: SupabaseClient) {
  const user = (await c.auth.getUser()).data.user;
  if (!user) throw new Error('missing user');
  const { data, error } = await c
    .from('organization_members')
    .select('id')
    .eq('organization_id', ORG)
    .eq('user_id', user.id)
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let pm: SupabaseClient;
let dev: SupabaseClient;
let pmMember: string;
let devMember: string;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  pmMember = await memberId(pm);
  devMember = await memberId(dev);
});

describe('Group B Actions: Incidents', () => {
  let incidentId: string;

  it('can declare an incident', async () => {
    const incident = await createIncident(pm, ORG, pmMember, {
      title: 'Database Outage in US-East',
      severity: 'SEV1',
      customer_impact: 'Users cannot log in.',
    });
    expect(incident).toBeDefined();
    expect(incident.title).toBe('Database Outage in US-East');
    expect(incident.severity).toBe('SEV1');
    incidentId = incident.id;
  });

  it('can add a timeline event', async () => {
    const evt = await addTimelineEvent(pm, incidentId, pmMember, 'Investigating root cause...', 'UPDATE');
    expect(evt).toBeDefined();
    expect(evt.message).toBe('Investigating root cause...');
  });

  it('can create a postmortem', async () => {
    const pmDoc = await upsertPostmortem(pm, incidentId, pmMember, {
      summary: 'The main cluster failed over.',
      root_cause: 'Network partition.',
      resolution: 'Restored networking.',
    });
    expect(pmDoc).toBeDefined();
    expect(pmDoc.summary).toBe('The main cluster failed over.');
  });
});
