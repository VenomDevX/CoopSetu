import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CreateProjectInput, UpdateProjectInput,
} from '@/lib/validation/project';
import { z } from 'zod';
import { addProjectMemberSchema, createMilestoneSchema, createRiskSchema } from '@/lib/validation/project';

export async function listProjects(supabase: SupabaseClient, orgId: string, opts?: { includeArchived?: boolean }) {
  let q = supabase
    .from('projects')
    .select('*, project_manager:project_manager_member_id(id), milestones(count), project_risks(count)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (!opts?.includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

/** Epics for a project (for the Create-Task epic picker). RLS scopes visibility. */
export async function listProjectEpics(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('epics')
    .select('id, title, status, priority')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getProject(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, milestones(*), project_risks(*), project_members(*, member:organization_member_id(id, user_id)), project_teams(*, team:team_id(id, name))')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Project not found.');
  return data;
}

export async function listProjectActivity(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('project_activity')
    .select('id, activity_type, entity_type, entity_id, actor_member_id, metadata, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw Errors.internal(error.message);
  return data;
}

async function logActivity(
  supabase: SupabaseClient, projectId: string, type: string, entityType?: string, entityId?: string,
) {
  await supabase.from('project_activity').insert({
    project_id: projectId, activity_type: type, entity_type: entityType, entity_id: entityId,
  });
}

export async function createProject(supabase: SupabaseClient, orgId: string, input: CreateProjectInput) {
  // Insert via SECURITY DEFINER RPC (see migration 0025): a plain PostgREST
  // INSERT...RETURNING is rejected because the RETURNING row is re-checked
  // against projects_select before it is visible to that policy's snapshot.
  const { data, error } = await supabase
    .rpc('create_project', { p_org: orgId, p_payload: input })
    .single<{ id: string; name: string; code: string }>();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('A project with that code already exists.');
    if (error.message?.includes('FORBIDDEN')) throw Errors.forbidden();
    throw Errors.internal(error.message);
  }
  await logActivity(supabase, data.id, 'project.created', 'project', data.id);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'project.created', entityType: 'project',
    entityId: data.id, projectId: data.id, afterState: { name: data.name, code: data.code },
  });
  return data;
}

export async function updateProject(supabase: SupabaseClient, orgId: string, projectId: string, input: UpdateProjectInput) {
  const { data, error } = await supabase
    .from('projects').update(input).eq('id', projectId).eq('organization_id', orgId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden('Cannot update this project.');
  await logActivity(supabase, projectId, 'project.updated', 'project', projectId);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'project.updated', entityType: 'project',
    entityId: projectId, projectId, afterState: input,
  });
  return data;
}

export async function addProjectMember(
  supabase: SupabaseClient, orgId: string, projectId: string,
  input: z.infer<typeof addProjectMemberSchema>,
) {
  const { data, error } = await supabase
    .from('project_members')
    .upsert({ ...input, project_id: projectId }, { onConflict: 'project_id,organization_member_id' })
    .select('*').single();
  if (error) throw Errors.internal(error.message);
  await logActivity(supabase, projectId, 'project.member_added', 'project_member', data.id);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'project.member_added', entityType: 'project_member',
    entityId: data.id, projectId,
  });
  return data;
}

export async function createMilestone(
  supabase: SupabaseClient, orgId: string, projectId: string,
  input: z.infer<typeof createMilestoneSchema>,
) {
  const { data, error } = await supabase
    .from('milestones').insert({ ...input, project_id: projectId }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await logActivity(supabase, projectId, 'milestone.created', 'milestone', data.id);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'milestone.created', entityType: 'milestone',
    entityId: data.id, projectId,
  });
  return data;
}

export async function createRisk(
  supabase: SupabaseClient, orgId: string, projectId: string,
  input: z.infer<typeof createRiskSchema>,
) {
  const { data, error } = await supabase
    .from('project_risks').insert({ ...input, project_id: projectId }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await logActivity(supabase, projectId, 'risk.created', 'project_risk', data.id);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'risk.created', entityType: 'project_risk',
    entityId: data.id, projectId,
  });
  return data;
}
