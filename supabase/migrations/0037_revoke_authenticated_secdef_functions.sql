-- ============================================================================
-- Handoff — 0037 Revoke authenticated from SECURITY DEFINER functions
-- All these RPCs are now called via the service-role (admin) client in
-- Next.js API routes. Revoking authenticated removes them from PostgREST's
-- public API surface, eliminating the security advisor warnings.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.accept_invite(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invite(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_project(uuid, jsonb) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_project_team FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.member_permissions(uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_can_deploy(uuid) FROM authenticated, PUBLIC;
