import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { z } from 'zod';
import { createReleaseSchema, decideReleaseApprovalSchema } from '@/lib/validation/delivery';

const APPROVAL_ROLE: Record<string, string> = {
  QA: 'QA_ENGINEER', SECURITY: 'SECURITY_ENGINEER',
  COMPLIANCE: 'COMPLIANCE_REVIEWER', RELEASE_MANAGER: 'PROJECT_MANAGER',
};

export async function listReleases(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('releases')
    .select('*, release_approvals(*)').eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createRelease(supabase: SupabaseClient, orgId: string, input: z.infer<typeof createReleaseSchema>) {
  const { data, error } = await supabase.from('releases')
    .insert({ ...input, organization_id: orgId, status: 'DRAFT' }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'release.created', entityType: 'release',
    entityId: data.id, projectId: input.project_id, afterState: { version: data.version },
  });
  return data;
}

/** Create the required approval gates and move the release into pending. */
export async function requestApproval(supabase: SupabaseClient, orgId: string, releaseId: string) {
  const { data: release } = await supabase.from('releases').select('*').eq('id', releaseId).maybeSingle();
  if (!release) throw Errors.notFound('Release not found.');

  const types = ['QA', 'SECURITY', 'RELEASE_MANAGER'];
  if (release.requires_compliance_approval) types.splice(2, 0, 'COMPLIANCE');

  const rows = types.map((t) => ({
    release_id: releaseId, approval_type: t, required_role: APPROVAL_ROLE[t], status: 'PENDING',
  }));
  const { error } = await supabase.from('release_approvals')
    .upsert(rows, { onConflict: 'release_id,approval_type' });
  if (error) throw Errors.internal(error.message);

  await supabase.from('releases').update({ status: 'QA_PENDING' }).eq('id', releaseId).eq('organization_id', orgId);
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'release.approval_requested', entityType: 'release',
    entityId: releaseId, projectId: release.project_id, metadata: { gates: types },
  });
  return { ok: true, gates: types };
}

export async function decideReleaseApproval(
  supabase: SupabaseClient, orgId: string, memberId: string, releaseId: string,
  input: z.infer<typeof decideReleaseApprovalSchema>,
) {
  const { data, error } = await supabase.from('release_approvals')
    .update({
      status: input.decision, comment: input.comment ?? null,
      decided_at: new Date().toISOString(), approved_by_member_id: memberId,
    })
    .eq('release_id', releaseId).eq('approval_type', input.approval_type)
    .select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Approval gate not found.');

  const { data: release } = await supabase.from('releases').select('project_id').eq('id', releaseId).maybeSingle();

  // If all gates approved, mark approved for deployment.
  const { data: canDeploy } = await supabase.rpc('release_can_deploy', { p_release: releaseId });
  if (canDeploy) await supabase.from('releases').update({ status: 'APPROVED_FOR_DEPLOYMENT' }).eq('id', releaseId).eq('organization_id', orgId);
  else if (input.decision === 'REJECTED') await supabase.from('releases').update({ status: 'BLOCKED' }).eq('id', releaseId).eq('organization_id', orgId);

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'release.approval_decided', entityType: 'release_approval',
    entityId: data.id, projectId: release?.project_id, afterState: input,
  });
  return { approval: data, canDeploy: !!canDeploy };
}

/** Enforce gating server-side before deploying. Frontend cannot bypass. */
export async function deployRelease(
  supabase: SupabaseClient, orgId: string, memberId: string, releaseId: string, environmentId?: string,
) {
  const { data: canDeploy } = await supabase.rpc('release_can_deploy', { p_release: releaseId });
  if (!canDeploy) throw Errors.forbidden('Release is not approved for deployment. All required approvals must pass.');

  const { data: release } = await supabase.from('releases').select('*').eq('id', releaseId).maybeSingle();
  if (!release) throw Errors.notFound('Release not found.');

  await supabase.from('releases').update({ status: 'DEPLOYING' }).eq('id', releaseId).eq('organization_id', orgId);
  const { data: deployment, error } = await supabase.from('deployments').insert({
    organization_id: orgId, project_id: release.project_id, release_id: releaseId,
    environment_id: environmentId ?? null, version: release.version, status: 'DEPLOYING',
    triggered_by_member_id: memberId,
  }).select('*').single();
  if (error) throw Errors.internal(error.message);

  // simulate completion (mock deploy)
  await supabase.from('deployments').update({ status: 'DEPLOYED', completed_at: new Date().toISOString(), logs_summary: 'Mock deployment succeeded.' }).eq('id', deployment.id);
  await supabase.from('releases').update({ status: 'DEPLOYED', released_at: new Date().toISOString() }).eq('id', releaseId).eq('organization_id', orgId);

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'release.deployed', entityType: 'release',
    entityId: releaseId, projectId: release.project_id, metadata: { deploymentId: deployment.id },
  });
  return { deployment, status: 'DEPLOYED' };
}
