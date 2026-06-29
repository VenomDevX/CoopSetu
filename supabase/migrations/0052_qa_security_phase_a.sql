-- Migration 0052: QA & Security Phase A enhancements

-- ----------------------------------------------------------------------------
-- 1. BUGS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bug_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bug_id uuid NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN ('PRIMARY', 'ADDITIONAL', 'REVIEWER', 'OBSERVER')),
  assigned_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT handoff.attach_updated_at('public.bug_assignees');

CREATE UNIQUE INDEX IF NOT EXISTS bug_assignees_one_active_member_idx
  ON public.bug_assignees(bug_id, member_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS bug_assignees_org_member_idx
  ON public.bug_assignees(organization_id, member_id);

CREATE TABLE IF NOT EXISTS public.bug_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bug_id uuid NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  actor_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bug_activity_bug_idx ON public.bug_activity(bug_id);

CREATE TABLE IF NOT EXISTS public.bug_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bug_id uuid NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES public.attachments(id) ON DELETE CASCADE,
  uploaded_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bug_attachments_bug_idx ON public.bug_attachments(bug_id);

-- Enforce private task visibility on bugs
DROP POLICY IF EXISTS bugs_select ON public.bugs;
CREATE POLICY bugs_select ON public.bugs FOR SELECT
USING (
  handoff.can_view_project(project_id) AND
  (task_id IS NULL OR handoff.can_view_task(task_id))
);

DROP POLICY IF EXISTS bugs_manage ON public.bugs;
CREATE POLICY bugs_manage ON public.bugs FOR ALL
USING (
  handoff.can_view_project(project_id) AND
  (task_id IS NULL OR handoff.can_view_task(task_id))
) WITH CHECK (
  handoff.can_view_project(project_id) AND
  (task_id IS NULL OR handoff.can_view_task(task_id))
);

-- RLS for bug assignees
ALTER TABLE public.bug_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY bug_assignees_select ON public.bug_assignees FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.bugs WHERE id = bug_id AND
    handoff.can_view_project(project_id) AND
    (task_id IS NULL OR handoff.can_view_task(task_id))
  )
);
CREATE POLICY bug_assignees_manage ON public.bug_assignees FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.bugs WHERE id = bug_id AND
    handoff.can_view_project(project_id) AND
    (task_id IS NULL OR handoff.can_view_task(task_id))
  )
);

-- RLS for bug activity
ALTER TABLE public.bug_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY bug_activity_select ON public.bug_activity FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.bugs WHERE id = bug_id AND
    handoff.can_view_project(project_id) AND
    (task_id IS NULL OR handoff.can_view_task(task_id))
  )
);

-- RLS for bug attachments
ALTER TABLE public.bug_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY bug_attachments_select ON public.bug_attachments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.bugs WHERE id = bug_id AND
    handoff.can_view_project(project_id) AND
    (task_id IS NULL OR handoff.can_view_task(task_id))
  )
);

-- ----------------------------------------------------------------------------
-- 2. TEST PLANS
-- ----------------------------------------------------------------------------

ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS acceptance_criteria text;

CREATE TABLE IF NOT EXISTS public.test_plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  linked_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS test_plan_tasks_unique_idx ON public.test_plan_tasks(test_plan_id, task_id);

CREATE TABLE IF NOT EXISTS public.test_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'REVIEWER' CHECK (assignment_type IN ('OWNER', 'REVIEWER', 'ADDITIONAL')),
  assigned_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT handoff.attach_updated_at('public.test_plan_assignments');
CREATE UNIQUE INDEX IF NOT EXISTS test_plan_assignments_one_active_member_idx
  ON public.test_plan_assignments(test_plan_id, member_id) WHERE removed_at IS NULL;

-- RLS
ALTER TABLE public.test_plan_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_plan_tasks_select ON public.test_plan_tasks FOR SELECT USING (handoff.can_view_project((SELECT project_id FROM public.test_plans WHERE id = test_plan_id)));
CREATE POLICY test_plan_tasks_manage ON public.test_plan_tasks FOR ALL USING (handoff.can_view_project((SELECT project_id FROM public.test_plans WHERE id = test_plan_id)));

ALTER TABLE public.test_plan_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_plan_assignments_select ON public.test_plan_assignments FOR SELECT USING (handoff.can_view_project((SELECT project_id FROM public.test_plans WHERE id = test_plan_id)));
CREATE POLICY test_plan_assignments_manage ON public.test_plan_assignments FOR ALL USING (handoff.can_view_project((SELECT project_id FROM public.test_plans WHERE id = test_plan_id)));

