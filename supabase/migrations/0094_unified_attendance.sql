-- ============================================================================
-- 0094 — unified attendance model
--
-- Merges device attendance (0092) and session attendance (0071) into one
-- register.  attendance_records becomes the single source of truth for both
-- "a trainee checked into a scheduled class" and "a member tapped their card
-- on a wall-mounted terminal".
--
-- Key decisions:
--   • member_id (organization_members) is the universal subject — works for
--     trainees, trainers, admins, and the NCCT director.
--   • trainee_id and session_id become NULLABLE so staff and day check-ins
--     fit without fake sessions. A CHECK guard keeps the LMS chain: every
--     row with a trainee_id must also have a session_id.
--   • device_event_id links to the raw audit trail in device_attendance_events.
--   • source tracks how the record was created (device tap, web, self-scan,
--     import, or seed data).
--   • resolution on device_attendance_events explains what happened to a card
--     tap (linked, staff-only, no enrolment, etc.).
--   • rfid_capture_requests supports tap-to-capture: terminal publishes a
--     scanned UID, dashboard reads it live and assigns it to a member.
-- ============================================================================

-- ========================================== attendance_records: new columns

-- member_id — the universal subject
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.organization_members(id) ON DELETE CASCADE;

-- device that recorded this entry (NULL for web-originated records)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.device_tokens(id) ON DELETE SET NULL;

-- how the record was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_source_check'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'WEB';
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_source_check
      CHECK (source IN ('DEVICE', 'WEB', 'SELF', 'IMPORT', 'SEED'));
  ELSE
    ALTER TABLE public.attendance_records
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'WEB';
  END IF;
END $$;

-- who marked the attendance (admin marking for a trainee, etc.)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS recorded_by_member_id UUID REFERENCES public.organization_members(id) ON DELETE SET NULL;

-- link to the raw device audit trail
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS device_event_id UUID REFERENCES public.device_attendance_events(id) ON DELETE SET NULL;

-- Ensure device_event_id is unique (one attendance_record per device_event)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'attendance_records_device_event_id_key'
  ) THEN
    CREATE UNIQUE INDEX attendance_records_device_event_id_key
      ON public.attendance_records(device_event_id)
      WHERE device_event_id IS NOT NULL;
  END IF;
END $$;

-- ========================================== make session_id / trainee_id NULLABLE

-- session_id: staff/day check-ins have no batch
ALTER TABLE public.attendance_records
  ALTER COLUMN session_id DROP NOT NULL;

-- trainee_id: staff are not trainees
ALTER TABLE public.attendance_records
  ALTER COLUMN trainee_id DROP NOT NULL;

-- Guard: every trainee row must have a session, preserving the session→batch
-- chain that the LMS and certificate modules depend on.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_trainee_needs_session'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_trainee_needs_session
      CHECK (trainee_id IS NULL OR session_id IS NOT NULL);
  END IF;
END $$;

-- ========================================== backfill member_id from existing data
-- For every existing row that has trainee_id, look up the trainee's user_id in
-- organization_members to find the corresponding member_id.
UPDATE public.attendance_records ar
SET member_id = om.id
FROM public.trainees t
JOIN public.organization_members om
  ON om.user_id = t.user_id
  AND om.organization_id = t.organization_id
  AND om.is_active = true
WHERE ar.trainee_id = t.id
  AND ar.member_id IS NULL;

-- Now make member_id NOT NULL — all existing data should have been backfilled.
-- If any rows failed backfill (orphan trainees without org members), they get
-- a fallback: we don't want the migration to fail.
-- Only set NOT NULL if all rows are populated.
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT count(*) INTO null_count
  FROM public.attendance_records
  WHERE member_id IS NULL;

  IF null_count = 0 THEN
    ALTER TABLE public.attendance_records
      ALTER COLUMN member_id SET NOT NULL;
  ELSE
    RAISE NOTICE '% attendance_records rows have NULL member_id — skipping NOT NULL constraint', null_count;
  END IF;
END $$;

-- Compatibility for existing dashboard/self-service flows that still insert
-- session_id + trainee_id. The universal subject is derived before NOT NULL
-- and RLS checks; callers cannot use it to select another member because the
-- trainee and membership must share both user_id and organization_id.
CREATE OR REPLACE FUNCTION coopsetu.attendance_record_set_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.member_id IS NULL AND NEW.trainee_id IS NOT NULL THEN
    SELECT om.id INTO NEW.member_id
    FROM public.trainees t
    JOIN public.organization_members om
      ON om.user_id = t.user_id
     AND om.organization_id = t.organization_id
     AND om.is_active = true
    WHERE t.id = NEW.trainee_id
    ORDER BY om.created_at
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_records_set_member ON public.attendance_records;
CREATE TRIGGER attendance_records_set_member
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION coopsetu.attendance_record_set_member();

-- ========================================== method CHECK: add 'RFID'
-- Drop the old constraint and recreate with the new value
DO $$
BEGIN
  -- Find and drop the existing method check constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.attendance_records'::regclass
      AND conname LIKE '%method%'
      AND contype = 'c'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.attendance_records DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'public.attendance_records'::regclass
        AND conname LIKE '%method%'
        AND contype = 'c'
      LIMIT 1
    );
  END IF;

  ALTER TABLE public.attendance_records
    ADD CONSTRAINT attendance_records_method_check
    CHECK (method IN ('QR', 'FACE', 'MANUAL', 'RFID', 'TOTP'));
END $$;

