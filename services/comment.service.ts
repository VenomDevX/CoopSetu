import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { sanitizeText, type CreateCommentInput } from '@/lib/validation/comment';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function listComments(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from('task_comments')
    .select(
      '*, author:author_member_id(id, user_id, ' +
      'profile:profiles!org_members_profile_fk(full_name, email, job_title)), ' +
      'comment_mentions(mentioned_member_id)',
    )
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw Errors.internal(error.message);
  return data;
}

/**
 * Edit own comment. Ownership is enforced by RLS (`comments_update_own`); the
 * author check here turns a 0-row RLS no-op into a clean 403. Sets `edited_at`.
 */
export async function updateComment(
  supabase: SupabaseClient, orgId: string, commentId: string, authorMemberId: string, rawBody: string,
) {
  const body = sanitizeText(rawBody);
  if (!body) throw Errors.validation('Comment cannot be empty.');

  const { data: existing } = await supabase
    .from('task_comments').select('id, author_member_id, task_id').eq('id', commentId).maybeSingle();
  if (!existing) throw Errors.notFound('Comment not found.');
  if (existing.author_member_id !== authorMemberId) throw Errors.forbidden();

  const { data, error } = await supabase
    .from('task_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('*, author:author_member_id(id, user_id)')
    .single();
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'comment.updated', resourceType: 'task_comment',
    resourceId: commentId, metadata: { taskId: existing.task_id },
  });
  return data;
}

/**
 * Soft-delete own comment (sets `deleted_at`, keeps the row so threaded replies
 * survive — the UI renders it as "[deleted]"). RLS `comments_update_own` applies.
 */
export async function deleteComment(
  supabase: SupabaseClient, orgId: string, commentId: string, authorMemberId: string,
) {
  const { data: existing } = await supabase
    .from('task_comments').select('id, author_member_id, task_id, deleted_at').eq('id', commentId).maybeSingle();
  if (!existing) throw Errors.notFound('Comment not found.');
  if (existing.author_member_id !== authorMemberId) throw Errors.forbidden();

  if (!existing.deleted_at) {
    const { error } = await supabase
      .from('task_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId);
    if (error) throw Errors.internal(error.message);
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'comment.deleted', resourceType: 'task_comment',
    resourceId: commentId, metadata: { taskId: existing.task_id },
  });
  return { id: commentId, deleted: true };
}

export async function createComment(
  supabase: SupabaseClient, orgId: string, taskId: string, authorMemberId: string, input: CreateCommentInput,
) {
  const body = sanitizeText(input.body);
  if (!body) throw Errors.validation('Comment cannot be empty.');

  const { data: task } = await supabase
    .from('tasks').select('project_id, task_key, title').eq('id', taskId).maybeSingle();

  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      organization_id: orgId, task_id: taskId, author_member_id: authorMemberId,
      body, parent_comment_id: input.parent_comment_id ?? null,
    })
    .select('*, author:author_member_id(id, user_id)')
    .single();
  if (error) throw Errors.internal(error.message);

  // mentions + notifications
  const mentions = (input.mentions ?? []).filter((m) => m !== authorMemberId);
  if (mentions.length) {
    await supabase.from('comment_mentions').insert(
      mentions.map((m) => ({ comment_id: data.id, mentioned_member_id: m })),
    ).then(() => {}, () => {});
    for (const m of mentions) {
      await supabase.rpc('create_notification', {
        p_org: orgId, p_recipient: m, p_type: 'TASK_MENTIONED',
        p_title: `You were mentioned on ${task?.task_key ?? 'a task'}`,
        p_body: body.slice(0, 280), p_entity_type: 'task', p_entity_id: taskId,
        p_project_id: task?.project_id ?? null, p_metadata: { comment_id: data.id },
      }).then(() => {}, () => {});
    }
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'comment.created', resourceType: 'task_comment',
    resourceId: data.id, projectId: task?.project_id, metadata: { taskId },
  });
  return data;
}
