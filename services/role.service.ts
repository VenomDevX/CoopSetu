import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function listRoles(supabase: SupabaseClient, orgId: string) {
  // System roles (organization_id is null) + this org's custom roles.
  const { data, error } = await supabase
    .from('roles')
    .select('id, code, name, description, is_system, organization_id, role_permissions(permission_code)')
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .order('is_system', { ascending: false });
  if (error) throw Errors.internal(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, code: r.code, name: r.name, description: r.description,
    is_system: r.is_system, is_custom: r.organization_id === orgId,
    permissions: (r.role_permissions ?? []).map((p: { permission_code: string }) => p.permission_code),
  }));
}

export async function listPermissions(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('permissions').select('code, description').order('code');
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createRole(
  supabase: SupabaseClient, orgId: string,
  input: { code: string; name: string; description?: string; permissions: string[] },
) {
  const { data: role, error } = await supabase
    .from('roles')
    .insert({ organization_id: orgId, code: input.code, name: input.name, description: input.description, is_system: false })
    .select('id').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('A role with that code already exists.');
    throw Errors.internal(error.message);
  }
  if (input.permissions.length) {
    const { error: pErr } = await supabase.from('role_permissions')
      .insert(input.permissions.map((p) => ({ role_id: role.id, permission_code: p })));
    if (pErr) throw Errors.internal(pErr.message);
  }
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'role.created', resourceType: 'role',
    resourceId: role.id, newValue: { code: input.code, permissions: input.permissions },
  });
  return role;
}

export async function updateRolePermissions(
  supabase: SupabaseClient, orgId: string, roleId: string, permissions: string[],
) {
  // Confirm the role is an editable org-owned role.
  const { data: role } = await supabase
    .from('roles').select('id, organization_id, is_system').eq('id', roleId).maybeSingle();
  if (!role || role.organization_id !== orgId || role.is_system) {
    throw Errors.forbidden('Only custom roles in your organization can be edited.');
  }
  await supabase.from('role_permissions').delete().eq('role_id', roleId);
  if (permissions.length) {
    const { error } = await supabase.from('role_permissions')
      .insert(permissions.map((p) => ({ role_id: roleId, permission_code: p })));
    if (error) throw Errors.internal(error.message);
  }
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'role.permissions_updated', resourceType: 'role',
    resourceId: roleId, newValue: { permissions },
  });
  return { ok: true };
}