-- ========================================== attendance_sessions: add 'KIOSK' type
DO $$
BEGIN
  -- Drop existing session_type constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.attendance_sessions'::regclass
      AND conname LIKE '%session_type%'
      AND contype = 'c'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.attendance_sessions DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'public.attendance_sessions'::regclass
        AND conname LIKE '%session_type%'
        AND contype = 'c'
      LIMIT 1
    );
  END IF;

  ALTER TABLE public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_session_type_check
    CHECK (session_type IN ('LECTURE', 'LAB', 'WORKSHOP', 'EXAM', 'KIOSK'));
END $$;

-- Partial unique: one KIOSK day-session per batch per date
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_kiosk_batch_date_idx
  ON public.attendance_sessions(batch_id, date)
  WHERE session_type = 'KIOSK';

-- ========================================== device_attendance_events: resolution
ALTER TABLE public.device_attendance_events
  ADD COLUMN IF NOT EXISTS resolution TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_attendance_events_resolution_check'
  ) THEN
    ALTER TABLE public.device_attendance_events
      ADD CONSTRAINT device_attendance_events_resolution_check
      CHECK (resolution IS NULL OR resolution IN (
        'LINKED', 'STAFF', 'NO_ENROLMENT', 'NO_BATCH', 'DUPLICATE', 'UNKNOWN_CARD'
      ));
  END IF;
END $$;

ALTER TABLE public.device_attendance_events
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- ========================================== rfid_capture_requests (tap-to-capture)
CREATE TABLE IF NOT EXISTS public.rfid_capture_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  device_id UUID NOT NULL REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  rfid_uid TEXT,
  requested_by UUID REFERENCES public.organization_members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'CAPTURED', 'CLAIMED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfid_capture_requests_device_status_idx
  ON public.rfid_capture_requests(device_id, status);
CREATE INDEX IF NOT EXISTS rfid_capture_requests_org_status_idx
  ON public.rfid_capture_requests(organization_id, status);

ALTER TABLE public.rfid_capture_requests ENABLE ROW LEVEL SECURITY;

-- Permissive: attendance:manage
DROP POLICY IF EXISTS rfid_capture_requests_manage ON public.rfid_capture_requests;
CREATE POLICY rfid_capture_requests_manage ON public.rfid_capture_requests
  FOR ALL TO authenticated
  USING (coopsetu.has_permission(organization_id, 'attendance:manage'))
  WITH CHECK (coopsetu.has_permission(organization_id, 'attendance:manage'));

-- Restrictive: institution scope
DROP POLICY IF EXISTS rfid_capture_requests_institution_scope ON public.rfid_capture_requests;
CREATE POLICY rfid_capture_requests_institution_scope ON public.rfid_capture_requests
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfid_capture_requests
  TO authenticated, service_role;

-- ========================================== performance indexes
CREATE INDEX IF NOT EXISTS attendance_records_marked_at_desc_idx
  ON public.attendance_records(marked_at DESC);
CREATE INDEX IF NOT EXISTS attendance_records_member_marked_at_idx
  ON public.attendance_records(member_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS attendance_records_device_marked_at_idx
  ON public.attendance_records(device_id, marked_at DESC)
  WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS device_attendance_events_member_method_time_idx
  ON public.device_attendance_events(member_id, method, marked_at DESC);

-- ========================================== partial unique: staff day check-in
-- A staff member (session_id IS NULL) can only check in once per IST day.
-- We use a partial unique index on (member_id, date-of-marked_at) where
-- session_id IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_staff_daily_unique_idx
  ON public.attendance_records(
    member_id,
    (timezone('Asia/Kolkata', marked_at)::date)
  )
  WHERE session_id IS NULL;

-- ========================================== realtime publication
-- Add tables to supabase_realtime. These ALTER PUBLICATION statements are
-- idempotent (ADD IF NOT EXISTS is not standard but duplicates are a no-op
-- in Supabase's managed realtime — if it errors, we catch it).
DO $$
BEGIN
  -- attendance_records
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- device_attendance_events
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_attendance_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- attendance_sessions
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- rfid_capture_requests
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rfid_capture_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- REPLICA IDENTITY FULL is required for UPDATE/DELETE events to pass
-- through Supabase Realtime's RLS re-check (without it, the old row is
-- empty and the policy check fails silently, dropping the event).
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.device_attendance_events REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.rfid_capture_requests REPLICA IDENTITY FULL;

-- ========================================== comments
COMMENT ON COLUMN public.attendance_records.member_id IS
  'Universal subject — works for trainees, trainers, admins, director.';
COMMENT ON COLUMN public.attendance_records.device_id IS
  'Device that recorded this entry. NULL for web-originated records.';
COMMENT ON COLUMN public.attendance_records.source IS
  'How the record was created: DEVICE (terminal tap), WEB (dashboard), SELF (trainee self-scan), IMPORT (bulk), SEED (test data).';
COMMENT ON COLUMN public.attendance_records.device_event_id IS
  'Link to the raw device audit trail. One attendance_record per device_event.';
COMMENT ON COLUMN public.device_attendance_events.resolution IS
  'Outcome of resolving this tap: LINKED (matched to attendance_records), STAFF (non-trainee), NO_ENROLMENT, NO_BATCH, DUPLICATE, UNKNOWN_CARD.';
COMMENT ON TABLE public.rfid_capture_requests IS
  'Tap-to-capture: terminal publishes a scanned UID, dashboard reads it live and assigns to a member.';
