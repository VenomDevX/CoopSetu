-- ============================================================================
-- Handoff - Private task visibility, assignment history, and realtime-safe RLS
-- ============================================================================

-- ---------------------------------------------------------------- permissions -
INSERT INTO public.permissions (code, description) VALUES
  ('task:view_team_assignments', 'View private tasks assigned to directly managed team members')
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, code
    FROM public.roles
    WHERE organization_id IS NULL
      AND code IN ('ORG_OWNER', 'ORG_ADMIN', 'SUPER_ADMIN', 'TEAM_MANAGER', 'ENGINEERING_MANAGER', 'TEAM_LEAD')
  LOOP
    INSERT INTO public.role_permissions(role_id, permission_code)
    VALUES (r.id, 'task:view_team_assignments')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ORG_OWNER is full-access in the UI permission resolver as well as RLS.
  FOR r IN SELECT id FROM public.roles WHERE organization_id IS NULL AND code = 'ORG_OWNER' LOOP
    INSERT INTO public.role_permissions(role_id, permission_code)
    SELECT r.id, code FROM public.permissions
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Keep ORG_OWNER in the central permission helper after the later hardening
-- migrations rewrote this function.
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
        r.code IN ('SUPER_ADMIN', 'ORG_ADMIN', 'ORG_OWNER')
        OR rp.permission_code = p_perm
      )
  );
$$;

-- ------------------------------------------------------------------- schema ---
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'PRIVATE_ASSIGNMENT';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_visibility_scope_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_visibility_scope_check
  CHECK (visibility_scope IN ('PRIVATE_ASSIGNMENT', 'PROJECT_SHARED', 'ORGANIZATION_VISIBLE'));

UPDATE public.tasks
SET visibility_scope = 'PRIVATE_ASSIGNMENT'
WHERE visibility_scope IS NULL OR visibility_scope <> 'PRIVATE_ASSIGNMENT';

CREATE INDEX IF NOT EXISTS tasks_visibility_scope_idx
  ON public.tasks(organization_id, visibility_scope);

ALTER TABLE public.task_assignees
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignment_type text,
  ADD COLUMN IF NOT EXISTS assigned_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_assignment_type_check;
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_assignment_type_check
  CHECK (assignment_type IN ('PRIMARY', 'ADDITIONAL', 'REVIEWER', 'OBSERVER'));

UPDATE public.task_assignees ta
SET
  organization_id = t.organization_id,
  project_id = t.project_id,
  assigned_by_member_id = COALESCE(ta.assigned_by_member_id, ta.assigned_by),
  created_at = COALESCE(ta.created_at, ta.assigned_at, now()),
  updated_at = COALESCE(ta.updated_at, ta.assigned_at, now()),
  assignment_type = COALESCE(
    ta.assignment_type,
    CASE
      WHEN t.primary_assignee_member_id = ta.organization_member_id THEN 'PRIMARY'
      WHEN upper(COALESCE(ta.assignment_role, '')) = 'REVIEWER' THEN 'REVIEWER'
      WHEN upper(COALESCE(ta.assignment_role, '')) = 'OBSERVER' THEN 'OBSERVER'
      ELSE 'ADDITIONAL'
    END
  )
FROM public.tasks t
WHERE t.id = ta.task_id;

ALTER TABLE public.task_assignees
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN assignment_type SET NOT NULL;

SELECT handoff.attach_updated_at('public.task_assignees');

ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_task_id_organization_member_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_active_member_idx
  ON public.task_assignees(task_id, organization_member_id)
  WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS task_assignees_active_task_idx
  ON public.task_assignees(task_id, removed_at);
CREATE INDEX IF NOT EXISTS task_assignees_org_member_active_idx
  ON public.task_assignees(organization_id, organization_member_id)
  WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS task_assignees_assigned_by_idx
  ON public.task_assignees(assigned_by_member_id);

CREATE TABLE IF NOT EXISTS public.task_visibility_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  granted_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  access_type text NOT NULL DEFAULT 'VIEWER'
    CHECK (access_type IN ('VIEWER', 'REVIEWER', 'OBSERVER')),
  revoked_at timestamptz,
  revoked_by_member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT handoff.attach_updated_at('public.task_visibility_members');
