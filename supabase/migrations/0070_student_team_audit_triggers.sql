-- ============================================================================
-- Handoff — 0070 Student team audit triggers
-- ============================================================================
-- Attach the generic audit_trigger() to student_team_settings and
-- student_team_member_labels (same as any other org-scoped table, per 0055).
--
-- Deliberately NOT attached to student_team_join_codes: the generic trigger
-- captures full before/after row state as JSON, which would put code_hash
-- into audit_logs.before_state/after_state — unnecessary exposure of a
-- security-sensitive value even though it's a hash, not a raw code. Join-code
-- lifecycle events (created/rotated/revoked) are instead written as explicit
-- createAuditLog() calls from the API layer with a hand-built afterState that
-- omits code_hash entirely.
-- ============================================================================

CREATE TRIGGER trg_audit_student_team_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.student_team_settings
  FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

CREATE TRIGGER trg_audit_student_team_member_labels
  AFTER INSERT OR UPDATE OR DELETE ON public.student_team_member_labels
  FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();
