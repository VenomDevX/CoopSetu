-- ============================================================================
-- Handoff — 0014 is_team_manager helper + team-scoped task assignment
-- ============================================================================

-- Is the current user a manager of the given team?
-- True if they are the team's lead, or a team member whose role_in_team marks
-- them as manager/lead, AND they hold a managerial authority role in the org.
create or replace function handoff.is_team_manager(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with t as (select id, organization_id, team_lead_member_id from public.teams where id = p_team)
  select exists (select 1 from t)
    and (
      -- org-level managers always manage teams
      handoff.has_role((select organization_id from t),
        array['SUPER_ADMIN','ORG_OWNER','ORG_ADMIN','ENGINEERING_MANAGER'])
      or exists (  -- the team's designated lead
        select 1 from t
        join public.organization_members m on m.id = t.team_lead_member_id
        where m.user_id = auth.uid() and m.is_active
      )
      or exists (  -- a TEAM_MANAGER/TEAM_LEAD who belongs to this team
        select 1
        from public.team_members tm
        join public.organization_members m on m.id = tm.organization_member_id
        where tm.team_id = p_team and m.user_id = auth.uid() and m.is_active
          and handoff.has_role((select organization_id from t), array['TEAM_MANAGER','TEAM_LEAD'])
      )
    );
$$;

-- Does the current user manage at least one team that the given member belongs to?
create or replace function handoff.manages_member_team(p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.organization_member_id = p_member
      and handoff.is_team_manager(tm.team_id)
  );
$$;

-- Can the current user assign the given member to the given task?
-- Project managers can assign any project member; team managers with task:assign
-- can assign members of teams they manage (and must be able to view the project).
create or replace function handoff.can_assign_to(p_task uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with t as (
    select id, project_id, organization_id from public.tasks where id = p_task
  )
  select exists (select 1 from t)
    and (
      handoff.can_manage_project((select project_id from t))
      or (
        handoff.has_permission((select organization_id from t), 'task:assign')
        and handoff.can_view_project((select project_id from t))
        and handoff.manages_member_team(p_member)
      )
    );
$$;

-- Replace the task_assignees management policy with team-aware logic.
drop policy if exists task_assignees_manage on public.task_assignees;

create policy task_assignees_insert on public.task_assignees for insert
  with check (handoff.can_assign_to(task_id, organization_member_id));

create policy task_assignees_update on public.task_assignees for update
  using (handoff.can_manage_project(handoff.task_project(task_id)) or handoff.manages_member_team(organization_member_id))
  with check (handoff.can_assign_to(task_id, organization_member_id));

create policy task_assignees_delete on public.task_assignees for delete
  using (handoff.can_manage_project(handoff.task_project(task_id)) or handoff.manages_member_team(organization_member_id));
