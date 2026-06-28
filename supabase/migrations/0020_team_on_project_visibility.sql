-- ============================================================================
-- Handoff — 0020 Team-on-project visibility
-- A user can view a project if their team is assigned to it (project_teams →
-- team_members), in addition to explicit project_members and broad roles.
-- ============================================================================

create or replace function handoff.in_project_team(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.project_teams pt
    join public.team_members tm on tm.team_id = pt.team_id
    join public.organization_members m on m.id = tm.organization_member_id
    where pt.project_id = p_project and m.user_id = auth.uid() and m.is_active
  );
$$;

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
      or handoff.in_project_team(p_project)
    );
$$;
