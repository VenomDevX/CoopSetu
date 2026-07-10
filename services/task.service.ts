import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { assertAssignable } from '@/services/member.service';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validation/task';
import type { TaskAssignmentType } from '@/lib/constants/task-statuses';
import { cache } from '@/lib/cache/cache';

type TaskRow = Record<string, any>;

/**
 * Defense-in-depth: `project_id`/`epic_id`/`sprint_id` are client-supplied
 * UUIDs. RLS restricts what a member can *select*, but an INSERT/UPDATE FK
 * only requires the referenced row to exist somewhere — not that it belongs
 * to the caller's org. Without this, an org member could link a task to
 * another organization's epic/sprint (or create it under a foreign
 * project_id) by guessing/leaking a UUID. Verify each reference resolves
 * inside orgId (and, for epic/sprint, inside the task's own project) before
 * writing.
 */
async function assertOrgScopedTaskRefs(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string | null | undefined,
  epicId: string | null | undefined,
  sprintId: string | null | undefined,
): Promise<void> {
  if (projectId) {
    const { data } = await supabase.from('projects').select('id').eq('id', projectId).eq('organization_id', orgId).maybeSingle();
    if (!data) throw Errors.validation('Selected project does not belong to this organization.');
  }
  if (epicId) {
    let q = supabase.from('epics').select('id').eq('id', epicId).eq('organization_id', orgId);
    if (projectId) q = q.eq('project_id', projectId);
    const { data } = await q.maybeSingle();
    if (!data) throw Errors.validation('Selected epic does not belong to this project.');
  }
  if (sprintId) {
    let q = supabase.from('sprints').select('id').eq('id', sprintId).eq('organization_id', orgId);
    if (projectId) q = q.eq('project_id', projectId);
    const { data } = await q.maybeSingle();
    if (!data) throw Errors.validation('Selected sprint does not belong to this project.');
  }
}

const TASK_SELECT =
  '*, assignee:primary_assignee_member_id(id, user_id, profile:profiles!org_members_profile_fk(full_name, email, job_title)), ' +
  'task_assignees(id, organization_member_id, assignment_role, assignment_type, assigned_at, assigned_by, assigned_by_member_id, removed_at, removed_by_member_id, created_at, updated_at, ' +
  'assigned_member:organization_member_id(id, user_id, profile:profiles!org_members_profile_fk(full_name, email, job_title)), ' +
  'assigned_by_member:assigned_by_member_id(id, user_id, profile:profiles!org_members_profile_fk(full_name, email)), ' +
  'removed_by_member:removed_by_member_id(id, user_id, profile:profiles!org_members_profile_fk(full_name, email))), ' +
  'task_visibility_members(id, member_id, access_type, revoked_at), project:project_id(id, code, name)';

export interface TaskListFilters {
  projectId?: string;
  status?: string;
  assigneeMemberId?: string;
  sprintId?: string;
  mine?: boolean;
}

export async function listTasks(
  supabase: SupabaseClient, orgId: string, filters: TaskListFilters, currentMemberId: string,
) {
  let q = supabase.from('tasks').select(TASK_SELECT).eq('organization_id', orgId).is('archived_at', null);
  if (filters.projectId) q = q.eq('project_id', filters.projectId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.sprintId) q = q.eq('sprint_id', filters.sprintId);
  if (filters.assigneeMemberId || filters.mine) {
    const memberId = filters.assigneeMemberId ?? currentMemberId;
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('organization_member_id', memberId)
      .is('removed_at', null)
      .limit(1000);
    if (assignmentError) throw Errors.internal(assignmentError.message);
    const taskIds = [...new Set((assignmentRows ?? []).map((row) => row.task_id as string))];
    const clauses = [
      `primary_assignee_member_id.eq.${memberId}`,
      `reporter_member_id.eq.${memberId}`,
      ...(taskIds.length ? [`id.in.(${taskIds.join(',')})`] : []),
    ];
    q = q.or(clauses.join(','));
  }
  q = q.order('position', { ascending: true }).limit(500);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getTask(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`${TASK_SELECT}, task_activity(*), task_comments(*, author:author_member_id(id, user_id))`)
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden('You do not have permission to view this task.');
  return data;
}

