import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditInput {
  organizationId: string;
  actorMemberId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  projectId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

/** Write an audit-log entry via the SECURITY DEFINER DB helper. */
export async function createAuditLog(
  supabase: SupabaseClient,
  input: AuditInput,
): Promise<void> {
  const { error } = await supabase.rpc('write_audit_log', {
    p_org: input.organizationId,
    p_action: input.action,
    p_resource_type: input.resourceType,
    p_resource_id: input.resourceId ?? null,
    p_project_id: input.projectId ?? null,
    p_old: input.oldValue ?? null,
    p_new: input.newValue ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (!error) return;

  // Newer hardening migrations revoke direct authenticated execution of
  // write_audit_log. API routes still need audit rows, so fall back to a
  // trusted server-side insert while deriving the actor from the request
  // session. This keeps the browser from choosing audit actors.
  try {
    const admin = createAdminClient();
    let actorMemberId = input.actorMemberId ?? null;
    if (!actorMemberId) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        const { data: member } = await admin
          .from('organization_members')
          .select('id')
          .eq('organization_id', input.organizationId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
        actorMemberId = member?.id ?? null;
      }
    }

    const { error: insertError } = await admin.from('audit_logs').insert({
      organization_id: input.organizationId,
      actor_member_id: actorMemberId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      project_id: input.projectId ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      metadata: input.metadata ?? {},
    });
    if (insertError) console.error('[audit] failed to write log', insertError.message);
  } catch (fallbackError) {
    console.error('[audit] failed to write log', error.message, fallbackError);
  }
}
