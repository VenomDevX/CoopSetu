-- ============================================================================
-- 0095 — attendance-scoped RLS
--
-- Rewrites attendance_records policies to use member_id (which carries
-- organization_id + institution_id directly) instead of joining through
-- trainees. This:
--   1. Closes the org-wide read leak (0080's is_org_member let any member
--      read every attendance row in the country).
--   2. Supports staff attendance (member_id without trainee_id).
--   3. Adds institution scoping that 0085 never covered for attendance.
--   4. Adds trainer access to their own batch's records.
--
-- Pattern follows 0085/0092: permissive policies ORed, restrictive ANDed.
-- ============================================================================

-- ========================= attendance_records: drop old policies from 0080

DROP POLICY IF EXISTS attendance_records_select ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_self_insert ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_manage ON public.attendance_records;

-- ========================= attendance_records: new policies

-- 1. Self-read: a member can always read their own attendance
CREATE POLICY attendance_records_self_read ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT om.id FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid()) AND om.is_active
    )
  );

-- 2. Self-insert: a member can mark their own attendance (QR/face self-scan)
CREATE POLICY attendance_records_self_insert ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT om.id FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid()) AND om.is_active
    )
  );

-- 3. Staff manage: users with attendance:manage can do everything
CREATE POLICY attendance_records_staff_manage ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    coopsetu.has_permission(
      (SELECT om.organization_id FROM public.organization_members om WHERE om.id = attendance_records.member_id),
      'attendance:manage'
    )
  )
  WITH CHECK (
    coopsetu.has_permission(
      (SELECT om.organization_id FROM public.organization_members om WHERE om.id = attendance_records.member_id),
      'attendance:manage'
    )
  );

-- 4. Trainer: can read records for batches they train
--    (additive permissive SELECT — trainers don't have attendance:manage or
--    analytics:view, but need to see their own batch's attendance)
CREATE POLICY attendance_records_trainer_read ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    session_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.attendance_sessions ats
      JOIN public.batches b ON b.id = ats.batch_id
      JOIN public.trainers tr ON tr.id = b.trainer_id
      WHERE ats.id = attendance_records.session_id
        AND tr.user_id = (SELECT auth.uid())
    )
  );

-- 5. RESTRICTIVE institution scope: narrows all the above to the caller's
--    institution subtree. Uses the member's institution_id (via org_members).
DROP POLICY IF EXISTS attendance_records_institution_scope ON public.attendance_records;
CREATE POLICY attendance_records_institution_scope ON public.attendance_records
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    coopsetu.can_access_institution(
      (SELECT om.organization_id FROM public.organization_members om WHERE om.id = attendance_records.member_id),
      (SELECT om.institution_id FROM public.organization_members om WHERE om.id = attendance_records.member_id)
    )
    -- Self-access always passes regardless of institution, so a misconfigured
    -- institution_id never locks someone out of their own records.
    OR member_id IN (
      SELECT om.id FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    coopsetu.can_access_institution(
      (SELECT om.organization_id FROM public.organization_members om WHERE om.id = attendance_records.member_id),
      (SELECT om.institution_id FROM public.organization_members om WHERE om.id = attendance_records.member_id)
    )
    OR member_id IN (
      SELECT om.id FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

-- ========================= attendance_sessions: institution scope
-- The existing permissive policies (0080) route through batches.organization_id
-- and are fine. What's missing is the RESTRICTIVE institution scope (0085 never
-- covered attendance_sessions). We add it here.

DROP POLICY IF EXISTS attendance_sessions_institution_scope ON public.attendance_sessions;
CREATE POLICY attendance_sessions_institution_scope ON public.attendance_sessions
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    coopsetu.can_access_institution(
      (SELECT b.organization_id FROM public.batches b WHERE b.id = attendance_sessions.batch_id),
      (SELECT p.institution_id FROM public.batches b
       JOIN public.programmes p ON p.id = b.programme_id
       WHERE b.id = attendance_sessions.batch_id)
    )
  )
  WITH CHECK (
    coopsetu.can_access_institution(
      (SELECT b.organization_id FROM public.batches b WHERE b.id = attendance_sessions.batch_id),
      (SELECT p.institution_id FROM public.batches b
       JOIN public.programmes p ON p.id = b.programme_id
       WHERE b.id = attendance_sessions.batch_id)
    )
  );
