-- ============================================================================
-- Handoff — 0051 Fix tasks_select sub-query column references
-- ============================================================================
-- Bug in migration 0048: unqualified `id` and `organization_id` inside the
-- task_assignees and task_visibility_members sub-queries in tasks_select were
-- resolved by PostgreSQL to the sub-query table's own columns (ta.id,
-- tvm.id, ta.organization_id) instead of the outer tasks row's columns.
--
-- Result: `ta.task_id = ta.id` and `tvm.task_id = tvm.id` are always FALSE
-- because they compare the FK task_id column against the row's own PK.
-- This silently disabled REVIEWER assignment visibility and explicit
-- task_visibility_members grants.
--
-- Fix: qualify with `tasks.id` and `tasks.organization_id` explicitly.
-- ============================================================================

DROP POLICY IF EXISTS tasks_select ON public.tasks;

CREATE POLICY tasks_select ON public.tasks FOR SELECT
USING (
  (SELECT handoff.current_member_id(organization_id)) IS NOT NULL
  AND handoff.has_permission(organization_id, 'task:view')
  AND (
    handoff.is_org_admin_or_owner(organization_id)
    OR COALESCE(visibility_scope, 'PRIVATE_ASSIGNMENT') = 'ORGANIZATION_VISIBLE'
    OR (
      COALESCE(visibility_scope, 'PRIVATE_ASSIGNMENT') = 'PROJECT_SHARED'
      AND handoff.can_view_project(project_id)
    )
    OR handoff.current_member_id(organization_id) = reporter_member_id
    OR handoff.current_member_id(organization_id) = primary_assignee_member_id
    OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
        AND ta.organization_member_id = handoff.current_member_id(tasks.organization_id)
        AND ta.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
        AND COALESCE(ta.assigned_by_member_id, ta.assigned_by) = handoff.current_member_id(tasks.organization_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_visibility_members tvm
      WHERE tvm.task_id = tasks.id
        AND tvm.member_id = handoff.current_member_id(tasks.organization_id)
        AND tvm.revoked_at IS NULL
    )
    OR handoff.is_project_responsible_manager(project_id)
    OR (
      handoff.has_permission(organization_id, 'task:view_team_assignments')
      AND handoff.manages_task_assignee(id)
    )
  )
);
