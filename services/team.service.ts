import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import type { CreateTeamInput, UpdateTeamInput, CreateDepartmentInput } from '@/lib/validation/team';

export async function listTeams(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('*, team_members(count)')
    .eq('organization_id', orgId)
    .order('name');
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createTeam(supabase: SupabaseClient, orgId: string, input: CreateTeamInput) {
  const { data, error } = await supabase
    .from('teams')
    .insert({ ...input, organization_id: orgId })
    .select('*')
    .single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'team.created', entityType: 'team',
    entityId: data.id, afterState: { name: data.name },
  });
  return data;
}

export async function updateTeam(supabase: SupabaseClient, orgId: string, teamId: string, input: UpdateTeamInput) {
  const { data, error } = await supabase
    .from('teams').update(input).eq('id', teamId).eq('organization_id', orgId)
    .select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Team not found.');
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'team.updated', entityType: 'team',
    entityId: teamId, afterState: input,
  });
  return data;
}

export async function listDepartments(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('departments').select('*').eq('organization_id', orgId).order('name');
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createDepartment(supabase: SupabaseClient, orgId: string, input: CreateDepartmentInput) {
  const { data, error } = await supabase
    .from('departments').insert({ ...input, organization_id: orgId }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'department.created', entityType: 'department',
    entityId: data.id, afterState: { name: data.name },
  });
  return data;
}