export async function createTask(
  supabase: SupabaseClient, orgId: string, reporterMemberId: string, input: CreateTaskInput,
): Promise<TaskRow> {
  await assertOrgScopedTaskRefs(supabase, orgId, input.project_id, input.epic_id, input.sprint_id);

  // Never trust the frontend assignee: verify eligibility for the project.
  if (input.primary_assignee_member_id) {
    await assertAssignable(supabase, orgId, input.project_id, input.primary_assignee_member_id);
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...input, organization_id: orgId, reporter_member_id: reporterMemberId })
    .select(TASK_SELECT)
    .single();
  if (error) throw Errors.internal(error.message);
  const task = data as TaskRow;

  // mirror primary assignee into task_assignees (fires the notification trigger)
  if (input.primary_assignee_member_id) {
    await supabase.from('task_assignees').insert({
      task_id: task.id,
      organization_member_id: input.primary_assignee_member_id,
      assignment_type: 'PRIMARY',
      assignment_role: 'PRIMARY',
      assigned_by_member_id: reporterMemberId,
      assigned_by: reporterMemberId,
    }).then(() => {}, () => {});
  }

  await supabase.from('task_activity').insert({
    task_id: task.id,
    actor_member_id: reporterMemberId,
    activity_type: 'TASK_CREATED',
    new_value: { title: task.title, task_key: task.task_key },
  }).then(() => {}, () => {});

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.created', entityType: 'task',
    entityId: task.id, projectId: input.project_id, afterState: { title: task.title, key: task.task_key },
  });

  // Invalidate cache version scopes
  await cache.incrementCacheVersion(`cache_versions.dashboard_org_${orgId}`);
  if (input.project_id) {
    await cache.incrementCacheVersion(`cache_versions.project_scope_${orgId}`);
  }
  await cache.incrementCacheVersion(`cache_versions.member_access_${orgId}_${reporterMemberId}`);
  if (input.primary_assignee_member_id && input.primary_assignee_member_id !== reporterMemberId) {
    await cache.incrementCacheVersion(`cache_versions.member_access_${orgId}_${input.primary_assignee_member_id}`);
  }

  return task;
}

export async function updateTask(
  supabase: SupabaseClient, orgId: string, taskId: string, input: UpdateTaskInput, actorMemberId: string,
): Promise<TaskRow> {
  const { data: before, error: beforeError } = await supabase
    .from('tasks')
    .select('status, primary_assignee_member_id, project_id')
    .eq('id', taskId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (beforeError) throw Errors.internal(beforeError.message);
  if (!before) throw Errors.forbidden('You cannot edit this task.');

  // Validate a (changed) assignee against the task's project before writing.
  if (
    input.primary_assignee_member_id &&
    input.primary_assignee_member_id !== before?.primary_assignee_member_id
  ) {
    await assertAssignable(supabase, orgId, before?.project_id, input.primary_assignee_member_id);
  }

  if (input.epic_id || input.sprint_id) {
    await assertOrgScopedTaskRefs(supabase, orgId, before?.project_id, input.epic_id, input.sprint_id);
  }

  const { data, error } = await supabase
    .from('tasks').update(input).eq('id', taskId).eq('organization_id', orgId).select(TASK_SELECT).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden('You cannot edit this task.');
  const task = data as TaskRow;

  // Preserve assignment history: close the old primary row and create/promote
  // the new active primary row instead of overwriting prior assignments.
  if (
    Object.prototype.hasOwnProperty.call(input, 'primary_assignee_member_id') &&
    input.primary_assignee_member_id !== before.primary_assignee_member_id
  ) {
    const now = new Date().toISOString();
    if (before.primary_assignee_member_id) {
      await supabase
        .from('task_assignees')
        .update({ removed_at: now, removed_by_member_id: actorMemberId })
        .eq('task_id', taskId)
        .eq('organization_member_id', before.primary_assignee_member_id)
        .eq('assignment_type', 'PRIMARY')
        .is('removed_at', null)
        .then(() => {}, () => {});
    }

    if (input.primary_assignee_member_id) {
      await upsertActiveAssignment(
        supabase,
        taskId,
        input.primary_assignee_member_id,
        actorMemberId,
        'PRIMARY',
        'PRIMARY',
      );
    }
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.updated', entityType: 'task',
    entityId: taskId, projectId: task.project_id,
    beforeState: before, afterState: input,
  });

  // Invalidate cache version scopes
  await cache.incrementCacheVersion(`cache_versions.dashboard_org_${orgId}`);
  if (task.project_id) {
    await cache.incrementCacheVersion(`cache_versions.project_scope_${orgId}`);
  }
  await cache.incrementCacheVersion(`cache_versions.member_access_${orgId}_${actorMemberId}`);
  if (input.primary_assignee_member_id) {
    await cache.incrementCacheVersion(`cache_versions.member_access_${orgId}_${input.primary_assignee_member_id}`);
  }
  if (before.primary_assignee_member_id && before.primary_assignee_member_id !== input.primary_assignee_member_id) {
    await cache.incrementCacheVersion(`cache_versions.member_access_${orgId}_${before.primary_assignee_member_id}`);
  }

  return task;
}

