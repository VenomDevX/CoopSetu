-- ============================================================================
-- Handoff — 0021 RLS for managing org-scoped custom roles' permissions
-- roles table already has roles_manage (member:manage) for org roles.
-- role_permissions previously had only a select policy; add manage policies
-- scoped to ORG-OWNED roles (system roles can never be edited from the client).
-- ============================================================================

create policy role_permissions_manage on public.role_permissions
  for all
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and r.organization_id is not null
        and handoff.has_permission(r.organization_id, 'member:manage')
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and r.organization_id is not null
        and handoff.has_permission(r.organization_id, 'member:manage')
    )
  );
