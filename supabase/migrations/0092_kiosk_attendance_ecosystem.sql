-- ============================================================================
-- 0092 — kiosk attendance ecosystem: RFID cards, face slots, device events
--
-- Three new tables support the kiosk-style attendance model where a wall-mounted
-- terminal marks attendance by RFID, QR, or face recognition without being tied
-- to a trainer-armed session/batch.
--
-- Why a separate table from attendance_records:
--   attendance_records (0071) belongs to the session-scoped flow: a trainer arms
--   a session, trainees check in against that session, and the record carries a
--   session_id FK. The kiosk terminal is not session-aware — it records "member X
--   was present at device Y at time Z via method M". Forcing that into a session
--   model would require synthesising fake sessions, breaking the session→batch
--   chain that the LMS and certificate modules depend on.
--
-- rfid_cards uses organization_members as the subject rather than per-role tables
-- (trainees, trainers) because a single RFID card should work regardless of role
-- and organization_members already carries role + institution_id since 0084.
-- ============================================================================

-- ================================================================ rfid_cards
CREATE TABLE IF NOT EXISTS public.rfid_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  -- The member this card is linked to. UNIQUE: one card per member.
  member_id UUID NOT NULL UNIQUE REFERENCES public.organization_members(id) ON DELETE CASCADE,
  -- Raw hex UID from the PN532 (e.g. "04A3B2C1D5E6F7"). UNIQUE across the system.
  rfid_uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfid_cards_uid_idx ON public.rfid_cards(rfid_uid);
CREATE INDEX IF NOT EXISTS rfid_cards_member_idx ON public.rfid_cards(member_id);
CREATE INDEX IF NOT EXISTS rfid_cards_org_idx ON public.rfid_cards(organization_id);

ALTER TABLE public.rfid_cards ENABLE ROW LEVEL SECURITY;

-- Permissive: staff with attendance:manage permission.
DROP POLICY IF EXISTS rfid_cards_manage ON public.rfid_cards;
CREATE POLICY rfid_cards_manage ON public.rfid_cards
  FOR ALL TO authenticated
  USING (coopsetu.has_permission(organization_id, 'attendance:manage'))
  WITH CHECK (coopsetu.has_permission(organization_id, 'attendance:manage'));

-- Restrictive institution scope (AND-ed with the permissive above), following
-- the exact 0085 pattern.
DROP POLICY IF EXISTS rfid_cards_institution_scope ON public.rfid_cards;
CREATE POLICY rfid_cards_institution_scope ON public.rfid_cards
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

COMMENT ON TABLE public.rfid_cards IS
  'RFID card → organization_member mapping for kiosk attendance.';

-- ================================================================ face_slots
-- Maps an on-device ESP-DL face recognition slot to a member. Makes the CAM's
-- local slot enrollment durable and shareable across terminals, instead of
-- living only in NVS (lost on reflash or device swap).
CREATE TABLE IF NOT EXISTS public.face_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  slot INT NOT NULL,
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One member per slot per device.
  UNIQUE(device_id, slot)
);

CREATE INDEX IF NOT EXISTS face_slots_device_idx ON public.face_slots(device_id, slot);
CREATE INDEX IF NOT EXISTS face_slots_member_idx ON public.face_slots(member_id);

ALTER TABLE public.face_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS face_slots_manage ON public.face_slots;
CREATE POLICY face_slots_manage ON public.face_slots
  FOR ALL TO authenticated
  USING (coopsetu.has_permission(organization_id, 'attendance:manage'))
  WITH CHECK (coopsetu.has_permission(organization_id, 'attendance:manage'));

DROP POLICY IF EXISTS face_slots_institution_scope ON public.face_slots;
CREATE POLICY face_slots_institution_scope ON public.face_slots
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

COMMENT ON TABLE public.face_slots IS
  'On-device face recognition slot → member mapping. Per-device, synced to backend.';

-- ====================================================== device_attendance_events
-- Kiosk-style attendance: "member X was present at device Y at time Z via method M."
-- NOT session-scoped — kept separate from attendance_records (0071) by design.
CREATE TABLE IF NOT EXISTS public.device_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  device_id UUID NOT NULL REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('RFID', 'QR', 'FACE')),
  status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE', 'EXCUSED')),
  -- Face recognition confidence (0.0–1.0). NULL for RFID and QR.
  confidence NUMERIC(5,4) NULL,
  -- Raw UID for audit trail. Populated for RFID (even unknown cards) and QR scans.
  raw_uid TEXT NULL,
  -- Client-generated idempotency key for offline replay safety (Phase 4).
  -- UNIQUE constraint means re-submitting the same event after reconnect is a no-op.
  idempotency_key TEXT UNIQUE NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_attendance_events_member_time_idx
  ON public.device_attendance_events(member_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS device_attendance_events_device_time_idx
  ON public.device_attendance_events(device_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS device_attendance_events_org_time_idx
  ON public.device_attendance_events(organization_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS device_attendance_events_method_idx
  ON public.device_attendance_events(method);

ALTER TABLE public.device_attendance_events ENABLE ROW LEVEL SECURITY;

-- Members can read their own events.
DROP POLICY IF EXISTS device_attendance_events_self_read ON public.device_attendance_events;
CREATE POLICY device_attendance_events_self_read ON public.device_attendance_events
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT om.id FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid()) AND om.is_active
    )
  );

-- Staff with attendance:manage can do everything.
DROP POLICY IF EXISTS device_attendance_events_manage ON public.device_attendance_events;
CREATE POLICY device_attendance_events_manage ON public.device_attendance_events
  FOR ALL TO authenticated
  USING (coopsetu.has_permission(organization_id, 'attendance:manage'))
  WITH CHECK (coopsetu.has_permission(organization_id, 'attendance:manage'));

-- Restrictive institution scope.
DROP POLICY IF EXISTS device_attendance_events_institution_scope ON public.device_attendance_events;
CREATE POLICY device_attendance_events_institution_scope ON public.device_attendance_events
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

COMMENT ON TABLE public.device_attendance_events IS
  'Kiosk-style attendance events. Not session-scoped — see 0071 attendance_records for the trainer-armed flow.';

-- ============================================== device_tokens extensions
-- Adds metadata columns for the web dashboard's Devices management page.
-- last_seen_at already exists (bumped by authenticateDevice in lib/auth/device-auth.ts).
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Validate status values (idempotent: guard against re-running).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_tokens_status_check'
  ) THEN
    ALTER TABLE public.device_tokens
      ADD CONSTRAINT device_tokens_status_check
      CHECK (status IN ('ACTIVE', 'INACTIVE', 'REVOKED'));
  END IF;
END $$;

-- ============================================== grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfid_cards TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_slots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_attendance_events TO authenticated, service_role;
