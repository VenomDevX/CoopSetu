-- ============================================================================
-- Handoff — 0033 Revoke anon/authenticated from SECURITY DEFINER functions
-- Fixes Supabase advisor: "Public Can Execute SECURITY DEFINER Function"
--
-- Strategy per function:
--   get_invite, accept_invite  → keep anon + authenticated (needed for invite flow)
--   create_organization, create_project, create_project_team,
--   member_permissions, release_can_deploy → revoke anon (authenticated only)
--   write_audit_log, create_notification   → revoke both (server-side only via
--                                            service-role or trusted API routes)
-- ============================================================================

-- Functions that should never be called directly by clients: revoke all roles.
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, uuid, jsonb, jsonb, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text, uuid, uuid, jsonb) FROM anon, authenticated;

-- Functions that require a logged-in user: revoke anon only.
REVOKE EXECUTE ON FUNCTION public.create_organization FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_project(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_project_team FROM anon;
REVOKE EXECUTE ON FUNCTION public.member_permissions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_can_deploy(uuid) FROM anon;

-- get_invite and accept_invite intentionally keep anon + authenticated
-- (unauthenticated users click invite links before they have a session).
