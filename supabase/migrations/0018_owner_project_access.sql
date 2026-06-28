-- ============================================================================
-- Handoff — 0018 Grant ORG_OWNER project visibility/management
-- ORG_OWNER was added in 0013 but not included in the project access helpers,
-- so owners could not see projects/tasks. Add ORG_OWNER to both broad-role lists.
-- ============================================================================

create or replace function handoff.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with p as (select organization_id from public.projects where id = p_project)
  select exists (select 1 from p)
    and handoff.is_org_member((select organization_id from p))
    and (
      handoff.has_role((select organization_id from p),
        array['SUPER_ADMIN','ORG_OWNER','ORG_ADMIN','CEO','CTO','PROJECT_MANAGER',
              'ENGINEERING_MANAGER','AUDITOR','COMPLIANCE_REVIEWER'])
      or exists (
        select 1 from public.project_members pm
        join public.organization_members m on m.id = pm.organization_member_id
        where pm.project_id = p_project and m.user_id = auth.uid()
          and m.is_active and pm.can_view
      )
    );
$$;

create or replace function handoff.can_manage_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with p as (select organization_id from public.projects where id = p_project)
  select exists (select 1 from p)
    and (
      handoff.has_role((select organization_id from p),
        array['SUPER_ADMIN','ORG_OWNER','ORG_ADMIN','PROJECT_MANAGER','ENGINEERING_MANAGER'])
      or exists (
        select 1 from public.project_members pm
        join public.organization_members m on m.id = pm.organization_member_id
        where pm.project_id = p_project and m.user_id = auth.uid()
          and m.is_active and pm.can_manage
      )
    );
$$;
