-- ============================================================================
-- 0054_mutation_rpc_security.sql
-- Hardens create_bug, create_test_plan, start_security_review
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. create_bug
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_bug(
  p_organization_id uuid,
  p_project_id uuid,
  p_payload jsonb
) RETURNS public.bugs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bug public.bugs;
  v_task_id uuid;
  v_actor_member_id uuid;
BEGIN
  v_actor_member_id := handoff.current_member_id(auth.uid(), p_organization_id);
  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  INSERT INTO public.bugs (
    organization_id, project_id, sprint_id, release_id, incident_id,
    title, environment, severity, priority,
    steps_to_reproduce, expected_result, actual_result, reporter_member_id
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'sprint_id')::uuid,
    (p_payload->>'release_id')::uuid,
    (p_payload->>'incident_id')::uuid,
    p_payload->>'title',
    p_payload->>'environment',
    COALESCE(p_payload->>'severity', 'MODERATE'),
    COALESCE(p_payload->>'priority', 'MEDIUM'),
    p_payload->>'steps_to_reproduce',
    p_payload->>'expected_result',
    p_payload->>'actual_result',
    v_actor_member_id
  ) RETURNING * INTO v_bug;

  IF (p_payload->>'assignee_member_id') IS NOT NULL THEN
    INSERT INTO public.bug_assignments (organization_id, bug_id, member_id, assignment_type, assigned_by_member_id)
    VALUES (p_organization_id, v_bug.id, (p_payload->>'assignee_member_id')::uuid, 'ASSIGNEE', v_actor_member_id);
  END IF;

  IF p_payload->'task_ids' IS NOT NULL AND jsonb_typeof(p_payload->'task_ids') = 'array' THEN
    FOR v_task_id IN SELECT (jsonb_array_elements_text(p_payload->'task_ids'))::uuid LOOP
      INSERT INTO public.bug_tasks (organization_id, bug_id, task_id, linked_by_member_id)
      VALUES (p_organization_id, v_bug.id, v_task_id, v_actor_member_id);
    END LOOP;
  END IF;

  RETURN v_bug;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_bug(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bug(uuid, uuid, jsonb) TO authenticated;
-- Drop the old 4-arg version if it exists
DROP FUNCTION IF EXISTS public.create_bug(uuid, uuid, uuid, jsonb);

-- ----------------------------------------------------------------------------
-- 2. create_test_plan
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_test_plan(
  p_organization_id uuid,
  p_project_id uuid,
  p_payload jsonb
) RETURNS public.test_plans
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.test_plans;
  v_task_id uuid;
  v_reviewer_id uuid;
  v_test_case jsonb;
  v_actor_member_id uuid;
BEGIN
  v_actor_member_id := handoff.current_member_id(auth.uid(), p_organization_id);
  IF v_actor_member_id IS NULL THEN
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

  IF (p_payload->>'owner_member_id') IS NOT NULL THEN
    INSERT INTO public.test_plan_assignments (
      organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_plan.id, (p_payload->>'owner_member_id')::uuid, 'OWNER', v_actor_member_id
    );
  END IF;

  IF p_payload->'reviewer_ids' IS NOT NULL AND jsonb_typeof(p_payload->'reviewer_ids') = 'array' THEN
    FOR v_reviewer_id IN SELECT (jsonb_array_elements_text(p_payload->'reviewer_ids'))::uuid LOOP
      INSERT INTO public.test_plan_assignments (
        organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_reviewer_id, 'REVIEWER', v_actor_member_id
      );
    END LOOP;
  END IF;

  IF p_payload->'task_ids' IS NOT NULL AND jsonb_typeof(p_payload->'task_ids') = 'array' THEN
    FOR v_task_id IN SELECT (jsonb_array_elements_text(p_payload->'task_ids'))::uuid LOOP
      INSERT INTO public.test_plan_tasks (
        organization_id, test_plan_id, task_id, linked_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_task_id, v_actor_member_id
      );
    END LOOP;
  END IF;

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
REVOKE EXECUTE ON FUNCTION public.create_test_plan(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_test_plan(uuid, uuid, jsonb) TO authenticated;
-- Drop the old 4-arg version if it exists
DROP FUNCTION IF EXISTS public.create_test_plan(uuid, uuid, uuid, jsonb);

-- ----------------------------------------------------------------------------
-- 3. start_security_review
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_security_review(
  p_organization_id uuid,
  p_project_id uuid,
  p_payload jsonb
) RETURNS public.security_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_review public.security_reviews;
  v_reviewer_id uuid;
  v_actor_member_id uuid;
BEGIN
  v_actor_member_id := handoff.current_member_id(auth.uid(), p_organization_id);
  IF v_actor_member_id IS NULL THEN
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
    COALESCE(p_payload->>'risk_level', 'LOW'),
    p_payload->>'scope',
    p_payload->>'description',
    CASE WHEN p_payload->>'due_date' IS NOT NULL AND p_payload->>'due_date' != '' THEN (p_payload->>'due_date')::date ELSE NULL END,
    (p_payload->>'reviewer_member_id')::uuid,
    'IN_PROGRESS'
  ) RETURNING * INTO v_review;

  IF p_payload->'additional_reviewer_ids' IS NOT NULL AND jsonb_typeof(p_payload->'additional_reviewer_ids') = 'array' THEN
    FOR v_reviewer_id IN SELECT (jsonb_array_elements_text(p_payload->'additional_reviewer_ids'))::uuid LOOP
      INSERT INTO public.security_review_assignments (
        organization_id, security_review_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_review.id, v_reviewer_id, 'ADDITIONAL_REVIEWER', v_actor_member_id
      );
    END LOOP;
  END IF;

  RETURN v_review;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_security_review(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_security_review(uuid, uuid, jsonb) TO authenticated;
-- Drop the old 4-arg version if it exists
DROP FUNCTION IF EXISTS public.start_security_review(uuid, uuid, uuid, jsonb);