CREATE UNIQUE INDEX IF NOT EXISTS task_visibility_members_active_unique_idx
  ON public.task_visibility_members(task_id, member_id, access_type)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS task_visibility_members_task_idx
  ON public.task_visibility_members(task_id, revoked_at);
CREATE INDEX IF NOT EXISTS task_visibility_members_member_idx
  ON public.task_visibility_members(member_id, revoked_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_visibility_members TO authenticated;

-- ------------------------------------------------------------------ triggers -
CREATE OR REPLACE FUNCTION public.sync_task_assignee_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
  v_actor uuid;
BEGIN
  SELECT organization_id, project_id
    INTO v_task
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found for task_assignees' USING ERRCODE = '23503';
  END IF;

  NEW.organization_id := v_task.organization_id;
  NEW.project_id := v_task.project_id;
  NEW.assigned_by_member_id := COALESCE(NEW.assigned_by_member_id, NEW.assigned_by);
  NEW.assigned_by := COALESCE(NEW.assigned_by, NEW.assigned_by_member_id);

  NEW.assignment_type := COALESCE(
    NEW.assignment_type,
    CASE upper(COALESCE(NEW.assignment_role, ''))
      WHEN 'PRIMARY' THEN 'PRIMARY'
      WHEN 'REVIEWER' THEN 'REVIEWER'
      WHEN 'OBSERVER' THEN 'OBSERVER'
      ELSE 'ADDITIONAL'
    END
  );
  NEW.assignment_role := COALESCE(
    NEW.assignment_role,
    CASE NEW.assignment_type
      WHEN 'PRIMARY' THEN 'PRIMARY'
      WHEN 'REVIEWER' THEN 'REVIEWER'
      WHEN 'OBSERVER' THEN 'OBSERVER'
      ELSE 'ASSIGNEE'
    END
  );

  IF NEW.removed_at IS NOT NULL AND NEW.removed_by_member_id IS NULL THEN
    v_actor := handoff.current_member_id(v_task.organization_id);
    NEW.removed_by_member_id := v_actor;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_assignee_access_fields ON public.task_assignees;
CREATE TRIGGER trg_sync_task_assignee_access_fields
  BEFORE INSERT OR UPDATE ON public.task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_assignee_access_fields();

CREATE OR REPLACE FUNCTION public.check_task_assignee_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_org uuid;
  v_task_project uuid;
  v_mem_org uuid;
  v_assigner_org uuid;
  v_removed_by_org uuid;
BEGIN
  SELECT organization_id, project_id INTO v_task_org, v_task_project
  FROM public.tasks
  WHERE id = NEW.task_id;

  SELECT organization_id INTO v_mem_org
  FROM public.organization_members
  WHERE id = NEW.organization_member_id;

  IF v_task_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for task_assignees' USING ERRCODE = '23503';
  END IF;

  NEW.organization_id := COALESCE(NEW.organization_id, v_task_org);
  NEW.project_id := COALESCE(NEW.project_id, v_task_project);
  NEW.assigned_by_member_id := COALESCE(NEW.assigned_by_member_id, NEW.assigned_by);

  IF NEW.organization_id IS DISTINCT FROM v_task_org OR NEW.project_id IS DISTINCT FROM v_task_project THEN
    RAISE EXCEPTION 'Cross-tenant assignment metadata blocked for task_assignees' USING ERRCODE = '23503';
  END IF;

  IF NEW.assigned_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_assigner_org
    FROM public.organization_members
    WHERE id = NEW.assigned_by_member_id;
    IF v_assigner_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant assigned_by_member_id blocked for task_assignees' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF NEW.removed_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_removed_by_org
    FROM public.organization_members
    WHERE id = NEW.removed_by_member_id;
    IF v_removed_by_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant removed_by_member_id blocked for task_assignees' USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_task_assignee_tenant ON public.task_assignees;
CREATE TRIGGER trg_check_task_assignee_tenant
  BEFORE INSERT OR UPDATE ON public.task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.check_task_assignee_tenant();

CREATE OR REPLACE FUNCTION public.check_task_visibility_member_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_org uuid;
  v_member_org uuid;
  v_granter_org uuid;
  v_revoker_org uuid;
BEGIN
  SELECT organization_id INTO v_task_org
  FROM public.tasks
  WHERE id = NEW.task_id;

  SELECT organization_id INTO v_member_org
  FROM public.organization_members
  WHERE id = NEW.member_id;

  IF v_task_org IS DISTINCT FROM v_member_org THEN
    RAISE EXCEPTION 'Cross-tenant member blocked for task_visibility_members' USING ERRCODE = '23503';
  END IF;

  IF NEW.granted_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_granter_org
    FROM public.organization_members
    WHERE id = NEW.granted_by_member_id;
    IF v_granter_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant granter blocked for task_visibility_members' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF NEW.revoked_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_revoker_org
    FROM public.organization_members
    WHERE id = NEW.revoked_by_member_id;
    IF v_revoker_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant revoker blocked for task_visibility_members' USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_task_visibility_member_tenant ON public.task_visibility_members;
CREATE TRIGGER trg_check_task_visibility_member_tenant
  BEFORE INSERT OR UPDATE ON public.task_visibility_members
  FOR EACH ROW EXECUTE FUNCTION public.check_task_visibility_member_tenant();

-- ------------------------------------------------------------ access helpers -
CREATE OR REPLACE FUNCTION handoff.task_org(p_task uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.tasks WHERE id = p_task;
$$;

CREATE OR REPLACE FUNCTION handoff.is_org_admin_or_owner(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT handoff.has_role(p_org, ARRAY['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_OWNER']);
$$;

CREATE OR REPLACE FUNCTION handoff.is_project_responsible_manager(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT id, organization_id, owner_member_id, project_manager_member_id
    FROM public.projects
    WHERE id = p_project
  )
  SELECT EXISTS (SELECT 1 FROM p)
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM p))
      OR EXISTS (
        SELECT 1
        FROM p
        JOIN public.organization_members m
          ON m.id IN (p.owner_member_id, p.project_manager_member_id)
        WHERE m.user_id = (SELECT auth.uid())
          AND m.is_active
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.organization_members m ON m.id = pm.organization_member_id
        WHERE pm.project_id = p_project
          AND pm.can_manage
          AND m.user_id = (SELECT auth.uid())
          AND m.is_active
      )
    );
