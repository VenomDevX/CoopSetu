import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ 
    email, 
    password: process.env.TEST_USER_PASSWORD ?? 'testpass123' 
  });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

let pm: SupabaseClient, dev: SupabaseClient;
let admin: SupabaseClient;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  admin = createClient(URL, ADMIN_KEY);
}, 30000);

describe('Phase 1: Comprehensive Audit Logging', () => {
  it('Task creation triggers an audit record via DB trigger', async () => {
    const { data: proj } = await pm.from('projects').select('id').limit(1).single();
    
    // Create a task
    const title = `Audit Test Task ${Date.now()}`;
    const { data: task, error } = await pm.from('tasks')
      .insert({ 
        organization_id: ORG, 
        project_id: proj!.id, 
        title, 
        status: 'BACKLOG' 
      })
      .select().single();
      
    expect(error).toBeNull();
    
    // Check audit logs (using admin to bypass RLS and verify trigger actually fired)
    const { data: audits, error: auditError } = await admin.from('audit_logs')
      .select('*')
      .eq('entity_type', 'tasks')
      .eq('entity_id', task!.id)
      .eq('action', 'CREATE');
      
    expect(auditError).toBeNull();
    expect(audits?.length).toBeGreaterThan(0);
    
    const audit = audits![0];
    expect(audit.outcome).toBe('SUCCESS');
    expect(audit.actor_type).toBe('USER');
    expect(audit.after_state).toBeDefined();
    expect(audit.after_state.title).toBe(title);
    expect(audit.before_state).toBeNull();
  });

  it('Task update triggers an audit record and captures before/after states', async () => {
    const { data: proj } = await pm.from('projects').select('id').limit(1).single();
    
    // Create a task
    const { data: task } = await pm.from('tasks')
      .insert({ organization_id: ORG, project_id: proj!.id, title: 'Update Me', status: 'BACKLOG' })
      .select().single();
      
    // Update the task
    await pm.from('tasks').update({ status: 'IN_PROGRESS' }).eq('id', task!.id);
    
    // Check audit logs
    const { data: audits } = await admin.from('audit_logs')
      .select('*')
      .eq('entity_type', 'tasks')
      .eq('entity_id', task!.id)
      .eq('action', 'UPDATE')
      .order('occurred_at', { ascending: false });
      
    expect(audits?.length).toBeGreaterThan(0);
    const audit = audits![0];
    
    expect(audit.before_state.status).toBe('BACKLOG');
    expect(audit.after_state.status).toBe('IN_PROGRESS');
  });

  it('Normal users cannot UPDATE or DELETE audit log rows', async () => {
    // Get an existing audit log via admin (so we know it exists)
    const { data: existing } = await admin.from('audit_logs').select('id').limit(1).single();
    expect(existing).toBeDefined();

    // Try to update via PM (who can view but not edit)
    const { error: updateError } = await pm.from('audit_logs')
      .update({ outcome: 'FAILED' })
      .eq('id', existing!.id);
    
    // Supabase RLS silently ignores updates if policy denies them, unless returning is used or it's a strict violation.
    // If we use select(), it should return empty because it didn't update.
    const { data: updated } = await pm.from('audit_logs')
      .update({ outcome: 'FAILED' })
      .eq('id', existing!.id)
      .select();
      
    expect(updated?.length).toBe(0); // Means the policy didn't allow the update

    // Try to delete via PM
    const { data: deleted } = await pm.from('audit_logs')
      .delete()
      .eq('id', existing!.id)
      .select();
      
    expect(deleted?.length).toBe(0);
  });
  
  it('organization_members trigger redacts user_id from payload', async () => {
    // Let's update a member and see the audit log
    const { data: member } = await admin.from('organization_members')
      .select('id')
      .eq('organization_id', ORG)
      .limit(1)
      .single();
      
    // Admin updates a member (say, toggling is_active)
    await admin.from('organization_members')
      .update({ is_active: true })
      .eq('id', member!.id);
      
    // Check audit logs
    const { data: audits } = await admin.from('audit_logs')
      .select('*')
      .eq('entity_type', 'organization_members')
      .eq('entity_id', member!.id)
      .eq('action', 'UPDATE')
      .order('occurred_at', { ascending: false });
      
    expect(audits?.length).toBeGreaterThan(0);
    const audit = audits![0];
    
    expect(audit.before_state.user_id).toBeUndefined();
    expect(audit.after_state.user_id).toBeUndefined();
  });
});
