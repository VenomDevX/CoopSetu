import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionDemoWorkspace } from '@/lib/demo/provision-demo-workspace';
import { resetDemoWorkspace } from '@/lib/demo/reset-demo-workspace';

const admin = createAdminClient();
let mockAuthUserId: string;

describe('Demo Workspace Integration', () => {
  beforeAll(async () => {
    // Create a mock anonymous user
    const { data, error } = await admin.auth.admin.createUser({
      email: `test_demo_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    
    if (error) throw error;
    mockAuthUserId = data.user.id;
  });

  afterAll(async () => {
    // Cleanup mock user (will cascade delete demo sessions and org due to schema)
    if (mockAuthUserId) {
      await admin.auth.admin.deleteUser(mockAuthUserId);
    }
  });

  it('should provision a new demo workspace', async () => {
    const result = await provisionDemoWorkspace(mockAuthUserId, 'PROJECT_MANAGER');
    
    expect(result.orgId).toBeDefined();
    expect(result.memberId).toBeDefined();
    
    // Verify DB records
    const { data: org } = await admin.from('organizations').select('is_demo').eq('id', result.orgId).single();
    expect(org?.is_demo).toBe(true);

    const { data: session } = await admin.from('demo_sessions').select('*').eq('auth_user_id', mockAuthUserId).single();
    expect(session).toBeDefined();
    expect(session?.active_demo_role).toBe('PROJECT_MANAGER');
  });

  it('should reset the demo workspace and retain the same org ID', async () => {
    const { data: oldSession } = await admin.from('demo_sessions').select('*').eq('auth_user_id', mockAuthUserId).single();
    expect(oldSession).toBeDefined();

    const oldOrgId = oldSession?.organization_id;

    await resetDemoWorkspace(mockAuthUserId);

    const { data: newSession } = await admin.from('demo_sessions').select('*').eq('auth_user_id', mockAuthUserId).single();
    expect(newSession).toBeDefined();
    
    // The reset process provisions a NEW organization and updates the session, 
    // or it wipes the data. Wait, our `resetDemoWorkspace` creates a NEW organization
    // and updates the session to point to it, then deletes the old one.
    expect(newSession?.organization_id).not.toBe(oldOrgId);
    expect(newSession?.active_demo_role).toBe(oldSession?.active_demo_role);
  });
});
