-- ============================================================================
-- Handoff — 0051 Restore authenticated execution rights for RPCs
-- ============================================================================
-- Migration 0037 revoked authenticated execution rights from several RPCs, 
-- breaking them because they rely on auth.uid() internally.
-- This restores execution rights so they can be called by authenticated users,
-- and allows the integration test suite to pass.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_can_deploy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text, uuid, uuid, jsonb) TO authenticated;
