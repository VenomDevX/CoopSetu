import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { CLOSED_TASK_STATUSES } from '@/lib/constants/task-statuses';

async function count(
  supabase: SupabaseClient,
  build: (q: any) => any,
  table: string,
): Promise<number> {
  const base = supabase.from(table).select('id', { count: 'exact', head: true });
  const { count: c, error } = (await build(base)) as { count: number | null; error: { message: string } | null };
  if (error) throw Errors.internal(error.message);
  return c ?? 0;
}

const OPEN_STATUSES = `(${CLOSED_TASK_STATUSES.join(',')})`;
const CLOSED_INCIDENT = ['RESOLVED', 'CLOSED'];
const CLOSED_BUG = ['RESOLVED', 'CLOSED', 'WONT_FIX'];

/** A single derived, source-linked signal for the Overview Intelligence Feed. */
export interface OverviewSignal {
  kind: string;
  severity: 'critical' | 'high' | 'medium';
  count: number;
  label: string;
  href: string;
}

export interface PriorityItem {
  identifier: string;
  cls: string;
  project: string;
  state: string;
  owner: string;
  href: string;
}

export async function getOverview(supabase: SupabaseClient, orgId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [
    activeProjects, projectsAtRisk, overdueTasks, openTasks, blockedTasks,
    doneTasks, totalTasks, unreadNotifications,
    pendingApprovals, openIncidents, criticalBugs, openSecurityFindings,
  ] = await Promise.all([
    count(supabase, (q) => q.eq('organization_id', orgId).eq('status', 'ACTIVE').is('archived_at', null), 'projects'),
    count(supabase, (q) => q.eq('organization_id', orgId).in('health', ['AT_RISK', 'OFF_TRACK']).is('archived_at', null), 'projects'),
    count(supabase, (q) => q.eq('organization_id', orgId).lt('due_date', today).not('status', 'in', OPEN_STATUSES).is('archived_at', null), 'tasks'),
    count(supabase, (q) => q.eq('organization_id', orgId).not('status', 'in', OPEN_STATUSES).is('archived_at', null), 'tasks'),
    count(supabase, (q) => q.eq('organization_id', orgId).eq('status', 'BLOCKED').is('archived_at', null), 'tasks'),
    count(supabase, (q) => q.eq('organization_id', orgId).eq('status', 'DONE').is('archived_at', null), 'tasks'),
    count(supabase, (q) => q.eq('organization_id', orgId).is('archived_at', null), 'tasks'),
    count(supabase, (q) => q.is('read_at', null).is('archived_at', null), 'notifications'),
    count(supabase, (q) => q.eq('organization_id', orgId).eq('status', 'PENDING'), 'approval_requests'),
    count(supabase, (q) => q.eq('organization_id', orgId).not('status', 'in', `(${CLOSED_INCIDENT.join(',')})`), 'incidents'),
    count(supabase, (q) => q.eq('organization_id', orgId).eq('severity', 'CRITICAL').not('status', 'in', `(${CLOSED_BUG.join(',')})`), 'bugs'),
    count(supabase, (q) => q.eq('organization_id', orgId).eq('status', 'OPEN'), 'security_findings'),
  ]);

  const completion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // --- Intelligence Feed signals: real, source-linked, only when present. ----
  const signals: OverviewSignal[] = [];
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
  if (openIncidents > 0) signals.push({ kind: 'incident', severity: 'critical', count: openIncidents, label: `${plural(openIncidents, 'active incident')} require attention`, href: '/dashboard/incidents' });
  if (overdueTasks > 0) signals.push({ kind: 'overdue', severity: 'high', count: overdueTasks, label: `${plural(overdueTasks, 'task')} overdue`, href: '/dashboard/tasks' });
  if (blockedTasks > 0) signals.push({ kind: 'blocked', severity: 'high', count: blockedTasks, label: `${plural(blockedTasks, 'task')} blocked`, href: '/dashboard/tasks' });
  if (criticalBugs > 0) signals.push({ kind: 'qa', severity: 'high', count: criticalBugs, label: `${plural(criticalBugs, 'critical bug')} open`, href: '/dashboard/qa-security' });
  if (openSecurityFindings > 0) signals.push({ kind: 'security', severity: 'high', count: openSecurityFindings, label: `${plural(openSecurityFindings, 'open security finding')}`, href: '/dashboard/qa-security' });
  if (pendingApprovals > 0) signals.push({ kind: 'approval', severity: 'medium', count: pendingApprovals, label: `${plural(pendingApprovals, 'approval')} pending`, href: '/dashboard/qa-security' });
  if (projectsAtRisk > 0) signals.push({ kind: 'risk', severity: 'medium', count: projectsAtRisk, label: `${plural(projectsAtRisk, 'project')} flagged at risk`, href: '/dashboard/projects' });

  // --- Priority Overrides: real overdue/blocked tasks + open incidents. ------
  const TASK_COLS =
    'id, task_key, title, status, task_type, due_date, project:project_id(code), assignee:primary_assignee_member_id(profile:profiles!org_members_profile_fk(full_name))';
  const [{ data: blockedRows }, { data: overdueRows }] = await Promise.all([
    supabase.from('tasks').select(TASK_COLS)
      .eq('organization_id', orgId).is('archived_at', null).eq('status', 'BLOCKED').limit(8),
    supabase.from('tasks').select(TASK_COLS)
      .eq('organization_id', orgId).is('archived_at', null)
      .lt('due_date', today).not('status', 'in', OPEN_STATUSES)
      .order('due_date', { ascending: true }).limit(8),
  ]);
  const seen = new Set<string>();
  const priorityTasks = [...(blockedRows ?? []), ...(overdueRows ?? [])]
    .filter((t: any) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .slice(0, 8);

  const { data: priorityIncidents } = await supabase
    .from('incidents')
    .select('id, title, severity, status, commander:incident_commander_member_id(profile:profiles!org_members_profile_fk(full_name))')
    .eq('organization_id', orgId)
    .not('status', 'in', `(${CLOSED_INCIDENT.join(',')})`)
    .order('started_at', { ascending: false })
    .limit(5);

  const name = (v: unknown): string => {
    const m = Array.isArray(v) ? v[0] : v;
    const p = m && (m as { profile?: unknown }).profile;
    const prof = Array.isArray(p) ? p[0] : p;
    return (prof && (prof as { full_name?: string }).full_name) || '—';
  };
  const proj = (v: unknown): string => {
    const m = Array.isArray(v) ? v[0] : v;
    return (m && (m as { code?: string }).code) || '—';
  };

  const priorityItems: PriorityItem[] = [
    ...((priorityTasks ?? []) as any[]).map((t) => ({
      identifier: t.task_key, cls: t.status === 'BLOCKED' ? 'Blocked Task' : 'Overdue Task',
      project: proj(t.project), state: t.status, owner: name(t.assignee), href: '/dashboard/tasks',
    })),
    ...((priorityIncidents ?? []) as any[]).map((i) => ({
      identifier: i.title, cls: `Incident · ${i.severity}`,
      project: '—', state: i.status, owner: name(i.commander), href: '/dashboard/incidents',
    })),
  ];

  // --- Real charts: completed-sprint velocity + open tasks per active project.
  const { data: completedSprints } = await supabase
    .from('sprints')
    .select('name, completed_story_points, end_date')
    .eq('organization_id', orgId).eq('status', 'COMPLETED')
    .order('end_date', { ascending: true }).limit(8);
  const velocity = (completedSprints ?? []).map((s) => ({
    name: s.name, points: Number(s.completed_story_points) || 0,
  }));

  const { data: openByProject } = await supabase
    .from('tasks')
    .select('project:project_id(code)')
    .eq('organization_id', orgId).not('status', 'in', OPEN_STATUSES).is('archived_at', null).limit(2000);
  const loadMap = new Map<string, number>();
  for (const row of (openByProject ?? []) as any[]) {
    const code = proj(row.project);
    if (code !== '—') loadMap.set(code, (loadMap.get(code) ?? 0) + 1);
  }
  const workload = Array.from(loadMap.entries())
    .map(([nameK, open]) => ({ name: nameK, open }))
    .sort((a, b) => b.open - a.open).slice(0, 6);

  // recent activity (cross-project audit log if visible, else recent tasks)
  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('id, task_key, title, status, updated_at, project:project_id(code)')
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(8);

  return {
    metrics: {
      activeProjects, projectsAtRisk, overdueTasks, openTasks, blockedTasks,
      completion, totalTasks, doneTasks, unreadNotifications,
      pendingApprovals, openIncidents, criticalBugs, openSecurityFindings,
    },
    signals,
    priorityItems,
    velocity,
    workload,
    recent: recentTasks ?? [],
  };
}

export async function getProjectAnalytics(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, code, status, health, priority, milestones(count), project_risks(count)')
    .eq('organization_id', orgId).is('archived_at', null);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getTeamAnalytics(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, capacity_hours_per_week, team_members(count)')
    .eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getReleaseAnalytics(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('releases')
    .select('id, name, version, status, project_id, release_approvals(approval_type, status)')
    .eq('organization_id', orgId).order('created_at', { ascending: false });
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getIncidentAnalytics(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('incidents')
    .select('id, title, severity, status, started_at, resolved_at')
    .eq('organization_id', orgId).order('started_at', { ascending: false });
  if (error) throw Errors.internal(error.message);
  return data;
}
