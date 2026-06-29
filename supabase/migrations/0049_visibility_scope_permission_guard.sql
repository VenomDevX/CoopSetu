-- ============================================================================
-- Handoff — 0049 Visibility scope permission guard
-- ============================================================================
-- Tightens task visibility-scope creation/mutation to ensure that only
-- org admins/owners and responsible project managers may set
-- PROJECT_SHARED or ORGANIZATION_VISIBLE on a task.
-- The previous can_create_task_with_visibility allowed any project member
-- with task:create to set any visibility scope.
-- ============================================================================

-- Fix INSERT visibility guard: PRIVATE_ASSIGNMENT is open to any task:create
-- holder; broader scopes require admin/owner or responsible PM.
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
      FROM public.projects pr
      WHERE pr.id = p_project
        AND pr.organization_id = p_org
    )
    AND COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT')
      IN ('PRIVATE_ASSIGNMENT', 'PROJECT_SHARED', 'ORGANIZATION_VISIBLE')
    AND (
      COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT') = 'PRIVATE_ASSIGNMENT'
      OR handoff.is_org_admin_or_owner(p_org)
      OR handoff.is_project_responsible_manager(p_project)
    );
$$;

-- Helper for UPDATE path: a user may only set a broader visibility scope when
-- they already have edit access AND the admin/PM restriction is met.
CREATE OR REPLACE FUNCTION handoff.can_set_task_visibility(p_task uuid, p_visibility text)
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
  SELECT handoff.can_edit_task(p_task)
    AND (
      COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT') = 'PRIVATE_ASSIGNMENT'
      OR handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
    );
$$;
