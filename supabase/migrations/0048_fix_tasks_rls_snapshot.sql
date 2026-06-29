-- ============================================================================
-- Handoff — 0048 Fix Tasks RLS Snapshot Isolation
-- ============================================================================
-- Bug: inserting a task via PostgREST fails with
--   "new row violates row-level security policy for table tasks"
--
-- Root cause: PostgREST issues `INSERT ... RETURNING tasks.*`. The RETURNING
-- rows are checked against the SELECT policy `tasks_select`, which previously
-- called `handoff.can_view_task(id)`. Because that function queries `public.tasks`,
-- the newly inserted row is not yet visible in its snapshot, so it returns false.
-- This causes the statement to fail despite the INSERT WITH CHECK policy passing.
--
-- Fix: Inline the row-level attributes into the `tasks_select` USING clause
-- so it evaluates the RETURNING row without a subquery to `public.tasks`.
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
      WHERE ta.task_id = id
        AND ta.organization_member_id = handoff.current_member_id(organization_id)
        AND ta.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = id
        AND COALESCE(ta.assigned_by_member_id, ta.assigned_by) = handoff.current_member_id(organization_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_visibility_members tvm
      WHERE tvm.task_id = id
        AND tvm.member_id = handoff.current_member_id(organization_id)
        AND tvm.revoked_at IS NULL
    )
    OR handoff.is_project_responsible_manager(project_id)
    OR (
      handoff.has_permission(organization_id, 'task:view_team_assignments')
      AND handoff.manages_task_assignee(id)
    )
  )
);
