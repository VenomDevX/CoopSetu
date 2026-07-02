import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55001';
const adminClient = createClient(URL, process.env.SUPABASE_SECRET_KEY!);

describe('Incident Action Tests', () => {
  let authClient1: SupabaseClient; // org1 owner
  let authClient2: SupabaseClient; // org1 employee (maybe unauthorized)
  let authClient3: SupabaseClient; // org2 member (cross-org)
  
  let orgId1: string;
  let orgId2: string;
  let projectId: string;
  let incidentId: string;

  beforeAll(async () => {
    const email1 = `inc-owner-${Date.now()}@example.com`;
    const email2 = `inc-employee-${Date.now()}@example.com`;
    const email3 = `inc-cross-${Date.now()}@example.com`;
    
    // Setup users
    const { data: user1 } = await adminClient.auth.admin.createUser({ email: email1, password: 'password123', email_confirm: true });
    const { data: user2 } = await adminClient.auth.admin.createUser({ email: email2, password: 'password123', email_confirm: true });
    const { data: user3 } = await adminClient.auth.admin.createUser({ email: email3, password: 'password123', email_confirm: true });
    
    // Create Orgs
    const { data: org1 } = await adminClient.from('organizations').insert({ name: 'Org 1', slug: `org1-inc-${Date.now()}` }).select('id').single();
    const { data: org2 } = await adminClient.from('organizations').insert({ name: 'Org 2', slug: `org2-inc-${Date.now()}` }).select('id').single();
    orgId1 = org1!.id;
    orgId2 = org2!.id;

    // Add users to orgs
    const { data: m1 } = await adminClient.from('organization_members').insert({ organization_id: orgId1, user_id: user1!.user.id }).select('id').single();
    const { data: m2 } = await adminClient.from('organization_members').insert({ organization_id: orgId1, user_id: user2!.user.id }).select('id').single();
    const { data: m3 } = await adminClient.from('organization_members').insert({ organization_id: orgId2, user_id: user3!.user.id }).select('id').single();

    // Assign roles
    const { data: ownerRole } = await adminClient.from('roles').select('id').eq('code', 'ORG_OWNER').is('organization_id', null).single();
    const { data: empRole } = await adminClient.from('roles').select('id').eq('code', 'DEVELOPER').is('organization_id', null).single();
    await adminClient.from('member_roles').insert([
      { organization_member_id: m1!.id, role_id: ownerRole!.id },
      { organization_member_id: m2!.id, role_id: empRole!.id },
      { organization_member_id: m3!.id, role_id: empRole!.id },
    ]);

    // Clients
    authClient1 = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await authClient1.auth.signInWithPassword({ email: email1, password: 'password123' });
    authClient2 = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await authClient2.auth.signInWithPassword({ email: email2, password: 'password123' });
    authClient3 = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await authClient3.auth.signInWithPassword({ email: email3, password: 'password123' });

    // Project (Public in org)
    const { data: proj } = await adminClient.from('projects').insert({ organization_id: orgId1, name: 'Project', code: 'PRJ' }).select('id').single();
    projectId = proj!.id;

    // Create Incident via API or DB directly for testing exports/postmortems
    const { data: inc } = await adminClient.from('incidents').insert({
      organization_id: orgId1,
      project_id: projectId,
      title: 'Test Incident',
      status: 'INVESTIGATING',
      severity: 'SEV2'
    }).select('id').single();
    incidentId = inc!.id;
  });

  describe('Declare Incident API', () => {
    // Tests for API routes would require hitting Next.js server running locally, 
    // but we can test RLS at database level here.
    it('allows authorized user to view incident', async () => {
      const { data, error } = await authClient1.from('incidents').select('*').eq('id', incidentId);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    });

    it('denies cross-org user from viewing incident', async () => {
      const { data, error } = await authClient3.from('incidents').select('*').eq('id', incidentId);
      expect(error).toBeNull();
      expect(data!.length).toBe(0);
    });
  });
});
