import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { CLOSED_TASK_STATUSES } from '@/lib/constants/task-statuses';

export interface DashboardOverviewParams {
  orgId: string;
  memberId: string;
  persona: 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MANAGER' | 'EMPLOYEE';
}

const OPEN_STATUSES = `(${CLOSED_TASK_STATUSES.join(',')})`;
const CLOSED_INCIDENT = ['RESOLVED', 'CLOSED'];
const CLOSED_BUG = ['RESOLVED', 'CLOSED', 'WONT_FIX'];

/**
 * Normalizes an Attention Queue item.
 */
export interface AttentionQueueItem {
  id: string;
  entityType: 'task' | 'bug' | 'incident' | 'approval' | 'security_review';
  identifier: string;
  title: string;
  projectName: string | null;
  priorityOrSeverity: string;
  status: string;
  ownerName: string | null;
  dueDate: string | null;
  href: string;
}

export interface ActivityFeedItem {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  targetName: string;
  timestamp: string;
  href: string;
}

/**
 * Returns role-aware dashboard overview data using explicit access filtering.
 * RLS remains the final layer of protection, but explicit scopes ensure truthful counts.
 */
export async function getRoleAwareOverview(
  supabase: SupabaseClient,
  params: DashboardOverviewParams
) {
  const { orgId, memberId, persona } = params;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Resolve Explicit Project Scope
  let projectFilter = '';
  if (persona === 'PROJECT_MANAGER') {
    // Managed or explicitly accessible
    const { data: explicitProjects } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('organization_member_id', memberId);
    const explicitIds = (explicitProjects || []).map(p => p.project_id);

    const { data: managedProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('project_manager_member_id', memberId);
    const managedIds = (managedProjects || []).map(p => p.id);

    const validProjectIds = Array.from(new Set([...explicitIds, ...managedIds]));
    if (validProjectIds.length === 0) {
      projectFilter = 'id.in.()'; // Force empty
    } else {
      projectFilter = `id.in.(${validProjectIds.join(',')})`;
    }
  } else if (persona === 'TEAM_MANAGER') {
    // Teams managed by this member
    const { data: managedTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('team_lead_member_id', memberId);
    const teamIds = (managedTeams || []).map(t => t.id);

    if (teamIds.length === 0) {
      projectFilter = 'id.in.()';
    } else {
      // Projects connected to those teams
      const { data: teamProjects } = await supabase
        .from('project_teams')
        .select('project_id')
        .in('team_id', teamIds);
      const validProjectIds = Array.from(new Set((teamProjects || []).map(tp => tp.project_id)));
      if (validProjectIds.length === 0) {
        projectFilter = 'id.in.()';
      } else {
        projectFilter = `id.in.(${validProjectIds.join(',')})`;
      }
    }
  }

  // 2. Resolve Task Scope (For TM, PM, Admin)
  let taskFilter = '';
  if (persona === 'TEAM_MANAGER') {
    // Include only tasks for the managed teams.
    const { data: managedTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('team_lead_member_id', memberId);
    const teamIds = (managedTeams || []).map(t => t.id);
    if (teamIds.length === 0) {
      taskFilter = 'id.in.()';
    } else {
      taskFilter = `team_id.in.(${teamIds.join(',')})`;
    }
  } else if (persona === 'PROJECT_MANAGER' && projectFilter !== 'id.in.()') {
     // For PM, taskFilter can just rely on the project filter
     taskFilter = projectFilter.replace('id.in', 'project_id.in');
  }

  // 3. Helper to count securely
  async function countScope(table: string, baseFilter: (q: any) => any, applyProjectScope = false, applyTaskScope = false): Promise<number> {
    let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
    q = baseFilter(q);
    
    if (applyProjectScope && projectFilter && projectFilter !== 'id.in.()') {
      const field = table === 'projects' ? 'id' : 'project_id';
      q = q.in(field, projectFilter.match(/\(([^)]+)\)/)?.[1]?.split(',') || []);
    } else if (applyProjectScope && projectFilter === 'id.in.()') {
      return 0;
    }

    if (applyTaskScope && taskFilter && taskFilter !== 'id.in.()') {
      const fieldMatch = taskFilter.match(/^([^.]+)\.in\.\(([^)]*)\)$/);
      if (fieldMatch && table === 'tasks') {
        q = q.in(fieldMatch[1], fieldMatch[2].split(',').filter(Boolean));
      }
    } else if (applyTaskScope && taskFilter === 'id.in.()') {
      return 0;
    }

    const { count: c, error } = await q;
    if (error) console.error(`[Dashboard] Count error on ${table}:`, error);
    return c ?? 0;
  }

  // 4. Fetch KPIs based on Persona
  let activeProjects = 0, projectsAtRisk = 0, blockedTasks = 0, overdueTasks = 0, pendingApprovals = 0;
  let criticalBugs = 0, openIncidents = 0, openSecurityFindings = 0;
  let myActiveTasks = 0, myBlockers = 0, dueThisWeek = 0, pendingReviews = 0;

  if (persona === 'ADMIN' || persona === 'PROJECT_MANAGER' || persona === 'TEAM_MANAGER') {
    [
      activeProjects, projectsAtRisk, blockedTasks, overdueTasks, 
      pendingApprovals, criticalBugs, openIncidents, openSecurityFindings
    ] = await Promise.all([
      countScope('projects', q => q.eq('status', 'ACTIVE').is('archived_at', null), true),
      countScope('projects', q => q.in('health', ['AT_RISK', 'OFF_TRACK']).is('archived_at', null), true),
      countScope('tasks', q => q.eq('status', 'BLOCKED').is('archived_at', null), persona === 'PROJECT_MANAGER', persona === 'TEAM_MANAGER'),
      countScope('tasks', q => q.lt('due_date', today).not('status', 'in', OPEN_STATUSES).is('archived_at', null), persona === 'PROJECT_MANAGER', persona === 'TEAM_MANAGER'),
      countScope('approval_requests', q => q.eq('status', 'PENDING'), persona === 'PROJECT_MANAGER'),
      countScope('bugs', q => q.eq('severity', 'CRITICAL').not('status', 'in', `(${CLOSED_BUG.join(',')})`), persona === 'PROJECT_MANAGER'),
      countScope('incidents', q => q.not('status', 'in', `(${CLOSED_INCIDENT.join(',')})`)),
      countScope('security_findings', q => q.eq('status', 'OPEN'), persona === 'PROJECT_MANAGER')
    ]);
  }

  if (persona === 'EMPLOYEE') {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().slice(0, 10);

    const baseMyTasks = (q: any) => q.or(`primary_assignee_member_id.eq.${memberId},reviewer_member_id.eq.${memberId}`).is('archived_at', null);

    [myActiveTasks, myBlockers, dueThisWeek, pendingReviews] = await Promise.all([
      countScope('tasks', q => baseMyTasks(q).not('status', 'in', OPEN_STATUSES)),
      countScope('tasks', q => baseMyTasks(q).eq('status', 'BLOCKED')),
      countScope('tasks', q => baseMyTasks(q).not('status', 'in', OPEN_STATUSES).lte('due_date', nextWeekStr).gte('due_date', today)),
      countScope('tasks', q => q.eq('reviewer_member_id', memberId).not('status', 'in', OPEN_STATUSES))
    ]);
  }

  // 5. Signals
  const signals: any[] = [];
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
  
  if (persona !== 'EMPLOYEE') {
    if (openIncidents > 0) signals.push({ kind: 'incident', severity: 'critical', count: openIncidents, label: `${plural(openIncidents, 'active incident')} require attention`, href: '/dashboard/incidents' });
    if (overdueTasks > 0) signals.push({ kind: 'overdue', severity: 'high', count: overdueTasks, label: `${plural(overdueTasks, 'task')} overdue`, href: '/dashboard/tasks' });
    if (blockedTasks > 0) signals.push({ kind: 'blocked', severity: 'high', count: blockedTasks, label: `${plural(blockedTasks, 'task')} blocked`, href: '/dashboard/tasks' });
    if (criticalBugs > 0) signals.push({ kind: 'qa', severity: 'high', count: criticalBugs, label: `${plural(criticalBugs, 'critical bug')} open`, href: '/dashboard/qa-security' });
    if (openSecurityFindings > 0) signals.push({ kind: 'security', severity: 'high', count: openSecurityFindings, label: `${plural(openSecurityFindings, 'open security finding')}`, href: '/dashboard/qa-security' });
    if (pendingApprovals > 0) signals.push({ kind: 'approval', severity: 'medium', count: pendingApprovals, label: `${plural(pendingApprovals, 'approval')} pending`, href: '/dashboard/qa-security' });
    if (projectsAtRisk > 0) signals.push({ kind: 'risk', severity: 'medium', count: projectsAtRisk, label: `${plural(projectsAtRisk, 'project')} flagged at risk`, href: '/dashboard/projects' });
  } else {
    if (myBlockers > 0) signals.push({ kind: 'blocked', severity: 'high', count: myBlockers, label: `You have ${plural(myBlockers, 'blocked task')}`, href: '/dashboard/my-work' });
    if (dueThisWeek > 0) signals.push({ kind: 'overdue', severity: 'high', count: dueThisWeek, label: `${plural(dueThisWeek, 'task')} due this week`, href: '/dashboard/my-work' });
  }

  // 6. Attention Queue (Normalized)
  const attentionQueue: AttentionQueueItem[] = [];
  
  const name = (v: unknown): string => {
    const m = Array.isArray(v) ? v[0] : v;
    const p = m && (m as { profile?: unknown }).profile;
    const prof = Array.isArray(p) ? p[0] : p;
    return (prof && (prof as { full_name?: string }).full_name) || 'Unassigned';
  };
  const projCode = (v: unknown): string => {
    const m = Array.isArray(v) ? v[0] : v;
    return (m && (m as { code?: string }).code) || null;
  };

  const fetchTasksForQueue = async (statusFilter: string, limit: number) => {
    let q = supabase.from('tasks')
      .select('id, task_key, title, status, priority, due_date, project:project_id(code), assignee:primary_assignee_member_id(profile:profiles!org_members_profile_fk(full_name))')
      .eq('organization_id', orgId)
      .is('archived_at', null)
      .limit(limit);
      
    if (statusFilter === 'BLOCKED') {
      q = q.eq('status', 'BLOCKED');
    } else if (statusFilter === 'OVERDUE') {
      q = q.lt('due_date', today).not('status', 'in', OPEN_STATUSES).order('due_date', { ascending: true });
    }

    if (persona === 'PROJECT_MANAGER' && projectFilter) {
      if (projectFilter === 'id.in.()') return [];
      q = q.in('project_id', projectFilter.match(/\(([^)]+)\)/)?.[1]?.split(',') || []);
    } else if (persona === 'TEAM_MANAGER' && taskFilter) {
      if (taskFilter === 'id.in.()') return [];
      const fieldMatch = taskFilter.match(/^([^.]+)\.in\.\(([^)]*)\)$/);
      if (fieldMatch) q = q.in(fieldMatch[1], fieldMatch[2].split(',').filter(Boolean));
    } else if (persona === 'EMPLOYEE') {
      q = q.or(`primary_assignee_member_id.eq.${memberId},reviewer_member_id.eq.${memberId}`);
    }

    const { data } = await q;
    return (data || []).map((t: any) => ({
      id: t.id,
      entityType: 'task' as const,
      identifier: t.task_key,
      title: t.title,
      projectName: projCode(t.project),
      priorityOrSeverity: t.priority,
      status: t.status,
      ownerName: name(t.assignee),
      dueDate: t.due_date,
      href: '/dashboard/tasks'
    }));
  };

  const [bqTasks, oqTasks] = await Promise.all([
    fetchTasksForQueue('BLOCKED', 5),
    fetchTasksForQueue('OVERDUE', 5)
  ]);
  attentionQueue.push(...bqTasks, ...oqTasks);

  if (persona !== 'EMPLOYEE') {
    const { data: iqData } = await supabase.from('incidents')
      .select('id, title, severity, status, commander:incident_commander_member_id(profile:profiles!org_members_profile_fk(full_name))')
      .eq('organization_id', orgId)
      .not('status', 'in', `(${CLOSED_INCIDENT.join(',')})`)
      .limit(3);
    
    (iqData || []).forEach((i: any) => {
      attentionQueue.push({
        id: i.id, entityType: 'incident', identifier: i.id.substring(0,8).toUpperCase(),
        title: i.title, projectName: null, priorityOrSeverity: i.severity,
        status: i.status, ownerName: name(i.commander), dueDate: null, href: '/dashboard/incidents'
      });
    });
  }

  // 7. Workload & Velocity (Charts)
  const velocity: { name: string; points: number }[] = [];
  const workload: { name: string; open: number }[] = [];
  
  if (persona !== 'EMPLOYEE') {
    const { data: sprints } = await supabase.from('sprints')
      .select('name, completed_story_points')
      .eq('organization_id', orgId).eq('status', 'COMPLETED')
      .order('end_date', { ascending: true }).limit(8);
    (sprints || []).forEach(s => velocity.push({ name: s.name, points: Number(s.completed_story_points) || 0 }));

    let qWorkload = supabase.from('tasks')
      .select('project:project_id(code)')
      .eq('organization_id', orgId).not('status', 'in', OPEN_STATUSES).is('archived_at', null).limit(1000);
      
    if (persona === 'PROJECT_MANAGER' && projectFilter && projectFilter !== 'id.in.()') {
      qWorkload = qWorkload.in('project_id', projectFilter.match(/\(([^)]+)\)/)?.[1]?.split(',') || []);
    } else if (persona === 'TEAM_MANAGER' && taskFilter && taskFilter !== 'id.in.()') {
      const fieldMatch = taskFilter.match(/^([^.]+)\.in\.\(([^)]*)\)$/);
      if (fieldMatch) qWorkload = qWorkload.in(fieldMatch[1], fieldMatch[2].split(',').filter(Boolean));
    }

    const { data: wlData } = projectFilter === 'id.in.()' || taskFilter === 'id.in.()' ? { data: [] } : await qWorkload;
    const loadMap = new Map<string, number>();
    for (const row of (wlData || [])) {
      const code = projCode((row as any).project);
      if (code && code !== '—') loadMap.set(code, (loadMap.get(code) ?? 0) + 1);
    }
    Array.from(loadMap.entries()).sort((a,b) => b[1] - a[1]).slice(0,6).forEach(([n, o]) => workload.push({ name: n, open: o }));
  }

  // 8. Upcoming Deadlines
  let deadlinesQ = supabase.from('tasks')
    .select('id, title, due_date, status, task_key')
    .eq('organization_id', orgId).not('status', 'in', OPEN_STATUSES).is('archived_at', null)
    .gte('due_date', today).order('due_date', { ascending: true }).limit(5);

  if (persona === 'EMPLOYEE') {
    deadlinesQ = deadlinesQ.or(`primary_assignee_member_id.eq.${memberId},reviewer_member_id.eq.${memberId}`);
  } else if (persona === 'PROJECT_MANAGER' && projectFilter && projectFilter !== 'id.in.()') {
    deadlinesQ = deadlinesQ.in('project_id', projectFilter.match(/\(([^)]+)\)/)?.[1]?.split(',') || []);
  } else if (persona === 'TEAM_MANAGER' && taskFilter && taskFilter !== 'id.in.()') {
    const fm = taskFilter.match(/^([^.]+)\.in\.\(([^)]*)\)$/);
    if (fm) deadlinesQ = deadlinesQ.in(fm[1], fm[2].split(',').filter(Boolean));
  }
  const { data: upcomingDeadlines } = projectFilter === 'id.in.()' || taskFilter === 'id.in.()' ? { data: [] } : await deadlinesQ;

  // 9. Normalized Activity Feed
  let activityQ = supabase.from('task_activity')
    .select('id, activity_type, created_at, task:task_id(task_key, title, project_id, team_id), actor:actor_member_id(profile:profiles!org_members_profile_fk(full_name))')
    .order('created_at', { ascending: false }).limit(20);
    
  const { data: actData } = await activityQ;
  const recentActivity: ActivityFeedItem[] = [];
  (actData || []).forEach((a: any) => {
    if (persona === 'PROJECT_MANAGER' && projectFilter !== 'id.in.()') {
       const pId = a.task?.project_id;
       const allowed = projectFilter.match(/\(([^)]+)\)/)?.[1]?.split(',') || [];
       if (!allowed.includes(pId)) return;
    } else if (persona === 'TEAM_MANAGER' && taskFilter !== 'id.in.()') {
       const tId = a.task?.team_id;
       const fm = taskFilter.match(/^([^.]+)\.in\.\(([^)]*)\)$/);
       if (fm && !fm[2].split(',').filter(Boolean).includes(tId)) return;
    }

    recentActivity.push({
      id: a.id,
      actor: name(a.actor),
      action: a.activity_type.replace(/_/g, ' ').toLowerCase(),
      entityType: 'Task',
      entityId: a.task?.task_key || 'Unknown',
      targetName: a.task?.title || 'Unknown',
      timestamp: a.created_at,
      href: '/dashboard/tasks'
    });
  });

  return {
    metrics: {
      activeProjects, projectsAtRisk, blockedTasks, overdueTasks,
      pendingApprovals, criticalBugs, openIncidents, openSecurityFindings,
      myActiveTasks, myBlockers, dueThisWeek, pendingReviews
    },
    signals,
    attentionQueue,
    velocity,
    workload,
    upcomingDeadlines: upcomingDeadlines || [],
    recentActivity: recentActivity.slice(0, 8)
  };
}
