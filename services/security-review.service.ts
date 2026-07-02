import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import type { z } from 'zod';
import type { createSecurityReviewSchema } from '@/lib/validation/qa-security';

export async function createSecurityReview(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
  input: z.infer<typeof createSecurityReviewSchema>,
) {
  const { data, error } = await supabase
    .rpc('start_security_review', {
      p_organization_id: orgId,
      p_project_id: input.project_id,
      p_payload: input,
    })
    .single<{ id: string; title: string; project_id: string }>();

  if (error) {
    if (error.message?.includes('FORBIDDEN') || error.message?.includes('accessible'))
      throw Errors.forbidden(error.message);
    throw Errors.internal(error.message);
  }

  await createAuditLog(supabase, {
    organizationId: orgId,
    action: 'security_review.started',
    entityType: 'security_review',
    entityId: data.id,
    projectId: data.project_id,
    afterState: { title: input.title, risk_level: input.risk_level },
  });

  return data;
}
