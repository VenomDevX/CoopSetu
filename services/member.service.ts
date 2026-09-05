import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';

export async function listMembers(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, employment_status, is_active, department_id, ' +
      'profile:profiles!org_members_profile_fk(full_name, email, job_title, timezone), ' +
      'department:department_id(id, name), ' +
      'manager:manager_id(id, profile:profiles!org_members_profile_fk(full_name)), ' +
      'team_members(team_id, role_in_team, allocation_percent)')
    .eq('organization_id', orgId)
    .eq('is_active', true);
  if (error) throw Errors.internal(error.message);
  return data;
}

export interface MemberAggregate {
  activeTasks: number;
  workload: number;
  recentActivity: { action: string; created_at: string }[];
}

const EMPTY_MEMBER_AGGREGATE: MemberAggregate = { activeTasks: 0, workload: 0, recentActivity: [] };

const CLOSED_TASK_STATUSES = ['DONE', 'CANCELLED'];

/**
 * Real, derived per-member metrics — replaces what used to be hardcoded on
 * the client (activeTasks: 0, workload: 0, recentActivity: '—'). Bulk (not
 * per-member) to avoid N+1 across the employee directory.
 *
 * activeTasks/workload come from task_assignees -> tasks, counting/summing
 * only tasks not yet DONE/CANCELLED and not archived — workload uses
 * tasks.estimated_hours (a real column; earlier planning for this phase
 * assumed no hours model existed on tasks, which direct schema inspection
 * showed was wrong). recentActivity reads audit_logs for that member as
 * actor, most recent first — the only real activity-feed source in this
 * schema (there is no per-member "GitHub handle" or "location" field
 * anywhere, so those stay removed rather than faked).
 */
export async function getMemberAggregates(
  supabase: SupabaseClient,
  memberIds: string[],
): Promise<Record<string, MemberAggregate>> {
  const result: Record<string, MemberAggregate> = {};
  for (const id of memberIds) result[id] = { ...EMPTY_MEMBER_AGGREGATE, recentActivity: [] };
  if (memberIds.length === 0) return result;

  const [{ data: assignments }, { data: activity }] = await Promise.all([
    supabase.from('task_assignees')
      .select('organization_member_id, tasks(status, estimated_hours, archived_at)')
      .in('organization_member_id', memberIds),
    supabase.from('audit_logs')
      // audit_logs' real timestamp column is occurred_at, not created_at —
      // aliased here so the rest of this module and its callers can keep
      // using the more conventional created_at name.
      .select('actor_member_id, action, created_at:occurred_at')
      .in('actor_member_id', memberIds)
      .order('occurred_at', { ascending: false })
      .limit(200),
  ]);

  for (const row of (assignments ?? []) as any[]) {
    const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
    if (!task || task.archived_at || CLOSED_TASK_STATUSES.includes(task.status)) continue;
    const agg = result[row.organization_member_id];
    if (!agg) continue;
    agg.activeTasks += 1;
    agg.workload += Number(task.estimated_hours) || 0;
  }

  for (const row of (activity ?? []) as any[]) {
    const agg = result[row.actor_member_id];
    if (!agg || agg.recentActivity.length >= 5) continue;
    agg.recentActivity.push({ action: row.action, created_at: row.created_at });
  }

  return result;
}

export interface AssignableMember {
  member_id: string;
  full_name: string;
  job_title: string | null;
  team_name: string | null;
  role: string | null;
  capacity_percent: number | null;
}

/**
 * Members eligible to be assigned a task in a given project. Scope (per spec):
 *  - direct project members (`project_members`), OR
 *  - members of any team linked to the project (`project_teams` → `team_members`)
 * Filtered to: active org membership, not suspended, and excludes pure
 * Client Viewers (not assignable to engineering work). Cross-org isolation is
 * guaranteed by RLS + the explicit `organization_id` filter; the caller is also
 * permission-checked at the route level.
 */
export async function getAssignableMembers(
  supabase: SupabaseClient, orgId: string, projectId: string,
): Promise<AssignableMember[]> {
  const [{ data: directRows }, { data: teamRows }] = await Promise.all([
    supabase.from('project_members').select('organization_member_id').eq('project_id', projectId),
    supabase.from('project_teams').select('team_id').eq('project_id', projectId),
  ]);

  const teamIds = (teamRows ?? []).map((t) => t.team_id);
  let teamMemberIds: string[] = [];
  if (teamIds.length) {
    const { data: tm } = await supabase
      .from('team_members').select('organization_member_id').in('team_id', teamIds);
    teamMemberIds = (tm ?? []).map((r) => r.organization_member_id);
  }

  const ids = Array.from(new Set([
    ...(directRows ?? []).map((r) => r.organization_member_id),
    ...teamMemberIds,
  ]));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('organization_members')
    .select(
      'id, employment_status, is_active, ' +
      'profile:profiles!org_members_profile_fk(full_name, email, job_title), ' +
      'team_members(allocation_percent, role_in_team, team:team_id(name)), ' +
      'member_roles!organization_member_id(role:roles(code))',
    )
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .in('id', ids);
  if (error) throw Errors.internal(error.message);

  type Row = {
    id: string;
    employment_status: string | null;
    profile: { full_name: string | null; email: string | null; job_title: string | null }
      | { full_name: string | null; email: string | null; job_title: string | null }[] | null;
    team_members: { allocation_percent: number | null; role_in_team: string | null;
      team: { name: string } | { name: string }[] | null }[] | null;
    member_roles: { role: { code: string } | { code: string }[] | null }[] | null;
  };

  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  return ((data as unknown as Row[]) ?? [])
    .filter((m) => m.employment_status !== 'SUSPENDED')
    .map((m) => {
      const profile = one(m.profile);
      const roles = (m.member_roles ?? [])
        .map((r) => one(r.role)?.code)
        .filter(Boolean) as string[];
      const tmRow = (m.team_members ?? [])[0];
      const team = tmRow ? one(tmRow.team) : null;
      return {
        member_id: m.id,
        full_name: profile?.full_name ?? profile?.email ?? 'Member',
        job_title: profile?.job_title ?? null,
        team_name: team?.name ?? null,
        role: roles.find((r) => r !== 'CLIENT_VIEWER') ?? null,
        capacity_percent: tmRow?.allocation_percent ?? null,
        _roles: roles,
      };
    })
    // Exclude Client Viewers from engineering task assignment.
    .filter((m) => !m._roles.includes('CLIENT_VIEWER'))
    .map(({ _roles, ...rest }) => { void _roles; return rest; })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Throw unless `memberId` is a valid assignee for `projectId`. Backend-enforced
 * so a forged frontend member ID cannot assign work to an out-of-scope,
 * suspended, cross-org, or Client-Viewer member. Mirrors getAssignableMembers'
 * eligibility rules exactly (single source of truth).
 */
export async function assertAssignable(
  supabase: SupabaseClient, orgId: string, projectId: string | null | undefined, memberId: string,
): Promise<void> {
  if (!projectId) throw Errors.validation('A project is required to assign a task.');
  const eligible = await getAssignableMembers(supabase, orgId, projectId);
  if (!eligible.some((m) => m.member_id === memberId)) {
    throw Errors.validation('Selected assignee is not eligible for this project.');
  }
}
