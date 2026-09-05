import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import type { CreateTeamInput, UpdateTeamInput, CreateDepartmentInput } from '@/lib/validation/team';

export async function listTeams(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('*, ' +
      'team_lead:team_lead_member_id(id, profile:profiles!org_members_profile_fk(full_name)), ' +
      'department:department_id(id, name), ' +
      'team_members(count)')
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

export interface TeamAggregate {
  projects: number;
  openBugs: number;
  velocity: number;
  health: 'Healthy' | 'At Risk' | 'Critical' | null;
  sprintName: string | null;
  sprintProgress: number | null;
}

const EMPTY_AGGREGATE: TeamAggregate = {
  projects: 0, openBugs: 0, velocity: 0, health: null, sprintName: null, sprintProgress: null,
};

/**
 * Real, derived team metrics — replaces what used to be hardcoded on the
 * client (projects: 0, velocity: 0, openBugs: 0, health: always 'Healthy').
 * Bulk (not per-team) so the directory table doesn't N+1: one project_teams
 * query, one bugs query, one sprints query, regardless of team count.
 *
 * health is derived from the real `health` of the team's own ACTIVE linked
 * projects (project_teams -> projects), not invented — worst-of-breed
 * (OFF_TRACK -> Critical, AT_RISK -> At Risk, else Healthy). A team with no
 * active projects gets `health: null` (no data), never a fabricated default.
 * velocity is the most recently COMPLETED sprint's completed_story_points —
 * the standard agile definition, using this schema's own sprint fields
 * (0009_tasks.sql), not an invented number.
 */
export async function getTeamAggregates(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<Record<string, TeamAggregate>> {
  const result: Record<string, TeamAggregate> = {};
  for (const id of teamIds) result[id] = { ...EMPTY_AGGREGATE };
  if (teamIds.length === 0) return result;

  const [{ data: projectTeams }, { data: sprints }] = await Promise.all([
    supabase.from('project_teams')
      .select('team_id, project_id, projects(status, health)')
      .in('team_id', teamIds),
    supabase.from('sprints')
      .select('team_id, name, status, planned_story_points, completed_story_points')
      .in('team_id', teamIds)
      .order('start_date', { ascending: false }),
  ]);

  const projectIdsByTeam: Record<string, Set<string>> = {};
  for (const pt of (projectTeams ?? []) as any[]) {
    const proj = Array.isArray(pt.projects) ? pt.projects[0] : pt.projects;
    if (!proj) continue;
    (projectIdsByTeam[pt.team_id] ??= new Set()).add(pt.project_id);
    if (proj.status !== 'ACTIVE') continue;
    const agg = result[pt.team_id];
    agg.projects += 1;
    if (proj.health === 'OFF_TRACK') agg.health = 'Critical';
    else if (proj.health === 'AT_RISK' && agg.health !== 'Critical') agg.health = 'At Risk';
    else if (!agg.health) agg.health = 'Healthy';
  }

  const allProjectIds = Array.from(new Set(Object.values(projectIdsByTeam).flatMap((s) => Array.from(s))));
  if (allProjectIds.length > 0) {
    const { data: bugs } = await supabase
      .from('bugs')
      .select('project_id')
      .in('project_id', allProjectIds)
      .in('status', ['OPEN', 'IN_PROGRESS']);
    for (const [teamId, projIds] of Object.entries(projectIdsByTeam)) {
      result[teamId].openBugs = (bugs ?? []).filter((b) => projIds.has(b.project_id)).length;
    }
  }

  // sprints is already sorted most-recent-first (globally); the first ACTIVE
  // / first COMPLETED row seen per team is therefore that team's most recent.
  const seenActive = new Set<string>();
  const seenCompleted = new Set<string>();
  for (const s of (sprints ?? []) as any[]) {
    if (!result[s.team_id]) continue;
    if (s.status === 'ACTIVE' && !seenActive.has(s.team_id)) {
      seenActive.add(s.team_id);
      result[s.team_id].sprintName = s.name;
      result[s.team_id].sprintProgress = s.planned_story_points > 0
        ? Math.round((s.completed_story_points / s.planned_story_points) * 100)
        : 0;
    }
    if (s.status === 'COMPLETED' && !seenCompleted.has(s.team_id)) {
      seenCompleted.add(s.team_id);
      result[s.team_id].velocity = s.completed_story_points;
    }
  }

  return result;
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