$$;

CREATE OR REPLACE FUNCTION handoff.manages_task_assignee(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, organization_id, primary_assignee_member_id
    FROM public.tasks
    WHERE id = p_task
  ),
  me AS (
    SELECT handoff.current_member_id((SELECT organization_id FROM t)) AS member_id
  ),
  assigned AS (
    SELECT primary_assignee_member_id AS member_id FROM t WHERE primary_assignee_member_id IS NOT NULL
    UNION
    SELECT organization_member_id FROM public.task_assignees
    WHERE task_id = p_task AND removed_at IS NULL
  )
  SELECT EXISTS (SELECT 1 FROM t)
    AND (SELECT member_id FROM me) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM assigned a
      JOIN public.organization_members m ON m.id = a.member_id
      WHERE m.manager_id = (SELECT member_id FROM me)
         OR handoff.manages_member_team(a.member_id)
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_view_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, organization_id, project_id, reporter_member_id,
           primary_assignee_member_id, COALESCE(visibility_scope, 'PRIVATE_ASSIGNMENT') AS visibility_scope
    FROM public.tasks
    WHERE id = p_task
  ),
  me AS (
    SELECT handoff.current_member_id((SELECT organization_id FROM t)) AS member_id
  )
  SELECT EXISTS (SELECT 1 FROM t)
    AND (SELECT member_id FROM me) IS NOT NULL
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:view')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR (SELECT visibility_scope FROM t) = 'ORGANIZATION_VISIBLE'
      OR ((SELECT visibility_scope FROM t) = 'PROJECT_SHARED'
          AND handoff.can_view_project((SELECT project_id FROM t)))
      OR (SELECT member_id FROM me) = (SELECT reporter_member_id FROM t)
      OR (SELECT member_id FROM me) = (SELECT primary_assignee_member_id FROM t)
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = p_task
          AND ta.organization_member_id = (SELECT member_id FROM me)
          AND ta.removed_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = p_task
          AND COALESCE(ta.assigned_by_member_id, ta.assigned_by) = (SELECT member_id FROM me)
      )
      OR EXISTS (
        SELECT 1
        FROM public.task_visibility_members tvm
        WHERE tvm.task_id = p_task
          AND tvm.member_id = (SELECT member_id FROM me)
          AND tvm.revoked_at IS NULL
      )
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_task_assignee(p_task)
      )
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_create_task_with_visibility(p_org uuid, p_project uuid, p_visibility text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT handoff.has_permission(p_org, 'task:create')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = p_project
        AND p.organization_id = p_org
    )
    AND COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT')
      IN ('PRIVATE_ASSIGNMENT', 'PROJECT_SHARED', 'ORGANIZATION_VISIBLE')
    AND (
      handoff.is_project_responsible_manager(p_project)
      OR handoff.can_view_project(p_project)
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_edit_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, organization_id, project_id, reporter_member_id, primary_assignee_member_id
    FROM public.tasks
    WHERE id = p_task
  ),
  me AS (
    SELECT handoff.current_member_id((SELECT organization_id FROM t)) AS member_id
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:update')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (SELECT member_id FROM me) = (SELECT reporter_member_id FROM t)
      OR (SELECT member_id FROM me) = (SELECT primary_assignee_member_id FROM t)
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = p_task
          AND ta.organization_member_id = (SELECT member_id FROM me)
          AND ta.removed_at IS NULL
      )
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_task_assignee(p_task)
      )
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_assign_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:assign')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_task_assignee(p_task)
      )
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_assign_to(p_task uuid, p_member uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:assign')
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.id = p_member
        AND m.organization_id = (SELECT organization_id FROM t)
        AND m.is_active
    )
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_member_team(p_member)
      )
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_delete_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:delete')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
    );