-- ----------------------------------------------------------------------------
-- 3. SECURITY REVIEWS
-- ----------------------------------------------------------------------------

ALTER TABLE public.security_reviews
  ADD COLUMN IF NOT EXISTS repository_id uuid REFERENCES public.repositories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.security_review_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  security_review_id uuid NOT NULL REFERENCES public.security_reviews(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'REVIEWER' CHECK (assignment_type IN ('PRIMARY', 'REVIEWER', 'OBSERVER')),
  assigned_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT handoff.attach_updated_at('public.security_review_assignees');
CREATE UNIQUE INDEX IF NOT EXISTS security_review_assignees_one_active_idx
  ON public.security_review_assignees(security_review_id, member_id) WHERE removed_at IS NULL;

ALTER TABLE public.security_review_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY sec_review_assignees_select ON public.security_review_assignees FOR SELECT USING (handoff.can_view_project((SELECT project_id FROM public.security_reviews WHERE id = security_review_id)));
CREATE POLICY sec_review_assignees_manage ON public.security_review_assignees FOR ALL USING (handoff.can_view_project((SELECT project_id FROM public.security_reviews WHERE id = security_review_id)));

-- ----------------------------------------------------------------------------
-- 4. RPCs for atomic operations
-- ----------------------------------------------------------------------------

-- CREATE BUG
CREATE OR REPLACE FUNCTION public.create_bug(
  p_organization_id uuid,
  p_project_id uuid,
  p_payload jsonb
) RETURNS public.bugs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bug public.bugs;
  v_assignee_id uuid;
  v_member_id uuid;
  v_actor_member_id uuid;
BEGIN
  -- 1. Validate org
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- 2. Verify permissions (the API layer should have checked this, but safety first)
  IF NOT handoff.can_view_project(p_project_id) THEN
    RAISE EXCEPTION 'Project not accessible';
  END IF;

  -- Task visibility check
  IF (p_payload->>'task_id') IS NOT NULL THEN
    IF NOT handoff.can_view_task((p_payload->>'task_id')::uuid) THEN
      RAISE EXCEPTION 'Task not accessible';
    END IF;
  END IF;

  -- 3. Get actor
  SELECT id INTO v_actor_member_id FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = auth.uid() AND is_active = true
  LIMIT 1;

  -- 4. Insert Bug
  INSERT INTO public.bugs (
    organization_id,
    project_id,
    task_id,
    release_id,
    title,
    description,
    severity,
    priority,
    status,
    environment,
    reporter_member_id,
    assignee_member_id,
    steps_to_reproduce,
    expected_result,
    actual_result
  ) VALUES (
    p_organization_id,
    p_project_id,
    (p_payload->>'task_id')::uuid,
    (p_payload->>'release_id')::uuid,
    p_payload->>'title',
    p_payload->>'description',
    COALESCE(p_payload->>'severity', 'MEDIUM'),
    COALESCE(p_payload->>'priority', 'MEDIUM'),
    'OPEN',
    p_payload->>'environment',
    (p_payload->>'reporter_member_id')::uuid,
    (p_payload->>'primary_assignee_member_id')::uuid,
    p_payload->>'steps_to_reproduce',
    p_payload->>'expected_result',
    p_payload->>'actual_result'
  ) RETURNING * INTO v_bug;

  -- 5. Insert Primary Assignee
  IF (p_payload->>'primary_assignee_member_id') IS NOT NULL THEN
    INSERT INTO public.bug_assignees (
      organization_id, bug_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_bug.id, (p_payload->>'primary_assignee_member_id')::uuid, 'PRIMARY', v_actor_member_id
    );
  END IF;

  -- 6. Insert Additional Assignees
  IF p_payload->'additional_assignee_ids' IS NOT NULL THEN
    FOR v_assignee_id IN SELECT jsonb_array_elements_text(p_payload->'additional_assignee_ids')::uuid LOOP
      INSERT INTO public.bug_assignees (
        organization_id, bug_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_bug.id, v_assignee_id, 'ADDITIONAL', v_actor_member_id
      );
    END LOOP;
  END IF;

  -- 7. Bug Activity
  INSERT INTO public.bug_activity (
    organization_id, bug_id, actor_member_id, action_type, new_data
  ) VALUES (
    p_organization_id, v_bug.id, v_actor_member_id, 'CREATED', p_payload
  );

  RETURN v_bug;
END;
$$;

-- CREATE TEST PLAN
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
  v_actor_member_id uuid;
  v_test_case jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  IF NOT handoff.can_view_project(p_project_id) THEN
    RAISE EXCEPTION 'Project not accessible';
  END IF;

  SELECT id INTO v_actor_member_id FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = auth.uid() AND is_active = true
  LIMIT 1;

  INSERT INTO public.test_plans (
    organization_id,
    project_id,
    sprint_id,
    release_id,
    title,
    environment,
    scope,
    acceptance_criteria,
    due_date,
    owner_member_id
  ) VALUES (
    p_organization_id,
    p_project_id,
    (p_payload->>'sprint_id')::uuid,
    (p_payload->>'release_id')::uuid,
    p_payload->>'title',
    p_payload->>'environment',
    p_payload->>'scope',
    p_payload->>'acceptance_criteria',
    (p_payload->>'due_date')::date,
    (p_payload->>'owner_member_id')::uuid
  ) RETURNING * INTO v_plan;

  -- Insert Owner assignment
  IF (p_payload->>'owner_member_id') IS NOT NULL THEN
    INSERT INTO public.test_plan_assignments (
      organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_plan.id, (p_payload->>'owner_member_id')::uuid, 'OWNER', v_actor_member_id
    );
  END IF;

  -- Additional Reviewers
  IF p_payload->'reviewer_ids' IS NOT NULL THEN
    FOR v_reviewer_id IN SELECT jsonb_array_elements_text(p_payload->'reviewer_ids')::uuid LOOP
      INSERT INTO public.test_plan_assignments (
        organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_reviewer_id, 'REVIEWER', v_actor_member_id
      );
    END LOOP;
  END IF;

  -- Linked Tasks
  IF p_payload->'task_ids' IS NOT NULL THEN
    FOR v_task_id IN SELECT jsonb_array_elements_text(p_payload->'task_ids')::uuid LOOP
      INSERT INTO public.test_plan_tasks (
        organization_id, test_plan_id, task_id, linked_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_task_id, v_actor_member_id
      );
    END LOOP;
  END IF;

  -- Test Cases
  IF p_payload->'test_cases' IS NOT NULL THEN
    FOR v_test_case IN SELECT * FROM jsonb_array_elements(p_payload->'test_cases') LOOP
      INSERT INTO public.test_cases (
        organization_id,
        project_id,
        test_plan_id,
        title,
        preconditions,
        steps,
        expected_result,
        priority
      ) VALUES (
        p_organization_id,
        p_project_id,
        v_plan.id,
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

-- START SECURITY REVIEW
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
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  IF NOT handoff.can_view_project(p_project_id) THEN
    RAISE EXCEPTION 'Project not accessible';
  END IF;

  SELECT id INTO v_actor_member_id FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = auth.uid() AND is_active = true
  LIMIT 1;

  INSERT INTO public.security_reviews (
    organization_id,
    project_id,
    release_id,
    repository_id,
    task_id,
    title,
    risk_level,
    scope,
    description,
    due_date,
    reviewer_member_id,
    status
  ) VALUES (
    p_organization_id,
    p_project_id,
    (p_payload->>'release_id')::uuid,
    (p_payload->>'repository_id')::uuid,
    (p_payload->>'task_id')::uuid,
    p_payload->>'title',
    COALESCE(p_payload->>'risk_level', 'MEDIUM'),
    p_payload->>'scope',
    p_payload->>'description',
    (p_payload->>'due_date')::date,
    (p_payload->>'reviewer_member_id')::uuid,
    'PENDING'
  ) RETURNING * INTO v_review;

  -- Insert Primary Reviewer
  IF (p_payload->>'reviewer_member_id') IS NOT NULL THEN
    INSERT INTO public.security_review_assignees (
      organization_id, security_review_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_review.id, (p_payload->>'reviewer_member_id')::uuid, 'PRIMARY', v_actor_member_id
    );
  END IF;

  -- Additional Reviewers
  IF p_payload->'additional_reviewer_ids' IS NOT NULL THEN
    FOR v_reviewer_id IN SELECT jsonb_array_elements_text(p_payload->'additional_reviewer_ids')::uuid LOOP
      INSERT INTO public.security_review_assignees (
        organization_id, security_review_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_review.id, v_reviewer_id, 'REVIEWER', v_actor_member_id
      );
    END LOOP;
  END IF;

  RETURN v_review;
END;
$$;
