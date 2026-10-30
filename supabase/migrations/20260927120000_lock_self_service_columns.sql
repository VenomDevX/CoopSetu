-- ============================================================================
-- Lock the columns a trainee / employer may change on their own row.
--
-- trainees_self_update and employers_self_update (0080) let the row's owner
-- update ANY column: the table has GRANT ALL, RLS cannot restrict columns, and
-- the RESTRICTIVE institution-scope policy (0085) always admits the owner's own
-- row. A trainee could therefore move themselves to another organization or
-- institution, mark themselves GRADUATED, or overwrite face_embedding with
-- someone else's face; an employer could clear PENDING_VERIFICATION.
--
-- These triggers keep self-service to profile fields. Staff paths (the
-- trainee:manage / org admin policies) and server-side code without an end
-- user (service role: auth.uid() IS NULL) are unaffected.
--
-- Also drops attendance_records_self_insert (0095): every legitimate attendance
-- insert is either a staff action (attendance:manage) or goes through the
-- service-role client (QR, RFID, device face). The self-insert policy only let
-- a member write PRESENT rows for themselves straight through PostgREST.
-- ============================================================================

-- ============================================================= trainees
CREATE OR REPLACE FUNCTION coopsetu.trainees_guard_self_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- Columns a trainee may edit on their own profile. Everything else
  -- (identity, scoping, status, aadhaar_hash, future columns) is staff-only.
  self_editable CONSTANT text[] := ARRAY[
    'education', 'location', 'languages', 'experience', 'profile_photo',
    'digital_literacy_level', 'employment_status', 'date_of_birth', 'gender',
    'updated_at', 'face_embedding'
  ];
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR coopsetu.has_permission(NEW.organization_id, 'trainee:manage') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Self-registration: only into an organization the caller belongs to, and
    -- never with a pre-set face or non-default status.
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = NEW.user_id
        AND om.organization_id = NEW.organization_id
        AND om.is_active
    ) THEN
      RAISE EXCEPTION 'trainee self-registration requires membership of the organization'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.face_embedding IS NOT NULL OR NEW.status <> 'ACTIVE' OR NEW.institution_id IS NOT NULL THEN
      RAISE EXCEPTION 'face, status and institution are set by staff'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE by the row's owner.
  IF (to_jsonb(NEW) - self_editable) IS DISTINCT FROM (to_jsonb(OLD) - self_editable) THEN
    RAISE EXCEPTION 'only profile fields can be changed on your own trainee record'
      USING ERRCODE = '42501';
  END IF;
  -- First face enrolment is self-service; replacing an enrolled face is not,
  -- otherwise anyone could swap in a friend's face before a check-in.
  IF OLD.face_embedding IS NOT NULL
     AND NEW.face_embedding IS DISTINCT FROM OLD.face_embedding THEN
    RAISE EXCEPTION 'a registered face can only be replaced by staff'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainees_guard_self_service ON public.trainees;
CREATE TRIGGER trainees_guard_self_service
  BEFORE INSERT OR UPDATE ON public.trainees
  FOR EACH ROW EXECUTE FUNCTION coopsetu.trainees_guard_self_service();

-- ============================================================= employers
CREATE OR REPLACE FUNCTION coopsetu.employers_guard_self_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR coopsetu.is_org_admin_or_owner(OLD.organization_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'owner, organization and status are managed by admins'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employers_guard_self_service ON public.employers;
CREATE TRIGGER employers_guard_self_service
  BEFORE UPDATE ON public.employers
  FOR EACH ROW EXECUTE FUNCTION coopsetu.employers_guard_self_service();

-- ============================================================= attendance
DROP POLICY IF EXISTS attendance_records_self_insert ON public.attendance_records;
