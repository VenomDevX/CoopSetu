import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55001';
const adminClient = createClient(URL, process.env.SUPABASE_SECRET_KEY!);

describe('Approval Request Visibility', () => {
  let authClient1: SupabaseClient; // org1 owner
  let authClient2: SupabaseClient; // org1 employee
  let authClient3: SupabaseClient; // org2 member (cross-org)
  
  let orgId1: string;
  let orgId2: string;
  let privateTaskId: string;
  let publicProjectId: string;

  beforeAll(async () => {
    const email1 = `owner-${Date.now()}@example.com`;
    const email2 = `employee-${Date.now()}@example.com`;
    const email3 = `cross-${Date.now()}@example.com`;
    
    // Setup users
    const { data: user1 } = await adminClient.auth.admin.createUser({ email: email1, password: 'password123', email_confirm: true });
    const { data: user2 } = await adminClient.auth.admin.createUser({ email: email2, password: 'password123', email_confirm: true });
    const { data: user3 } = await adminClient.auth.admin.createUser({ email: email3, password: 'password123', email_confirm: true });
    
    // Create Orgs
    const { data: org1 } = await adminClient.from('organizations').insert({ name: 'Org 1', slug: `org1-${Date.now()}` }).select('id').single();
    const { data: org2 } = await adminClient.from('organizations').insert({ name: 'Org 2', slug: `org2-${Date.now()}` }).select('id').single();
    orgId1 = org1!.id;
    orgId2 = org2!.id;

    // Add users to orgs
    const { data: m1 } = await adminClient.from('organization_members').insert({ organization_id: orgId1, user_id: user1!.user!.id }).select('id').single();
    const { data: m2 } = await adminClient.from('organization_members').insert({ organization_id: orgId1, user_id: user2!.user!.id }).select('id').single();
    const { data: m3 } = await adminClient.from('organization_members').insert({ organization_id: orgId2, user_id: user3!.user!.id }).select('id').single();

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

    // Project (Public in org, well, we need to assign user2 to see it)
    const { data: proj } = await adminClient.from('projects').insert({ organization_id: orgId1, name: 'Project', code: 'PRJ' }).select('id').single();
    publicProjectId = proj!.id;

    await adminClient.from('project_members').insert({
      project_id: publicProjectId,
      organization_member_id: m2!.id
    });

    // Private Task
    const { data: task } = await adminClient.from('tasks').insert({ 
      organization_id: orgId1, 
      project_id: publicProjectId, 
      title: 'Secret Task', 
      visibility_scope: 'PRIVATE_ASSIGNMENT' 
    }).select('id').single();
    privateTaskId = task!.id;

    // Approval Request tied to Private Task
    await adminClient.from('approval_requests').insert({
      organization_id: orgId1,
      project_id: publicProjectId,
      task_id: privateTaskId,
      approval_type: 'QA',
      status: 'PENDING'
    });

    // Approval Request tied to Public Project only
    await adminClient.from('approval_requests').insert({
      organization_id: orgId1,
      project_id: publicProjectId,
      approval_type: 'RELEASE_MANAGER',
      status: 'PENDING'
    });
  });

  it('allows org member to see project-linked approval request', async () => {
    const { data, error } = await authClient2.from('approval_requests').select('*').eq('project_id', publicProjectId).is('task_id', null);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it('hides private-task linked approval request from unassigned org member', async () => {
    const { data, error } = await authClient2.from('approval_requests').select('*').eq('task_id', privateTaskId);
    expect(error).toBeNull();
    // Should not see it since it's private task and user2 is just employee
    expect(data!.length).toBe(0); 
  });

  it('hides all approval requests from cross-org user', async () => {
    const { data, error } = await authClient3.from('approval_requests').select('*');
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});
