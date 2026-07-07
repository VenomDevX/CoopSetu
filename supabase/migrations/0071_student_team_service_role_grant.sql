-- ============================================================================
-- Handoff — 0071 Grant service_role on student team tables
-- ============================================================================
-- Migration 0050's "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role"
-- only covers tables that existed at that time. The student workspace tables
-- added in 0067 are queried directly by the admin (service-role) client from
-- several Next.js API routes (e.g. the team members list), which needs real
-- GRANT privileges — SECURITY DEFINER RPCs work regardless since they run as
-- the function owner, but direct table access via the admin client does not.
-- ============================================================================

GRANT ALL ON TABLE public.student_team_settings TO service_role;
GRANT ALL ON TABLE public.student_team_join_codes TO service_role;
GRANT ALL ON TABLE public.student_team_member_labels TO service_role;
