-- ============================================================================
-- Handoff — 0077 Revoke `anon` EXECUTE from SECURITY DEFINER functions
-- ============================================================================
-- Fixes Supabase advisor: "anon_security_definer_function_executable".
--
-- Root cause: Supabase's default privileges grant EXECUTE to `anon` (and
-- `authenticated`) on every function created in `public`. Earlier migrations
-- only REVOKE ... FROM PUBLIC / authenticated, which does NOT remove the
-- role-specific grant to `anon`. These SECURITY DEFINER functions therefore
-- remained callable by anyone holding the public anon key.
--
-- Only `write_audit_log` was actually exploitable (it inserts an audit row even
-- when auth.uid() is null, allowing forged/spammed audit entries). The rest
-- fail closed internally via auth.uid(); revoking `anon` is defense-in-depth
-- and clears the advisor. The three trigger functions are not RPC-callable but
-- are locked down for hygiene.
--
-- Intentionally NOT touched: get_invite / accept_invite keep `anon` EXECUTE,
-- because unauthenticated users click invite links before they have a session.
-- ============================================================================

-- --- Server-side only: must never be callable by clients at all -------------
-- write_audit_log is invoked by the audit trigger (SECURITY DEFINER) and by
-- trusted service-role paths. authenticated was already revoked in 0055; this
-- removes the lingering anon grant that made forged audit rows possible.
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, uuid, jsonb, jsonb, jsonb) FROM anon;

-- Trigger functions: never invoked directly. Lock out every client role.
REVOKE EXECUTE ON FUNCTION public.check_task_assignee_tenant() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_task_visibility_member_tenant() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_task_assignee_access_fields() FROM anon, authenticated, PUBLIC;

-- --- Require a logged-in user: revoke anon only, keep authenticated ----------
REVOKE EXECUTE ON FUNCTION public.create_bug(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_test_plan(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_security_review(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_sessions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_session(uuid) FROM anon;
-- get_join_code_status: 0069 only granted `authenticated` and never revoked
-- PUBLIC, so `anon` retained EXECUTE via PUBLIC. Revoke PUBLIC (this also drops
-- the redundant anon grant) while keeping authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.get_join_code_status(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_legal_acceptance(uuid, uuid, uuid, text, text, text, text) FROM anon;