$$;

CREATE OR REPLACE FUNCTION handoff.can_view_task_assignment_history(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT handoff.can_view_task(p_task);
$$;

-- ---------------------------------------------------------------------- RLS --
ALTER TABLE public.task_visibility_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (handoff.can_view_task(id));
CREATE POLICY tasks_insert ON public.tasks FOR INSERT
  WITH CHECK (handoff.can_create_task_with_visibility(organization_id, project_id, visibility_scope));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE
  USING (handoff.can_edit_task(id))
  WITH CHECK (handoff.can_edit_task(id));
CREATE POLICY tasks_delete ON public.tasks FOR DELETE
  USING (handoff.can_delete_task(id));

DROP POLICY IF EXISTS task_assignees_select ON public.task_assignees;
DROP POLICY IF EXISTS task_assignees_manage ON public.task_assignees;
DROP POLICY IF EXISTS task_assignees_insert ON public.task_assignees;
DROP POLICY IF EXISTS task_assignees_update ON public.task_assignees;
DROP POLICY IF EXISTS task_assignees_delete ON public.task_assignees;
CREATE POLICY task_assignees_select ON public.task_assignees FOR SELECT
  USING (handoff.can_view_task_assignment_history(task_id));
CREATE POLICY task_assignees_insert ON public.task_assignees FOR INSERT
  WITH CHECK (handoff.can_assign_to(task_id, organization_member_id));
CREATE POLICY task_assignees_update ON public.task_assignees FOR UPDATE
  USING (handoff.can_assign_task(task_id))
  WITH CHECK (handoff.can_assign_to(task_id, organization_member_id));
CREATE POLICY task_assignees_delete ON public.task_assignees FOR DELETE
  USING (handoff.can_assign_task(task_id));

DROP POLICY IF EXISTS task_visibility_members_select ON public.task_visibility_members;
DROP POLICY IF EXISTS task_visibility_members_insert ON public.task_visibility_members;
DROP POLICY IF EXISTS task_visibility_members_update ON public.task_visibility_members;
DROP POLICY IF EXISTS task_visibility_members_delete ON public.task_visibility_members;
CREATE POLICY task_visibility_members_select ON public.task_visibility_members FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY task_visibility_members_insert ON public.task_visibility_members FOR INSERT
  WITH CHECK (handoff.can_assign_to(task_id, member_id));
CREATE POLICY task_visibility_members_update ON public.task_visibility_members FOR UPDATE
  USING (handoff.can_assign_task(task_id))
  WITH CHECK (handoff.can_assign_to(task_id, member_id));
CREATE POLICY task_visibility_members_delete ON public.task_visibility_members FOR DELETE
  USING (handoff.can_assign_task(task_id));

DROP POLICY IF EXISTS task_deps_select ON public.task_dependencies;
DROP POLICY IF EXISTS task_deps_manage ON public.task_dependencies;
DROP POLICY IF EXISTS task_deps_insert ON public.task_dependencies;
DROP POLICY IF EXISTS task_deps_update ON public.task_dependencies;
DROP POLICY IF EXISTS task_deps_delete ON public.task_dependencies;
CREATE POLICY task_deps_select ON public.task_dependencies FOR SELECT
  USING (handoff.can_view_task(task_id) AND handoff.can_view_task(depends_on_task_id));
CREATE POLICY task_deps_insert ON public.task_dependencies FOR INSERT
  WITH CHECK (handoff.can_edit_task(task_id) AND handoff.can_view_task(depends_on_task_id));
CREATE POLICY task_deps_update ON public.task_dependencies FOR UPDATE
  USING (handoff.can_edit_task(task_id))
  WITH CHECK (handoff.can_edit_task(task_id) AND handoff.can_view_task(depends_on_task_id));
CREATE POLICY task_deps_delete ON public.task_dependencies FOR DELETE
  USING (handoff.can_edit_task(task_id));

DROP POLICY IF EXISTS task_label_links_select ON public.task_label_links;
DROP POLICY IF EXISTS task_label_links_manage ON public.task_label_links;
DROP POLICY IF EXISTS task_label_links_insert ON public.task_label_links;
DROP POLICY IF EXISTS task_label_links_update ON public.task_label_links;
DROP POLICY IF EXISTS task_label_links_delete ON public.task_label_links;
CREATE POLICY task_label_links_select ON public.task_label_links FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY task_label_links_insert ON public.task_label_links FOR INSERT
  WITH CHECK (handoff.can_edit_task(task_id));
CREATE POLICY task_label_links_update ON public.task_label_links FOR UPDATE
  USING (handoff.can_edit_task(task_id))
  WITH CHECK (handoff.can_edit_task(task_id));
CREATE POLICY task_label_links_delete ON public.task_label_links FOR DELETE
  USING (handoff.can_edit_task(task_id));

DROP POLICY IF EXISTS checklists_select ON public.task_checklists;
DROP POLICY IF EXISTS checklists_manage ON public.task_checklists;
DROP POLICY IF EXISTS checklists_insert ON public.task_checklists;
DROP POLICY IF EXISTS checklists_update ON public.task_checklists;
DROP POLICY IF EXISTS checklists_delete ON public.task_checklists;
CREATE POLICY checklists_select ON public.task_checklists FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY checklists_insert ON public.task_checklists FOR INSERT
  WITH CHECK (handoff.can_edit_task(task_id));
CREATE POLICY checklists_update ON public.task_checklists FOR UPDATE
  USING (handoff.can_edit_task(task_id))
  WITH CHECK (handoff.can_edit_task(task_id));
CREATE POLICY checklists_delete ON public.task_checklists FOR DELETE
  USING (handoff.can_edit_task(task_id));

DROP POLICY IF EXISTS checklist_items_select ON public.task_checklist_items;
DROP POLICY IF EXISTS checklist_items_manage ON public.task_checklist_items;
DROP POLICY IF EXISTS checklist_items_insert ON public.task_checklist_items;
DROP POLICY IF EXISTS checklist_items_update ON public.task_checklist_items;
DROP POLICY IF EXISTS checklist_items_delete ON public.task_checklist_items;
CREATE POLICY checklist_items_select ON public.task_checklist_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.task_checklists c
    WHERE c.id = checklist_id AND handoff.can_view_task(c.task_id)
  ));
