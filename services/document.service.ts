import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function listDocuments(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('documents').select('*').eq('organization_id', orgId).is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getDocument(supabase: SupabaseClient, documentId: string) {
  const { data, error } = await supabase.from('documents')
    .select('*, document_versions(*), document_comments(*)').eq('id', documentId).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Document not found.');
  return data;
}

export async function createDocument(
  supabase: SupabaseClient, orgId: string, memberId: string,
  input: { title: string; content_markdown?: string; document_type?: string; project_id?: string; classification?: string },
) {
  // Defense-in-depth: project_id is a client-supplied UUID. Without this, a
  // member could file a document under another organization's project_id
  // (the FK only requires the project to exist, not belong to this org).
  if (input.project_id) {
    const { data: project } = await supabase.from('projects').select('id').eq('id', input.project_id).eq('organization_id', orgId).maybeSingle();
    if (!project) throw Errors.validation('Selected project does not belong to this organization.');
  }

  const { data, error } = await supabase.from('documents').insert({
    ...input, organization_id: orgId, owner_member_id: memberId,
    content_markdown: input.content_markdown ?? '', current_version: 1,
  }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await supabase.from('document_versions').insert({
    document_id: data.id, version_number: 1, content_markdown: data.content_markdown,
    created_by_member_id: memberId, change_summary: 'Initial version',
  });
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'document.created', entityType: 'document',
    entityId: data.id, projectId: input.project_id ?? null,
  });
  return data;
}

export async function updateDocument(
  supabase: SupabaseClient, orgId: string, memberId: string, documentId: string,
  input: { title?: string; content_markdown?: string; status?: string; change_summary?: string },
) {
  const { data: current } = await supabase.from('documents').select('current_version, content_markdown, project_id').eq('id', documentId).maybeSingle();
  if (!current) throw Errors.notFound('Document not found.');

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status !== undefined) patch.status = input.status;

  // new version when content changes
  if (input.content_markdown !== undefined && input.content_markdown !== current.content_markdown) {
    const next = (current.current_version ?? 1) + 1;
    patch.content_markdown = input.content_markdown;
    patch.current_version = next;
    await supabase.from('document_versions').insert({
      document_id: documentId, version_number: next, content_markdown: input.content_markdown,
      created_by_member_id: memberId, change_summary: input.change_summary ?? 'Updated',
    });
  }

  const { data, error } = await supabase.from('documents').update(patch).eq('id', documentId).eq('organization_id', orgId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'document.updated', entityType: 'document',
    entityId: documentId, projectId: current.project_id,
  });
  return data;
}

export async function approveDocument(supabase: SupabaseClient, orgId: string, memberId: string, documentId: string) {
  const { data, error } = await supabase.from('documents').update({
    status: 'APPROVED', approved_by_member_id: memberId, approved_at: new Date().toISOString(),
  }).eq('id', documentId).eq('organization_id', orgId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden('You cannot approve this document.');
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'document.approved', entityType: 'document',
    entityId: documentId, projectId: data.project_id,
  });
  return data;
}

export async function addDocumentComment(
  supabase: SupabaseClient, orgId: string, memberId: string, documentId: string, body: string,
) {
  const { data, error } = await supabase.from('document_comments')
    .insert({ document_id: documentId, author_member_id: memberId, body }).select('*').single();
  if (error) throw Errors.internal(error.message);
  return data;
}
