-- ============================================================================
-- Handoff — 0053 Security Acceptance Fixes
-- ============================================================================
-- Hardening of SECURITY DEFINER RPCs and Approval visibility
-- ============================================================================

-- 1. Helper function for release visibility
CREATE OR REPLACE FUNCTION handoff.can_view_release(p_release uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT handoff.can_view_project(project_id) FROM public.releases WHERE id = p_release;
$$;

-- 1b. release_can_deploy (Fixed scoping)
REVOKE EXECUTE ON FUNCTION public.release_can_deploy(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_can_deploy(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_can_deploy(p_release uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_req_comp boolean;
  v_req text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT r.organization_id, r.requires_compliance_approval 
  INTO v_org_id, v_req_comp 
  FROM public.releases r 
  WHERE r.id = p_release;

  IF v_org_id IS NULL THEN RETURN false; END IF;
  IF NOT handoff.is_org_member(v_org_id) THEN RETURN false; END IF;
  IF NOT handoff.can_view_release(p_release) THEN RETURN false; END IF;

  FOR v_req IN SELECT unnest(
    CASE WHEN v_req_comp THEN array['QA','SECURITY','COMPLIANCE','RELEASE_MANAGER']
    ELSE array['QA','SECURITY','RELEASE_MANAGER'] END
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.release_approvals ra
      WHERE ra.release_id = p_release AND ra.approval_type = v_req AND ra.status = 'APPROVED'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- 2. create_project (Fixed input trust)
REVOKE EXECUTE ON FUNCTION public.create_project(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project(p_org uuid, p_payload jsonb)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proj public.projects;
  v_owner uuid;
  v_pm uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING errcode = '28000'; END IF;
  IF NOT handoff.is_org_member(p_org) THEN RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF NOT handoff.has_permission(p_org, 'project:create') THEN RAISE EXCEPTION 'FORBIDDEN: project:create' USING errcode = '42501'; END IF;

  v_owner := (p_payload->>'owner_member_id')::uuid;
  v_pm := (p_payload->>'project_manager_member_id')::uuid;

  IF v_owner IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE id = v_owner AND organization_id = p_org AND is_active = true) THEN
      RAISE EXCEPTION 'INVALID_OWNER';
    END IF;
  END IF;

  IF v_pm IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE id = v_pm AND organization_id = p_org AND is_active = true) THEN
      RAISE EXCEPTION 'INVALID_PROJECT_MANAGER';
    END IF;
  END IF;

  INSERT INTO public.projects (
    organization_id, name, code, description, business_objective, scope,
    portfolio_id, program_id, owner_member_id, project_manager_member_id,
    status, priority, security_classification,
    start_date, target_end_date, budget_amount, effort_estimate_hours
  ) VALUES (
    p_org,
    p_payload->>'name',
    p_payload->>'code',
    nullif(p_payload->>'description', ''),
    nullif(p_payload->>'business_objective', ''),
    nullif(p_payload->>'scope', ''),
    (p_payload->>'portfolio_id')::uuid,
    (p_payload->>'program_id')::uuid,
    v_owner,
    v_pm,
    coalesce(nullif(p_payload->>'status', ''), 'PLANNING'),
    coalesce(nullif(p_payload->>'priority', ''), 'MEDIUM'),
    coalesce(nullif(p_payload->>'security_classification', ''), 'INTERNAL'),
    (p_payload->>'start_date')::date,
    (p_payload->>'target_end_date')::date,
    (p_payload->>'budget_amount')::numeric,
    (p_payload->>'effort_estimate_hours')::numeric
  )
  RETURNING * INTO v_proj;

  RETURN v_proj;
END;
$$;

-- 3. create_project_team (Prevent org enum)
REVOKE EXECUTE ON FUNCTION public.create_project_team FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_team TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_team(
  p_project_id uuid,
  p_team_name text,
  p_team_code text default null,
  p_description text default null
)
RETURNS public.teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project public.projects;
  v_org_id uuid;
  v_team public.teams;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_project IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  
  v_org_id := v_project.organization_id;

  SELECT id INTO v_member_id FROM public.organization_members WHERE user_id = v_uid AND organization_id = v_org_id AND is_active = true;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND'; -- Disguise cross-org access as 404
  END IF;

  IF NOT handoff.can_manage_project(p_project_id) THEN
    RAISE EXCEPTION 'NOT_PROJECT_MANAGER';
  END IF;

  IF NOT handoff.has_permission(v_org_id, 'team:create_project_team') THEN
    RAISE EXCEPTION 'MISSING_PERMISSION_CREATE_PROJECT_TEAM';
  END IF;

  INSERT INTO public.teams (
    organization_id, name, code, description, team_type, created_by_member_id
  ) VALUES (
    v_org_id, p_team_name, p_team_code, p_description, 'PROJECT_TEAM', v_member_id
  ) RETURNING * INTO v_team;

  INSERT INTO public.project_teams (
    project_id, team_id
  ) VALUES (
    p_project_id, v_team.id
  );

  RETURN v_team;
END;
$$;

-- 4. member_permissions
REVOKE EXECUTE ON FUNCTION public.member_permissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_permissions(uuid) TO authenticated;

-- (It's already safe but let's redefine to be absolutely sure search_path and auth.uid() are exact)
CREATE OR REPLACE FUNCTION public.member_permissions(p_member uuid)
RETURNS table (permission_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  with m as (
    select * from public.organization_members where id = p_member and user_id = auth.uid() and is_active = true
  )
  select distinct p.code
  from m
  cross join public.permissions p
  where exists (
    select 1
    from public.member_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.organization_member_id = m.id
      and r.code in ('SUPER_ADMIN','ORG_ADMIN','ORG_OWNER')
  )
  union
  select distinct rp.permission_code
  from m
  join public.member_roles mr on mr.organization_member_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id;
$$;


-- 5. Approval Request Visibility
DROP POLICY IF EXISTS appr_req_select ON public.approval_requests;
CREATE POLICY appr_req_select ON public.approval_requests 
  FOR SELECT 
  USING (
    handoff.is_org_member(organization_id)
    AND (
      -- If they requested it or are assigned to approve it, they can see it (if they are still active members)
      requested_by_member_id = handoff.current_member_id(organization_id)
      OR EXISTS (SELECT 1 FROM public.approvals a WHERE a.approval_request_id = id AND a.approver_member_id = handoff.current_member_id(organization_id))
      -- Or if they can see the linked entities:
      OR (
        (project_id IS NULL OR handoff.can_view_project(project_id))
        AND (task_id IS NULL OR handoff.can_view_task(task_id))
        AND (release_id IS NULL OR handoff.can_view_release(release_id))
      )
    )
  );