CREATE POLICY checklist_items_insert ON public.task_checklist_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.task_checklists c
    WHERE c.id = checklist_id AND handoff.can_edit_task(c.task_id)
  ));
CREATE POLICY checklist_items_update ON public.task_checklist_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.task_checklists c
    WHERE c.id = checklist_id AND handoff.can_edit_task(c.task_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.task_checklists c
    WHERE c.id = checklist_id AND handoff.can_edit_task(c.task_id)
  ));
CREATE POLICY checklist_items_delete ON public.task_checklist_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.task_checklists c
    WHERE c.id = checklist_id AND handoff.can_edit_task(c.task_id)
  ));

DROP POLICY IF EXISTS watchers_select ON public.task_watchers;
DROP POLICY IF EXISTS watchers_manage ON public.task_watchers;
DROP POLICY IF EXISTS watchers_insert ON public.task_watchers;
DROP POLICY IF EXISTS watchers_update ON public.task_watchers;
DROP POLICY IF EXISTS watchers_delete ON public.task_watchers;
CREATE POLICY watchers_select ON public.task_watchers FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY watchers_insert ON public.task_watchers FOR INSERT
  WITH CHECK (handoff.can_view_task(task_id));
CREATE POLICY watchers_update ON public.task_watchers FOR UPDATE
  USING (handoff.can_view_task(task_id))
  WITH CHECK (handoff.can_view_task(task_id));
