import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function listBugs(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('bugs').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listTestPlans(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('test_plans').select('*, test_cases(count)').eq('organization_id', orgId);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createBug(
  supabase: SupabaseClient, orgId: string, memberId: string,
  input: { project_id: string; title: string; severity?: string; description?: string },
) {
  const { data, error } = await supabase.from('bugs')
    .insert({ ...input, organization_id: orgId, reporter_member_id: memberId }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'bug.created', resourceType: 'bug',
    resourceId: data.id, projectId: input.project_id,
  });
  return data;
}
