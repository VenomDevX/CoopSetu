import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { CLOSED_TASK_STATUSES } from '@/lib/constants/task-statuses';

const MY_TASK_SELECT =
  'id, task_key, title, status, priority, task_type, due_date, story_points, sprint_id, ' +
  'project:project_id(id, code, name)';

const isClosed = (s: string) => CLOSED_TASK_STATUSES.includes(s as never);

function fullName(v: unknown): string {
  const m = Array.isArray(v) ? v[0] : v;
  const p = m && (m as { profile?: unknown }).profile;
  const prof = Array.isArray(p) ? p[0] : p;
  return (prof && (prof as { full_name?: string }).full_name) || 'Member';
}

/**
 * Everything the My Work page renders, scoped to the current member and derived
 * server-side so the KPI totals, the task list, and the "Showing X–Y of Z"
 * counter are always computed from the same source of truth.
 */
export async function getMyWork(
  supabase: SupabaseClient, orgId: string, memberId: string,
) {
  void memberId;
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // 1. Tasks visible to this member under task RLS. Private tasks only appear
  //    when the DB helper grants direct, explicit, manager, or admin access.
  const { data: taskRows, error } = await supabase
    .from('tasks')
    .select(MY_TASK_SELECT)
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw Errors.internal(error.message);
  const tasks = (taskRows ?? []) as any[];

  const open = tasks.filter((t) => !isClosed(t.status));
  const kpis = {
    active: open.length,
    dueToday: open.filter((t) => t.due_date === today).length,
    overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
    points: tasks.reduce((s, t) => s + (Number(t.story_points) || 0), 0),
    donePoints: tasks.filter((t) => t.status === 'DONE').reduce((s, t) => s + (Number(t.story_points) || 0), 0),
    total: tasks.length,
  };

  // 2. Blockers + upcoming, derived from the same set.
  const blockers = tasks.filter((t) => t.status === 'BLOCKED');
  const upcoming = open
    .filter((t) => t.due_date && t.due_date >= today && t.due_date <= in7)
    .slice(0, 6);

  // 3. Recent activity on the member's tasks (real task_activity rows).
  const taskIds = tasks.map((t) => t.id);
  let recentActivity: { actor: string; activity: string; taskKey: string; at: string }[] = [];
  if (taskIds.length) {
    const keyById = new Map(tasks.map((t) => [t.id, t.task_key]));
    const { data: acts } = await supabase
      .from('task_activity')
      .select('task_id, activity_type, created_at, actor:actor_member_id(profile:profiles!org_members_profile_fk(full_name))')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false })
      .limit(8);
    recentActivity = ((acts ?? []) as any[]).map((a) => ({
      actor: fullName(a.actor),
      activity: String(a.activity_type ?? 'updated').replace(/_/g, ' '),
      taskKey: keyById.get(a.task_id) ?? '',
      at: a.created_at,
    }));
  }

  // 4. The member's most-active sprint (the active sprint holding the most of
  //    their open tasks), with real planned/completed points for that sprint.
  let sprint: null | {
    name: string; goal: string | null; plannedPoints: number; completedPoints: number;
    myOpen: number; myPoints: number;
  } = null;
  const sprintCounts = new Map<string, number>();
  for (const t of open) if (t.sprint_id) sprintCounts.set(t.sprint_id, (sprintCounts.get(t.sprint_id) ?? 0) + 1);
  const topSprintId = [...sprintCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topSprintId) {
    const { data: sp } = await supabase
      .from('sprints')
      .select('name, goal, status, planned_story_points, completed_story_points')
      .eq('id', topSprintId).maybeSingle();
    if (sp) {
      const mine = tasks.filter((t) => t.sprint_id === topSprintId);
      sprint = {
        name: sp.name, goal: sp.goal,
        plannedPoints: Number(sp.planned_story_points) || 0,
        completedPoints: Number(sp.completed_story_points) || 0,
        myOpen: mine.filter((t) => !isClosed(t.status)).length,
        myPoints: mine.reduce((s, t) => s + (Number(t.story_points) || 0), 0),
      };
    }
  }

  // 5. Pending approvals visible to the member (RLS-scoped to their workspace).
  const { data: apprRows } = await supabase
    .from('approval_requests')
    .select('id, approval_type, status, due_date, requester:requested_by_member_id(profile:profiles!org_members_profile_fk(full_name)), project:project_id(code)')
    .eq('organization_id', orgId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(6);
  const approvals = ((apprRows ?? []) as any[]).map((a) => ({
    id: a.id, type: a.approval_type,
    requester: fullName(a.requester),
    project: (Array.isArray(a.project) ? a.project[0] : a.project)?.code ?? '—',
    dueDate: a.due_date,
  }));

  return {
    tasks: tasks.map((t) => ({
      id: t.id, task_key: t.task_key, title: t.title, status: t.status,
      priority: t.priority, task_type: t.task_type, due_date: t.due_date,
      story_points: t.story_points,
      project_code: (Array.isArray(t.project) ? t.project[0] : t.project)?.code ?? '—',
    })),
    kpis, blockers, upcoming, recentActivity, sprint, approvals,
  };
}
