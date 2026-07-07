'use server';

import { requireUser } from '@/lib/auth/require-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function finishWorkspaceSetup() {
  const { user, supabase } = await requireUser();
  const admin = createAdminClient();

  // Find the active org where they are OWNER and setup is unfinished
  const { data: memberships, error: membershipsError } = await admin
    .from('organization_members')
    .select(`
      organization_id,
      member_roles!member_roles_organization_member_id_fkey ( roles ( code ) ),
      organizations:organization_id ( initial_setup_completed_at )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (membershipsError) {
    throw Errors.internal('Failed to load memberships.');
  }

  const unfinishedOwnedOrg = memberships?.find(m => {
    // @ts-ignore - Supabase join typing
    const roleCodes: string[] = (m.member_roles || []).map(mr => mr.roles?.code).filter(Boolean);
    // @ts-ignore - Supabase join typing
    return roleCodes.includes('ORG_OWNER') && !m.organizations?.initial_setup_completed_at;
  });

  if (!unfinishedOwnedOrg) {
    throw Errors.validation('No unfinished workspace setup found.');
  }

  const orgId = unfinishedOwnedOrg.organization_id;

  const { error } = await admin
    .from('organizations')
    .update({ initial_setup_completed_at: new Date().toISOString() })
    .eq('id', orgId);

  if (error) {
    throw Errors.internal('Failed to finalize workspace setup.');
  }

  await createAuditLog(supabase, {
    organizationId: orgId,
    action: 'organization.setup_completed',
    entityType: 'organization',
    entityId: orgId,
  });

  return { success: true };
}
