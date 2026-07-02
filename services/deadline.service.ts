import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CreateProjectDeadlineInput } from '@/lib/validation/group-a-actions';

export async function listProjectDeadlines(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('project_deadlines')
    .select('*, project:project_id(id, code, name), sprint:sprint_id(id, name)')
    .eq('organization_id', orgId)
    .order('due_date', { ascending: true });
  if (error) throw Errors.internal(error.message);
  return data ?? [];
}

export async function createProjectDeadline(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  input: CreateProjectDeadlineInput,
) {
  const { data, error } = await supabase
    .from('project_deadlines')
    .insert({
      ...input,
      organization_id: orgId,
      created_by_member_id: actorMemberId,
      status: input.status ?? 'PLANNED',
    })
    .select('*, project:project_id(code, name)')
    .single();

  if (error) throw Errors.internal(error.message);

  await supabase.from('project_activity').insert({
    project_id: input.project_id,
    actor_member_id: actorMemberId,
    activity_type: 'deadline.created',
    entity_type: 'project_deadline',
    entity_id: data.id,
    metadata: { title: data.title, due_date: data.due_date },
  });

  await createAuditLog(supabase, {
    organizationId: orgId,
    actorMemberId,
    action: 'deadline.created',
    entityType: 'project_deadline',
    entityId: data.id,
    projectId: input.project_id,
    afterState: data,
  });

  if (data.owner_member_id && data.owner_member_id !== actorMemberId) {
    try {
      const { error: notificationError } = await createAdminClient().from('notifications').insert({
        organization_id: orgId,
        recipient_member_id: data.owner_member_id,
        actor_member_id: actorMemberId,
        type: 'DEADLINE_ASSIGNED',
        title: `Deadline assigned: ${data.title}`,
        body: `Due ${data.due_date}`,
        entity_type: 'project_deadline',
        entity_id: data.id,
        project_id: input.project_id,
        metadata: { due_date: data.due_date },
      });
      if (notificationError) console.error('[deadline] notification failed', notificationError.message);
    } catch (notificationError) {
      console.error('[deadline] notification failed', notificationError);
    }
  }

  return data;
}
