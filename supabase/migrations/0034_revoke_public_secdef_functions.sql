-- ============================================================================
-- Handoff — 0034 Revoke PUBLIC execute on SECURITY DEFINER functions
-- PostgreSQL grants EXECUTE to PUBLIC by default on all functions.
-- Must revoke from PUBLIC first, then re-grant only to the roles that need it.
-- ============================================================================

-- Internal-only: revoke from everyone, do not re-grant.
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text, uuid, uuid, jsonb) FROM PUBLIC;

-- Authenticated-only: revoke PUBLIC, re-grant to authenticated.
REVOKE EXECUTE ON FUNCTION public.create_organization FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_organization TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_project(uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_project(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_project_team FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_project_team TO authenticated;

REVOKE EXECUTE ON FUNCTION public.member_permissions(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.member_permissions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.release_can_deploy(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.release_can_deploy(uuid) TO authenticated;

-- Invite flow: keep anon + authenticated (email links work before login).
REVOKE EXECUTE ON FUNCTION public.get_invite(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_invite(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_invite(text) TO anon, authenticated;
