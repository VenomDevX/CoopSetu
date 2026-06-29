-- ============================================================================
-- Handoff — 0032 Security Advisor Fixes
-- Fixes three categories of Supabase security advisor warnings:
--   1. Auth RLS Initialization Plan  — use (select auth.uid()) in helper fns
--   2. Function Search Path Mutable  — add SET search_path to all functions
--   3. Multiple Permissive Policies  — drop redundant FOR SELECT policies
--      where a FOR ALL policy already covers the same operation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix Auth RLS Initialization Plan + search_path on RLS helper functions
--    (originally defined in 0003_rls_helpers_and_catalogue.sql)
--    Change bare auth.uid() → (select auth.uid()) so PostgreSQL treats it as
--    a stable scalar subquery evaluated once per statement, not per row.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handoff.current_member_id(p_org uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id
  FROM public.organization_members m
  WHERE m.organization_id = p_org
    AND m.user_id = (SELECT auth.uid())
    AND m.is_active
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION handoff.is_org_member(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active
  );
$$;

CREATE OR REPLACE FUNCTION handoff.has_permission(p_org uuid, p_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.member_roles mr ON mr.organization_member_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active
      AND (
        r.code IN ('SUPER_ADMIN', 'ORG_ADMIN')
        OR rp.permission_code = p_perm
      )
  );
$$;

CREATE OR REPLACE FUNCTION handoff.has_role(p_org uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.member_roles mr ON mr.organization_member_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active
      AND r.code = ANY(p_roles)
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Fix Function Search Path Mutable
--    Functions in 0001 and 0030 that were missing SET search_path.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handoff.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handoff.attach_updated_at(p_table regclass)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trig_name text := 'set_updated_at_' || replace(p_table::text, '.', '_');
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s;', trig_name, p_table);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION handoff.set_updated_at();',
    trig_name, p_table
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_project_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_owner_org uuid; v_pm_org uuid; v_port_org uuid; v_prog_org uuid;
BEGIN
  IF NEW.owner_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_owner_org FROM public.organization_members WHERE id = NEW.owner_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_owner_org THEN RAISE EXCEPTION 'Cross-tenant owner_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.project_manager_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_pm_org FROM public.organization_members WHERE id = NEW.project_manager_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_pm_org THEN RAISE EXCEPTION 'Cross-tenant project_manager_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.portfolio_id IS NOT NULL THEN
    SELECT organization_id INTO v_port_org FROM public.portfolios WHERE id = NEW.portfolio_id;
    IF NEW.organization_id IS DISTINCT FROM v_port_org THEN RAISE EXCEPTION 'Cross-tenant portfolio_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.program_id IS NOT NULL THEN
    SELECT organization_id INTO v_prog_org FROM public.programs WHERE id = NEW.program_id;
    IF NEW.organization_id IS DISTINCT FROM v_prog_org THEN RAISE EXCEPTION 'Cross-tenant program_id' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_epic_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_owner_org uuid; v_proj_org uuid;
BEGIN
  IF NEW.owner_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_owner_org FROM public.organization_members WHERE id = NEW.owner_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_owner_org THEN RAISE EXCEPTION 'Cross-tenant epic owner_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant epic project_id' USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_sprint_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_proj_org uuid; v_team_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant sprint project_id' USING ERRCODE = '23503'; END IF;
  IF NEW.team_id IS NOT NULL THEN
    SELECT organization_id INTO v_team_org FROM public.teams WHERE id = NEW.team_id;
    IF NEW.organization_id IS DISTINCT FROM v_team_org THEN RAISE EXCEPTION 'Cross-tenant sprint team_id' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_task_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_proj_org uuid; v_epic_org uuid; v_sprint_org uuid; v_reporter_org uuid; v_assignee_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant task project_id' USING ERRCODE = '23503'; END IF;
  IF NEW.epic_id IS NOT NULL THEN
    SELECT organization_id INTO v_epic_org FROM public.epics WHERE id = NEW.epic_id;
    IF NEW.organization_id IS DISTINCT FROM v_epic_org THEN RAISE EXCEPTION 'Cross-tenant task epic_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.sprint_id IS NOT NULL THEN
    SELECT organization_id INTO v_sprint_org FROM public.sprints WHERE id = NEW.sprint_id;
    IF NEW.organization_id IS DISTINCT FROM v_sprint_org THEN RAISE EXCEPTION 'Cross-tenant task sprint_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.reporter_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_reporter_org FROM public.organization_members WHERE id = NEW.reporter_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_reporter_org THEN RAISE EXCEPTION 'Cross-tenant task reporter_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.primary_assignee_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_assignee_org FROM public.organization_members WHERE id = NEW.primary_assignee_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_assignee_org THEN RAISE EXCEPTION 'Cross-tenant task primary_assignee_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_project_member_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_proj_org uuid; v_mem_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  SELECT organization_id INTO v_mem_org FROM public.organization_members WHERE id = NEW.organization_member_id;
  IF v_proj_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for project_members' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_task_assignee_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_task_org uuid; v_mem_org uuid;
BEGIN
  SELECT organization_id INTO v_task_org FROM public.tasks WHERE id = NEW.task_id;
  SELECT organization_id INTO v_mem_org FROM public.organization_members WHERE id = NEW.organization_member_id;
  IF v_task_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for task_assignees' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ----------------------------------------------------------------------------
-- 3. Fix Multiple Permissive Policies
--    Each table has both a FOR SELECT and a FOR ALL policy — the FOR SELECT is
--    redundant because FOR ALL already covers SELECT. Drop the extras.
-- ----------------------------------------------------------------------------

-- programs
DROP POLICY IF EXISTS programs_select ON public.programs;

-- project_dependencies
DROP POLICY IF EXISTS deps_select ON public.project_dependencies;

-- presence_sessions
DROP POLICY IF EXISTS presence_select ON public.presence_sessions;

-- approval_requests
DROP POLICY IF EXISTS appr_req_select ON public.approval_requests;

-- ai_settings
DROP POLICY IF EXISTS ai_settings_select ON public.ai_settings;
