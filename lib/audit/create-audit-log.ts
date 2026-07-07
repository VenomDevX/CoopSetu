import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestContext } from '@/lib/security/request-context';

export interface AuditInput {
  organizationId: string | null;
  actorMemberId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  projectId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
  outcome?: string; // SUCCESS, DENIED, FAILED
}

/** Write an audit-log entry securely. */
export async function createAuditLog(
  supabase: SupabaseClient,
  input: AuditInput,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const context = await getRequestContext();

    // Resolve the actor from the caller's own client rather than re-deriving
    // a cookie-based session (lib/auth/require-user.ts's getAuthContext()):
    // the passed-in client is already the authenticated actor, and this also
    // keeps audit logging working when a service is invoked outside an HTTP
    // request (integration tests, background jobs) where cookies()/headers()
    // are unavailable.
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    let actorMemberId = input.actorMemberId ?? null;
    if (!actorMemberId && userId && input.organizationId) {
      const { data: member } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', input.organizationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      actorMemberId = member?.id ?? null;
    }

    const { error: insertError } = await admin.from('audit_logs').insert({
      organization_id: input.organizationId,
      actor_user_id: userId ?? null,
      actor_member_id: actorMemberId,
      actor_type: userId ? 'USER' : 'SYSTEM',
      request_id: context.request_id,
      ip_hash: context.ip_hash,
      user_agent_hash: context.user_agent_hash,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      project_id: input.projectId ?? null,
      outcome: input.outcome ?? 'SUCCESS',
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      metadata: input.metadata ?? {},
    });
    
    if (insertError) {
      console.error('[audit] failed to write log', insertError.message);
    }
  } catch (error: any) {
    console.error('[audit] failed to write log', error.message);
  }
}
