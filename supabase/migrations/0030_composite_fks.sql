-- ============================================================================
-- Handoff — 0030 Tenant Isolation Triggers (Defense in Depth)
-- ============================================================================
-- Replaced composite foreign keys with BEFORE INSERT/UPDATE triggers. 
-- Composite foreign keys break PostgREST's resource embedding (joins) because 
-- PostgREST cannot map a single column alias (e.g. `assignee:primary_assignee_member_id(...)`)
-- to a composite foreign key `(organization_id, primary_assignee_member_id)`.

-- 1. Triggers for Projects
CREATE OR REPLACE FUNCTION public.check_project_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_owner_org uuid;
  v_pm_org uuid;
  v_port_org uuid;
  v_prog_org uuid;
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_tenant ON public.projects;
CREATE TRIGGER trg_check_project_tenant BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.check_project_tenant();


-- 2. Triggers for Epics
CREATE OR REPLACE FUNCTION public.check_epic_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_owner_org uuid;
  v_proj_org uuid;
BEGIN
  IF NEW.owner_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_owner_org FROM public.organization_members WHERE id = NEW.owner_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_owner_org THEN RAISE EXCEPTION 'Cross-tenant epic owner_member_id' USING ERRCODE = '23503'; END IF;
  END IF;

  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant epic project_id' USING ERRCODE = '23503'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_epic_tenant ON public.epics;
CREATE TRIGGER trg_check_epic_tenant BEFORE INSERT OR UPDATE ON public.epics FOR EACH ROW EXECUTE FUNCTION public.check_epic_tenant();


-- 3. Triggers for Sprints
CREATE OR REPLACE FUNCTION public.check_sprint_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_proj_org uuid;
  v_team_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant sprint project_id' USING ERRCODE = '23503'; END IF;

  IF NEW.team_id IS NOT NULL THEN
    SELECT organization_id INTO v_team_org FROM public.teams WHERE id = NEW.team_id;
    IF NEW.organization_id IS DISTINCT FROM v_team_org THEN RAISE EXCEPTION 'Cross-tenant sprint team_id' USING ERRCODE = '23503'; END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_sprint_tenant ON public.sprints;
CREATE TRIGGER trg_check_sprint_tenant BEFORE INSERT OR UPDATE ON public.sprints FOR EACH ROW EXECUTE FUNCTION public.check_sprint_tenant();


-- 4. Triggers for Tasks
CREATE OR REPLACE FUNCTION public.check_task_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_proj_org uuid;
  v_epic_org uuid;
  v_sprint_org uuid;
  v_reporter_org uuid;
  v_assignee_org uuid;
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_task_tenant ON public.tasks;
CREATE TRIGGER trg_check_task_tenant BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.check_task_tenant();


-- 5. Triggers for junction tables
CREATE OR REPLACE FUNCTION public.check_project_member_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_proj_org uuid;
  v_mem_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  SELECT organization_id INTO v_mem_org FROM public.organization_members WHERE id = NEW.organization_member_id;
  IF v_proj_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for project_members' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_project_member_tenant ON public.project_members;
CREATE TRIGGER trg_check_project_member_tenant BEFORE INSERT OR UPDATE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.check_project_member_tenant();

CREATE OR REPLACE FUNCTION public.check_task_assignee_tenant() RETURNS TRIGGER AS $$
DECLARE
  v_task_org uuid;
  v_mem_org uuid;
BEGIN
  SELECT organization_id INTO v_task_org FROM public.tasks WHERE id = NEW.task_id;
  SELECT organization_id INTO v_mem_org FROM public.organization_members WHERE id = NEW.organization_member_id;
  IF v_task_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for task_assignees' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_task_assignee_tenant ON public.task_assignees;
CREATE TRIGGER trg_check_task_assignee_tenant BEFORE INSERT OR UPDATE ON public.task_assignees FOR EACH ROW EXECUTE FUNCTION public.check_task_assignee_tenant();
