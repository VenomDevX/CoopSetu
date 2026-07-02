import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55001';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'fake_anon_key_for_testing'; // Doesn't need to be a real JWT for this placeholder comes from env in CI

// The integration environment uses valid anon key from .env.local
const anonClient = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!);
const adminClient = createClient(URL, process.env.SUPABASE_SECRET_KEY!);

describe('Security Definer RPCs Hardening', () => {
  let authClient: SupabaseClient;
  let unauthorizedClient: SupabaseClient;
  
  let orgId: string;
  let unauthOrgId: string;
  let testReleaseId: string;
  let testProjectId: string;

  beforeAll(async () => {
    // 1. Setup authenticated users and organizations using adminClient
    const email1 = `auth1-${Date.now()}@example.com`;
    const email2 = `unauth2-${Date.now()}@example.com`;
    
    // Setup users...
    const { data: user1 } = await adminClient.auth.admin.createUser({ email: email1, password: 'password123', email_confirm: true });
    const { data: user2 } = await adminClient.auth.admin.createUser({ email: email2, password: 'password123', email_confirm: true });
    
    // Create Orgs
    const { data: org1 } = await adminClient.from('organizations').insert({ name: 'Org 1', slug: `org1-${Date.now()}` }).select('id').single();
    const { data: org2 } = await adminClient.from('organizations').insert({ name: 'Org 2', slug: `org2-${Date.now()}` }).select('id').single();
    orgId = org1!.id;
    unauthOrgId = org2!.id;

    // Add users to orgs
    const { data: m1 } = await adminClient.from('organization_members').insert({ organization_id: orgId, user_id: user1!.user!.id }).select('id').single();
    const { data: m2 } = await adminClient.from('organization_members').insert({ organization_id: unauthOrgId, user_id: user2!.user!.id }).select('id').single();
    
    // Assign permissions
    const { data: role } = await adminClient.from('roles').select('id').eq('code', 'ORG_OWNER').is('organization_id', null).single();
    await adminClient.from('member_roles').insert({ organization_member_id: m1!.id, role_id: role!.id });
    await adminClient.from('member_roles').insert({ organization_member_id: m2!.id, role_id: role!.id });

    // Sign in users
    authClient = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await authClient.auth.signInWithPassword({ email: email1, password: 'password123' });
    
    unauthorizedClient = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await unauthorizedClient.auth.signInWithPassword({ email: email2, password: 'password123' });

    // Setup a project and release in org1
    const { data: proj } = await adminClient.from('projects').insert({ organization_id: orgId, name: 'Project 1', code: 'P1' }).select('id').single();
    testProjectId = proj!.id;
    const { data: rel } = await adminClient.from('releases').insert({ organization_id: orgId, project_id: testProjectId, name: 'Release 1', version: '1.0.0', status: 'DRAFT' }).select('id').single();
    testReleaseId = rel!.id;
  });

  describe('release_can_deploy', () => {
    it('returns true/false correctly for authorized user', async () => {
      const { data, error } = await authClient.rpc('release_can_deploy', { p_release: testReleaseId });
      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });

    it('returns false (does not leak metadata) for cross-org user', async () => {
      const { data, error } = await unauthorizedClient.rpc('release_can_deploy', { p_release: testReleaseId });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
    
    it('returns false (does not leak existence) for nonexistent release', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { data, error } = await authClient.rpc('release_can_deploy', { p_release: fakeId });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe('create_project', () => {
    it('allows authorized user to create project', async () => {
      const { data, error } = await authClient.rpc('create_project', { 
        p_org: orgId, 
        p_payload: { name: 'Test Proj', code: 'TPX' }
      });
      expect(error).toBeNull();
      expect(data).toHaveProperty('id');
    });

    it('denies cross-org creation', async () => {
      const { error } = await unauthorizedClient.rpc('create_project', { 
        p_org: orgId, 
        p_payload: { name: 'Hack Proj', code: 'HCK' }
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('NOT_FOUND');
    });
    
    it('prevents assigning random unverified owners', async () => {
      const fakeMemberId = '00000000-0000-0000-0000-000000000000';
      const { error } = await authClient.rpc('create_project', { 
        p_org: orgId, 
        p_payload: { name: 'Test Proj 2', code: 'TPY', owner_member_id: fakeMemberId }
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('INVALID_OWNER');
    });
  });

  describe('create_project_team', () => {
    it('denies project enumeration to unauthorized users', async () => {
      const { error } = await unauthorizedClient.rpc('create_project_team', {
        p_project_id: testProjectId,
        p_team_name: 'Hack Team'
      });
      expect(error).not.toBeNull();
      // Must disguise as NOT_FOUND to avoid leaking project existence
      expect(error!.message).toContain('NOT_FOUND');
    });
  });
});
