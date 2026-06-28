import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { assertAssignable } from '@/services/member.service';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validation/task';

const TASK_SELECT =
  '*, assignee:primary_assignee_member_id(id, user_id), task_assignees(organization_member_id), project:project_id(id, code, name)';

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
  if (filters.assigneeMemberId) q = q.eq('primary_assignee_member_id', filters.assigneeMemberId);
  if (filters.mine) q = q.eq('primary_assignee_member_id', currentMemberId);
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
  if (!data) throw Errors.notFound('Task not found.');
  return data;
}

export async function createTask(
  supabase: SupabaseClient, orgId: string, reporterMemberId: string, input: CreateTaskInput,
) {
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

  // mirror primary assignee into task_assignees (fires the notification trigger)
  if (input.primary_assignee_member_id) {
    await supabase.from('task_assignees').insert({
      task_id: data.id,
      organization_member_id: input.primary_assignee_member_id,
      assigned_by: reporterMemberId,
    }).then(() => {}, () => {});
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.created', resourceType: 'task',
    resourceId: data.id, projectId: input.project_id, newValue: { title: data.title, key: data.task_key },
  });
  return data;
}

export async function updateTask(
  supabase: SupabaseClient, orgId: string, taskId: string, input: UpdateTaskInput,
) {
  const { data: before } = await supabase.from('tasks').select('status, primary_assignee_member_id, project_id').eq('id', taskId).maybeSingle();

  // Validate a (changed) assignee against the task's project before writing.
  if (
    input.primary_assignee_member_id &&
    input.primary_assignee_member_id !== before?.primary_assignee_member_id
  ) {
    await assertAssignable(supabase, orgId, before?.project_id, input.primary_assignee_member_id);
  }

  const { data, error } = await supabase
    .from('tasks').update(input).eq('id', taskId).eq('organization_id', orgId).select(TASK_SELECT).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden('You cannot edit this task.');

  // keep assignee table in sync + notify new assignee
  if (input.primary_assignee_member_id && input.primary_assignee_member_id !== before?.primary_assignee_member_id) {
    await supabase.from('task_assignees').upsert(
      { task_id: taskId, organization_member_id: input.primary_assignee_member_id },
      { onConflict: 'task_id,organization_member_id' },
    ).then(() => {}, () => {});
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.updated', resourceType: 'task',
    resourceId: taskId, projectId: data.project_id,
    oldValue: before, newValue: input,
  });
  return data;
}

export async function archiveTask(supabase: SupabaseClient, orgId: string, taskId: string, memberId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString(), archived_by: memberId })
    .eq('id', taskId).eq('organization_id', orgId).select('id, project_id').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.archived', resourceType: 'task',
    resourceId: taskId, projectId: data.project_id,
  });
  return data;
}

export async function bulkUpdateTasks(
  supabase: SupabaseClient, orgId: string, taskIds: string[], patch: UpdateTaskInput,
) {
  const { data, error } = await supabase
    .from('tasks').update(patch).in('id', taskIds).eq('organization_id', orgId).select('id');
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.bulk_updated', resourceType: 'task',
    metadata: { count: data?.length ?? 0, patch },
  });
  return data;
}

export async function addAssignee(
  supabase: SupabaseClient, orgId: string, taskId: string, memberId: string, role?: string,
) {
  const { data: task } = await supabase.from('tasks').select('project_id').eq('id', taskId).maybeSingle();
  await assertAssignable(supabase, orgId, task?.project_id, memberId);

  const { data, error } = await supabase
    .from('task_assignees')
    .upsert({ task_id: taskId, organization_member_id: memberId, assignment_role: role ?? 'ASSIGNEE' },
            { onConflict: 'task_id,organization_member_id' })
    .select('*').single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'task.assignee_added', resourceType: 'task',
    resourceId: taskId, metadata: { memberId },
  });
  return data;
}
