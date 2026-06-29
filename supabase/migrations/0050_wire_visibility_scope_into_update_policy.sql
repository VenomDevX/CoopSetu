-- ============================================================================
-- Handoff — 0050 Wire can_set_task_visibility into tasks UPDATE policy
-- ============================================================================
-- Bug found via live browser test (2026-06-29):
-- Migration 0049 added handoff.can_set_task_visibility() but did not wire it
-- into the tasks UPDATE RLS policy. A task assignee (DEVELOPER role) could
-- bypass the admin/PM restriction and set visibility_scope to
-- ORGANIZATION_VISIBLE or PROJECT_SHARED via the Supabase REST API directly.
--
-- Fix: replace the tasks_update WITH CHECK to also call
-- can_set_task_visibility(id, visibility_scope) so the DB itself enforces
-- the scope-broadening restriction, regardless of how the client connects.
-- ============================================================================

DROP POLICY IF EXISTS tasks_update ON public.tasks;

CREATE POLICY tasks_update ON public.tasks FOR UPDATE
  USING (handoff.can_edit_task(id))
  WITH CHECK (
    handoff.can_edit_task(id)
    AND handoff.can_set_task_visibility(id, visibility_scope)
  );
