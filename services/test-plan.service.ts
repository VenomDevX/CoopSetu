import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import type { z } from 'zod';
import type { createTestPlanSchema } from '@/lib/validation/qa-security';

export async function createTestPlan(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
  input: z.infer<typeof createTestPlanSchema>,
) {
  const { data, error } = await createAdminClient()
    .rpc('create_test_plan', {
      p_organization_id: orgId,
      p_project_id: input.project_id,
      p_actor_member_id: memberId,
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
    action: 'test_plan.created',
    resourceType: 'test_plan',
    resourceId: data.id,
    projectId: data.project_id,
    newValue: { title: input.title },
  });

  return data;
}