export async function archiveTask(supabase: SupabaseClient, orgId: string, taskId: string, memberId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString(), archived_by: memberId })
    .eq('id', taskId).eq('organization_id', orgId).select('id, project_id').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.archived', entityType: 'task',
    entityId: taskId, projectId: data.project_id,
  });

  await cache.incrementCacheVersion(`cache_versions.dashboard_org_${orgId}`);
  if (data.project_id) {
    await cache.incrementCacheVersion(`cache_versions.project_scope_${orgId}`);
  }
  // Ideally invalidate assignees too, but for broad safety we skip specific member scoping here 
  // or they'll get it when they mutate next, or we could look up the assignees.

  return data;
}

export async function bulkUpdateTasks(
  supabase: SupabaseClient, orgId: string, taskIds: string[], patch: UpdateTaskInput,
) {
  if (Object.prototype.hasOwnProperty.call(patch, 'primary_assignee_member_id')) {
    throw Errors.validation('Bulk reassignment is disabled so assignment history stays complete.');
  }
  // Same cross-tenant defense-in-depth as createTask/updateTask: without this,
  // a member could bulk-repoint tasks at another organization's epic/sprint.
  // No single projectId applies across a bulk patch, so epic/sprint are
  // validated against orgId only (not per-task project consistency).
  if (patch.epic_id || patch.sprint_id) {
    await assertOrgScopedTaskRefs(supabase, orgId, undefined, patch.epic_id, patch.sprint_id);
  }
  const { data, error } = await supabase
    .from('tasks').update(patch).in('id', taskIds).eq('organization_id', orgId).select('id');
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.bulk_updated', entityType: 'task',
    metadata: { count: data?.length ?? 0, patch },
  });

  await cache.incrementCacheVersion(`cache_versions.dashboard_org_${orgId}`);
  // In a real bulk update, we might invalidate multiple projects/members, 
  // but we'll stick to org-level invalidate here for simplicity

  return data;
}

export async function addAssignee(
  supabase: SupabaseClient,
  orgId: string,
  taskId: string,
  memberId: string,
  actorMemberId: string,
  role?: string,
  assignmentType?: TaskAssignmentType,
) {
  const { data: task } = await supabase.from('tasks').select('project_id').eq('id', taskId).maybeSingle();
  if (!task) throw Errors.forbidden('You do not have permission to assign this task.');
  await assertAssignable(supabase, orgId, task?.project_id, memberId);

  const type = assignmentType ?? roleToAssignmentType(role);
  const data = await upsertActiveAssignment(supabase, taskId, memberId, actorMemberId, type, role);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.assignee_added', entityType: 'task',
    entityId: taskId, metadata: { memberId, assignmentType: type },
  });
  return data;
}

function roleToAssignmentType(role?: string): TaskAssignmentType {
  const normalized = role?.toUpperCase();
  if (normalized === 'PRIMARY' || normalized === 'REVIEWER' || normalized === 'OBSERVER') {
    return normalized;
  }
  return 'ADDITIONAL';
}

async function upsertActiveAssignment(
  supabase: SupabaseClient,
  taskId: string,
  memberId: string,
  actorMemberId: string,
  assignmentType: TaskAssignmentType,
  role?: string,
) {
  const assignment_role = role ?? (assignmentType === 'ADDITIONAL' ? 'ASSIGNEE' : assignmentType);
  const { data: existing, error: existingError } = await supabase
    .from('task_assignees')
    .select('id')
    .eq('task_id', taskId)
    .eq('organization_member_id', memberId)
    .is('removed_at', null)
    .maybeSingle();
  if (existingError) throw Errors.internal(existingError.message);

  if (existing) {
    const { data, error } = await supabase
      .from('task_assignees')
      .update({
        assignment_type: assignmentType,
        assignment_role,
        assigned_by_member_id: actorMemberId,
        assigned_by: actorMemberId,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw Errors.internal(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from('task_assignees')
    .insert({
      task_id: taskId,
      organization_member_id: memberId,
      assignment_type: assignmentType,
      assignment_role,
      assigned_by_member_id: actorMemberId,
      assigned_by: actorMemberId,
    })
    .select('*')
    .single();
  if (error) throw Errors.internal(error.message);
  return data;
}
