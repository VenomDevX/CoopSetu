import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const BLOCKED_EXT = /\.(exe|dll|bat|cmd|sh|msi|scr|com|jar)$/i;

export interface RegisterAttachmentInput {
  task_id: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  size_bytes?: number;
  classification?: string;
}

/** Record an attachment row after the file was uploaded to storage. */
export async function registerAttachment(
  supabase: SupabaseClient, orgId: string, memberId: string, input: RegisterAttachmentInput,
) {
  if (BLOCKED_EXT.test(input.file_name)) throw Errors.validation('That file type is not allowed.');
  if (input.size_bytes && input.size_bytes > MAX_BYTES) throw Errors.validation('File exceeds the 25 MB limit.');

  const { data: task } = await supabase
    .from('tasks').select('project_id').eq('id', input.task_id).maybeSingle();
  if (!task) throw Errors.forbidden('You do not have permission to attach files to this task.');

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      organization_id: orgId, uploaded_by_member_id: memberId,
      task_id: input.task_id, project_id: task.project_id,
      bucket: 'attachments', storage_path: input.storage_path,
      file_name: input.file_name, mime_type: input.mime_type ?? null,
      size_bytes: input.size_bytes ?? null, classification: input.classification ?? 'INTERNAL',
    })
    .select('*').single();
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'attachment.uploaded', entityType: 'attachment',
    entityId: data.id, projectId: task.project_id, metadata: { taskId: input.task_id, file: input.file_name },
  });
  return data;
}

/** List a task's attachments with short-lived signed download URLs. */
export async function listAttachments(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from('attachments')
    .select('id, file_name, mime_type, size_bytes, storage_path, bucket, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal(error.message);

  const withUrls = await Promise.all((data ?? []).map(async (a) => {
    const { data: signed } = await supabase.storage
      .from(a.bucket).createSignedUrl(a.storage_path, 60 * 10);
    return { ...a, url: signed?.signedUrl ?? null };
  }));
  return withUrls;
}
