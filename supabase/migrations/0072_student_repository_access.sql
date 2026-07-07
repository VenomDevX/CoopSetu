-- ============================================================================
-- Handoff — 0072 Student repository access
-- ============================================================================
-- Grants integration:view + integration:manage (Repositories / Pull Requests /
-- Commits / CI-CD / Environments / Deployments) to all four student roles.
-- These codes were deliberately withheld in migration 0068 as "enterprise-only"
-- — this migration is an explicit, later decision to extend the feature to
-- students, per user request. All four roles get both view and manage: any
-- student (Lead, Co-Lead, Member, or Solo Owner) can connect/manage a repo.
-- ============================================================================

do $$
declare r record;
begin
  for r in select id from public.roles
    where code in ('STUDENT_TEAM_LEAD','STUDENT_CO_LEAD','STUDENT_MEMBER','STUDENT_SOLO_OWNER')
    and organization_id is null
  loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in ('integration:view','integration:manage')
    on conflict do nothing;
  end loop;
end $$;