CREATE POLICY watchers_delete ON public.task_watchers FOR DELETE
  USING (handoff.can_view_task(task_id));

DROP POLICY IF EXISTS task_activity_select ON public.task_activity;
DROP POLICY IF EXISTS task_activity_insert ON public.task_activity;
CREATE POLICY task_activity_select ON public.task_activity FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY task_activity_insert ON public.task_activity FOR INSERT
  WITH CHECK (handoff.can_view_task(task_id));

DROP POLICY IF EXISTS time_entries_select ON public.time_entries;
DROP POLICY IF EXISTS time_entries_manage ON public.time_entries;
DROP POLICY IF EXISTS time_entries_insert ON public.time_entries;
DROP POLICY IF EXISTS time_entries_update ON public.time_entries;
DROP POLICY IF EXISTS time_entries_delete ON public.time_entries;
CREATE POLICY time_entries_select ON public.time_entries FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY time_entries_insert ON public.time_entries FOR INSERT
  WITH CHECK (handoff.can_edit_task(task_id));
CREATE POLICY time_entries_update ON public.time_entries FOR UPDATE
  USING (handoff.can_edit_task(task_id))
  WITH CHECK (handoff.can_edit_task(task_id));
CREATE POLICY time_entries_delete ON public.time_entries FOR DELETE
  USING (handoff.can_edit_task(task_id));

DROP POLICY IF EXISTS comments_select ON public.task_comments;
DROP POLICY IF EXISTS comments_insert ON public.task_comments;
DROP POLICY IF EXISTS comments_update_own ON public.task_comments;
CREATE POLICY comments_select ON public.task_comments FOR SELECT
  USING (handoff.can_view_task(task_id));
CREATE POLICY comments_insert ON public.task_comments FOR INSERT
  WITH CHECK (
    handoff.can_view_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = author_member_id AND m.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY comments_update_own ON public.task_comments FOR UPDATE
  USING (
    handoff.can_view_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = author_member_id AND m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    handoff.can_view_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = author_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS mentions_select ON public.comment_mentions;
DROP POLICY IF EXISTS mentions_insert ON public.comment_mentions;
CREATE POLICY mentions_select ON public.comment_mentions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.task_comments c
    WHERE c.id = comment_id AND handoff.can_view_task(c.task_id)
  ));
CREATE POLICY mentions_insert ON public.comment_mentions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.task_comments c
    JOIN public.organization_members m ON m.id = c.author_member_id
    WHERE c.id = comment_id
      AND m.user_id = (SELECT auth.uid())
      AND handoff.can_view_task(c.task_id)
  ));

DROP POLICY IF EXISTS attachments_select ON public.attachments;
DROP POLICY IF EXISTS attachments_insert ON public.attachments;
DROP POLICY IF EXISTS attachments_delete ON public.attachments;
CREATE POLICY attachments_select ON public.attachments FOR SELECT
  USING (
    handoff.is_org_member(organization_id)
    AND (task_id IS NULL OR handoff.can_view_task(task_id))
    AND (project_id IS NULL OR handoff.can_view_project(project_id))
  );
CREATE POLICY attachments_insert ON public.attachments FOR INSERT
  WITH CHECK (
    handoff.is_org_member(organization_id)
    AND (task_id IS NULL OR handoff.can_view_task(task_id))
    AND (project_id IS NULL OR handoff.can_view_project(project_id))
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = uploaded_by_member_id AND m.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY attachments_delete ON public.attachments FOR DELETE
  USING (
    (task_id IS NULL OR handoff.can_view_task(task_id))
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.id = uploaded_by_member_id AND m.user_id = (SELECT auth.uid())
      )
      OR (task_id IS NOT NULL AND handoff.can_assign_task(task_id))
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_visibility_members;
