import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditInput {
  organizationId: string;
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
  if (error) console.error('[audit] failed to write log', error.message);
}
