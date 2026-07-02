import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { CLOSED_TASK_STATUSES } from '@/lib/constants/task-statuses';
import { z } from 'zod';
import { createSprintSchema, updateSprintSchema } from '@/lib/validation/delivery';

export async function listSprints(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('sprints').select('*').eq('organization_id', orgId).order('start_date', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createSprint(supabase: SupabaseClient, orgId: string, input: z.infer<typeof createSprintSchema>) {
  const { data, error } = await supabase.from('sprints')
    .insert({ ...input, organization_id: orgId }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, { organizationId: orgId, action: 'sprint.created', entityType: 'sprint', entityId: data.id, projectId: input.project_id });
  return data;
}

export async function updateSprint(supabase: SupabaseClient, orgId: string, sprintId: string, input: z.infer<typeof updateSprintSchema>) {
  const { data, error } = await supabase.from('sprints').update(input).eq('id', sprintId).eq('organization_id', orgId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  return data;
}

export async function setSprintStatus(supabase: SupabaseClient, orgId: string, sprintId: string, status: 'ACTIVE' | 'COMPLETED') {
  const patch: Record<string, unknown> = { status };
  if (status === 'COMPLETED') {
    // compute completed story points from done tasks
    const { data: done } = await supabase.from('tasks')
      .select('story_points').eq('sprint_id', sprintId).eq('status', 'DONE');
    const completed = (done ?? []).reduce((s, t: { story_points: number | null }) => s + (t.story_points ?? 0), 0);
    patch.completed_story_points = completed;
  }
  const { data, error } = await supabase.from('sprints').update(patch).eq('id', sprintId).eq('organization_id', orgId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  await createAuditLog(supabase, {
    organizationId: orgId, action: `sprint.${status.toLowerCase()}`, entityType: 'sprint',
    entityId: sprintId, projectId: data.project_id,
  });
  return data;
}

export async function getBurndown(supabase: SupabaseClient, sprintId: string) {
  const { data: sprint } = await supabase.from('sprints').select('*').eq('id', sprintId).maybeSingle();
  if (!sprint) throw Errors.notFound('Sprint not found.');
  const { data: tasks } = await supabase.from('tasks')
    .select('status, story_points, updated_at').eq('sprint_id', sprintId);
  const total = (tasks ?? []).reduce((s, t: { story_points: number | null }) => s + (t.story_points ?? 0), 0);
  const done = (tasks ?? [])
    .filter((t: { status: string }) => CLOSED_TASK_STATUSES.includes(t.status as never))
    .reduce((s, t: { story_points: number | null }) => s + (t.story_points ?? 0), 0);
  return {
    sprint,
    plannedPoints: total,
    completedPoints: done,
    remainingPoints: total - done,
    capacityHours: sprint.capacity_hours,
    overCapacity: total > (sprint.planned_story_points || total),
  };
}
