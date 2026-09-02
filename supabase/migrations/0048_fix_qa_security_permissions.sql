-- ============================================================================
-- Handoff — 0048 Fix QA/Security Phase A permissions & RPCs
-- ============================================================================
-- Adds missing permissions, grants them to appropriate roles, and rewrites
-- the Phase A RPCs to accept the actor member ID as a parameter instead of
-- relying on auth.uid() (which is null when called from the service-role client).

-- 1. Add missing permissions
INSERT INTO public.permissions (code, description) VALUES
  ('bug:create', 'Create bug reports'),
  ('bug:view', 'View bug reports'),
  ('bug:update', 'Update bug reports'),
  ('test_plan:create', 'Create test plans'),
  ('test_plan:view', 'View test plans'),
  ('test_plan:update', 'Update test plans'),
  ('security_review:create', 'Start security reviews'),
  ('security_review:view', 'View security reviews'),
  ('security_review:update', 'Update security reviews')
ON CONFLICT (code) DO NOTHING;

-- 2. Grant to roles (same pattern as 0041)
DO $$
DECLARE r RECORD;
BEGIN
  -- ORG_OWNER gets everything
  FOR r IN SELECT id FROM public.roles WHERE code = 'ORG_OWNER' AND organization_id IS NULL LOOP
    INSERT INTO public.role_permissions (role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    WHERE code IN (
      'bug:create','bug:view','bug:update',
      'test_plan:create','test_plan:view','test_plan:update',
      'security_review:create','security_review:view','security_review:update'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Managers get create/view/update
  FOR r IN SELECT id FROM public.roles
           WHERE code IN ('PROJECT_MANAGER','ENGINEERING_MANAGER','TEAM_LEAD')
             AND organization_id IS NULL LOOP
    INSERT INTO public.role_permissions (role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    WHERE code IN (
      'bug:create','bug:view','bug:update',
      'test_plan:create','test_plan:view','test_plan:update',
      'security_review:create','security_review:view','security_review:update'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- QA_ENGINEER gets QA permissions
  FOR r IN SELECT id FROM public.roles WHERE code = 'QA_ENGINEER' AND organization_id IS NULL LOOP
    INSERT INTO public.role_permissions (role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    WHERE code IN (
      'bug:create','bug:view','bug:update',
      'test_plan:create','test_plan:view','test_plan:update',
      'security_review:view'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- SECURITY_ENGINEER gets security permissions
  FOR r IN SELECT id FROM public.roles WHERE code = 'SECURITY_ENGINEER' AND organization_id IS NULL LOOP
    INSERT INTO public.role_permissions (role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    WHERE code IN (
      'bug:view',
      'test_plan:view',
      'security_review:create','security_review:view','security_review:update'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- DEVELOPER gets bug create/view and test plan view
  FOR r IN SELECT id FROM public.roles WHERE code = 'DEVELOPER' AND organization_id IS NULL LOOP
    INSERT INTO public.role_permissions (role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    WHERE code IN ('bug:create','bug:view','test_plan:view','security_review:view')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- CEO/CTO/AUDITOR get view permissions
  FOR r IN SELECT id FROM public.roles WHERE code IN ('CEO','CTO','AUDITOR') AND organization_id IS NULL LOOP
    INSERT INTO public.role_permissions (role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    WHERE code IN ('bug:view','test_plan:view','security_review:view')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 3. Rewrite RPCs to accept actor_member_id parameter
-- This avoids the auth.uid() null problem when called from the service-role client.

-- CREATE BUG
CREATE OR REPLACE FUNCTION public.create_bug(
  p_organization_id uuid,
  p_project_id uuid,
  p_actor_member_id uuid,
  p_payload jsonb
) RETURNS public.bugs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bug public.bugs;
  v_assignee_id uuid;
BEGIN
  -- Validate org
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Validate actor is active member of org
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE id = p_actor_member_id AND organization_id = p_organization_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  -- Insert Bug
  INSERT INTO public.bugs (
    organization_id, project_id, task_id, release_id,
    title, description, severity, priority, status, environment,
    reporter_member_id, assignee_member_id,
    steps_to_reproduce, expected_result, actual_result
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'task_id')::uuid,
    (p_payload->>'release_id')::uuid,
    p_payload->>'title',
    p_payload->>'description',
    COALESCE(p_payload->>'severity', 'MEDIUM'),
    COALESCE(p_payload->>'priority', 'MEDIUM'),
    'OPEN',
    p_payload->>'environment',
    p_actor_member_id,
    (p_payload->>'primary_assignee_member_id')::uuid,
    p_payload->>'steps_to_reproduce',
    p_payload->>'expected_result',
    p_payload->>'actual_result'
  ) RETURNING * INTO v_bug;

  -- Insert Primary Assignee
  IF (p_payload->>'primary_assignee_member_id') IS NOT NULL THEN
    INSERT INTO public.bug_assignees (
      organization_id, bug_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_bug.id, (p_payload->>'primary_assignee_member_id')::uuid, 'PRIMARY', p_actor_member_id
    );
  END IF;

  -- Insert Additional Assignees
  IF p_payload->'additional_assignee_ids' IS NOT NULL AND jsonb_typeof(p_payload->'additional_assignee_ids') = 'array' THEN
    FOR v_assignee_id IN SELECT (jsonb_array_elements_text(p_payload->'additional_assignee_ids'))::uuid LOOP
      INSERT INTO public.bug_assignees (
        organization_id, bug_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_bug.id, v_assignee_id, 'ADDITIONAL', p_actor_member_id
      );
    END LOOP;
  END IF;

  -- Bug Activity
  INSERT INTO public.bug_activity (
    organization_id, bug_id, actor_member_id, action_type, new_data
  ) VALUES (
    p_organization_id, v_bug.id, p_actor_member_id, 'CREATED', p_payload
  );

  RETURN v_bug;
END;
$$;

-- Drop old 3-arg version if it exists
DROP FUNCTION IF EXISTS public.create_bug(uuid, uuid, jsonb);

-- CREATE TEST PLAN
CREATE OR REPLACE FUNCTION public.create_test_plan(
  p_organization_id uuid,
  p_project_id uuid,
  p_actor_member_id uuid,
  p_payload jsonb
) RETURNS public.test_plans
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.test_plans;
  v_task_id uuid;
  v_reviewer_id uuid;
  v_test_case jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE id = p_actor_member_id AND organization_id = p_organization_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  INSERT INTO public.test_plans (
    organization_id, project_id, sprint_id, release_id,
    title, environment, scope, acceptance_criteria, due_date, owner_member_id
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'sprint_id')::uuid,
    (p_payload->>'release_id')::uuid,
    p_payload->>'title',
    p_payload->>'environment',
    p_payload->>'scope',
    p_payload->>'acceptance_criteria',
    CASE WHEN p_payload->>'due_date' IS NOT NULL AND p_payload->>'due_date' != '' THEN (p_payload->>'due_date')::date ELSE NULL END,
    (p_payload->>'owner_member_id')::uuid
  ) RETURNING * INTO v_plan;

  -- Insert Owner assignment
  IF (p_payload->>'owner_member_id') IS NOT NULL THEN
    INSERT INTO public.test_plan_assignments (
      organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_plan.id, (p_payload->>'owner_member_id')::uuid, 'OWNER', p_actor_member_id
    );
  END IF;

  -- Additional Reviewers
  IF p_payload->'reviewer_ids' IS NOT NULL AND jsonb_typeof(p_payload->'reviewer_ids') = 'array' THEN
    FOR v_reviewer_id IN SELECT (jsonb_array_elements_text(p_payload->'reviewer_ids'))::uuid LOOP
      INSERT INTO public.test_plan_assignments (
        organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_reviewer_id, 'REVIEWER', p_actor_member_id
      );
    END LOOP;
  END IF;

  -- Linked Tasks
  IF p_payload->'task_ids' IS NOT NULL AND jsonb_typeof(p_payload->'task_ids') = 'array' THEN
    FOR v_task_id IN SELECT (jsonb_array_elements_text(p_payload->'task_ids'))::uuid LOOP
      INSERT INTO public.test_plan_tasks (
        organization_id, test_plan_id, task_id, linked_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_task_id, p_actor_member_id
      );
    END LOOP;
  END IF;

  -- Test Cases
  IF p_payload->'test_cases' IS NOT NULL AND jsonb_typeof(p_payload->'test_cases') = 'array' THEN
    FOR v_test_case IN SELECT * FROM jsonb_array_elements(p_payload->'test_cases') LOOP
      INSERT INTO public.test_cases (
        organization_id, project_id, test_plan_id,
        title, preconditions, steps, expected_result, priority
      ) VALUES (
        p_organization_id, p_project_id, v_plan.id,
        v_test_case->>'title',
        v_test_case->>'preconditions',
        v_test_case->>'steps',
        v_test_case->>'expected_result',
        COALESCE(v_test_case->>'priority', 'MEDIUM')
      );
    END LOOP;
  END IF;

  RETURN v_plan;
END;
$$;

-- Drop old 3-arg version
DROP FUNCTION IF EXISTS public.create_test_plan(uuid, uuid, jsonb);

-- START SECURITY REVIEW
CREATE OR REPLACE FUNCTION public.start_security_review(
  p_organization_id uuid,
  p_project_id uuid,
  p_actor_member_id uuid,
  p_payload jsonb
) RETURNS public.security_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_review public.security_reviews;
  v_reviewer_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE id = p_actor_member_id AND organization_id = p_organization_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  INSERT INTO public.security_reviews (
    organization_id, project_id, release_id, repository_id, task_id,
    title, risk_level, scope, description, due_date,
    reviewer_member_id, status
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'release_id')::uuid,
    (p_payload->>'repository_id')::uuid,
    (p_payload->>'task_id')::uuid,
    p_payload->>'title',
    COALESCE(p_payload->>'risk_level', 'MEDIUM'),
    p_payload->>'scope',
    p_payload->>'description',
    CASE WHEN p_payload->>'due_date' IS NOT NULL AND p_payload->>'due_date' != '' THEN (p_payload->>'due_date')::date ELSE NULL END,
    (p_payload->>'reviewer_member_id')::uuid,
    'PENDING'
  ) RETURNING * INTO v_review;

  -- Insert Primary Reviewer
  IF (p_payload->>'reviewer_member_id') IS NOT NULL THEN
    INSERT INTO public.security_review_assignees (
      organization_id, security_review_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_review.id, (p_payload->>'reviewer_member_id')::uuid, 'PRIMARY', p_actor_member_id
    );
  END IF;

  -- Additional Reviewers
  IF p_payload->'additional_reviewer_ids' IS NOT NULL AND jsonb_typeof(p_payload->'additional_reviewer_ids') = 'array' THEN
    FOR v_reviewer_id IN SELECT (jsonb_array_elements_text(p_payload->'additional_reviewer_ids'))::uuid LOOP
      INSERT INTO public.security_review_assignees (
        organization_id, security_review_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_review.id, v_reviewer_id, 'REVIEWER', p_actor_member_id
      );
    END LOOP;
  END IF;

  RETURN v_review;
END;
$$;

-- Drop old 3-arg version
DROP FUNCTION IF EXISTS public.start_security_review(uuid, uuid, jsonb);
