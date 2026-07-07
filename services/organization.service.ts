import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@/lib/validation/organization';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { Errors } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createOrganization(
  supabase: SupabaseClient,
  userId: string,
  input: CreateOrganizationInput,
) {
  const { data, error } = await createAdminClient().rpc('create_organization', {
    p_user_id: userId,
    p_name: input.name,
    p_slug: input.slug ?? null,
    p_industry: input.industry ?? null,
    p_timezone: input.timezone ?? 'UTC',
  });
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: data.id,
    action: 'organization.created',
    entityType: 'organization',
    entityId: data.id,
    afterState: { name: data.name },
  });
  return data;
}

export async function getCurrentOrganization(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Organization not found.');
  return data;
}

export async function updateOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  input: UpdateOrganizationInput,
) {
  const { data, error } = await supabase
    .from('organizations')
    .update(input)
    .eq('id', organizationId)
    .select('*')
    .maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();

  await createAuditLog(supabase, {
    organizationId,
    action: 'organization.updated',
    entityType: 'organization',
    entityId: organizationId,
    afterState: input,
  });
  return data;
}

/** All active memberships for the current user (for the org switcher). */
export async function listMyOrganizations(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name, slug, logo_path)')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw Errors.internal(error.message);
  return (data ?? []).map((r) => r.organizations).filter(Boolean);
}
