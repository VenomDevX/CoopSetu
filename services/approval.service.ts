import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { z } from 'zod';
import { createApprovalRequestSchema, decideApprovalSchema } from '@/lib/validation/delivery';
import { notifyMemberByEmail } from '@/lib/notifications/notify';
import { escapeHtml } from '@/lib/email/send-email';

export async function listApprovals(supabase: SupabaseClient, orgId: string, status?: string) {
  let q = supabase.from('approval_requests').select('*, approvals(*)').eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createApprovalRequest(
  supabase: SupabaseClient, orgId: string, memberId: string, input: z.infer<typeof createApprovalRequestSchema>,
) {
  const { data, error } = await supabase.from('approval_requests')
    .insert({ ...input, organization_id: orgId, requested_by_member_id: memberId }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'approval.requested', entityType: 'approval_request',
    entityId: data.id, projectId: input.project_id ?? null,
  });
  return data;
}

export async function decideApproval(
  supabase: SupabaseClient, orgId: string, memberId: string, approvalId: string,
  input: z.infer<typeof decideApprovalSchema>,
) {
  const { data: req } = await supabase.from('approval_requests').select('*').eq('id', approvalId).maybeSingle();
  if (!req) throw Errors.notFound('Approval request not found.');

  const { error: insErr } = await supabase.from('approvals').insert({
    organization_id: orgId, approval_request_id: approvalId, approver_member_id: memberId,
    decision: input.decision, comment: input.comment ?? null,
  });
  if (insErr) throw Errors.internal(insErr.message);

  const { data, error } = await supabase.from('approval_requests')
    .update({ status: input.decision }).eq('id', approvalId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);

  // notify requester
  if (req.requested_by_member_id) {
    await supabase.rpc('create_notification', {
      p_org: orgId, p_recipient: req.requested_by_member_id, p_type: 'APPROVAL_DECIDED',
      p_title: `Approval ${input.decision.toLowerCase()}`, p_body: req.approval_type,
      p_entity_type: 'approval_request', p_entity_id: approvalId, p_project_id: req.project_id ?? null, p_metadata: {},
    }).then(() => {}, () => {});
    notifyMemberByEmail(
      supabase, req.requested_by_member_id,
      `Approval ${input.decision.toLowerCase()}: ${req.approval_type}`,
      `<p>Your approval request <strong>${escapeHtml(req.approval_type)}</strong> was <strong>${escapeHtml(input.decision)}</strong>${input.comment ? ` with comment: "${escapeHtml(input.comment)}"` : ''}.</p>`,
    ).then(() => {}, () => {});
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'approval.decided', entityType: 'approval_request',
    entityId: approvalId, projectId: req.project_id ?? null, afterState: input,
  });
  return data;
}
