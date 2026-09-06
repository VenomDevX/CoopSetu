-- ============================================================================
-- 0089 — timetable, hostel and logistics
--
-- PS 26087 lists "timetable, hostel, and logistics management". None of it
-- existed: the only room-related column in 83 migrations was batches.room, a
-- free-text label, and attendance_sessions were created ad hoc by a trainer at
-- marking time rather than planned in advance.
--
-- The load-bearing idea here is that a published timetable slot *becomes* the
-- attendance session. Otherwise a residential institute plans in one place and
-- registers attendance in another, and the two drift.
-- ============================================================================

-- ------------------------------------------------------------------- rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'CLASSROOM'
    CHECK (kind IN ('CLASSROOM', 'LAB', 'HALL', 'SEMINAR')),
  capacity INTEGER NOT NULL DEFAULT 0,
  building TEXT,
  floor TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

-- ------------------------------------------------------------------ hostels
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'ANY' CHECK (gender IN ('MALE', 'FEMALE', 'ANY')),
  total_beds INTEGER NOT NULL DEFAULT 0,
  warden_name TEXT,
  warden_phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE TABLE IF NOT EXISTS public.hostel_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  room_number TEXT,
  bed_number TEXT,
  check_in DATE NOT NULL DEFAULT current_date,
  check_out DATE,
  -- Mess is a per-stay fact, not a separate registration table: a trainee in a
  -- hostel either eats there or does not, and modelling it separately would
  -- mean two rows that can disagree.
  mess_opted BOOLEAN NOT NULL DEFAULT true,
  dietary_preference TEXT DEFAULT 'VEG'
    CHECK (dietary_preference IN ('VEG', 'NON_VEG', 'JAIN', 'VEGAN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'CHECKED_OUT', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live allocation per trainee. A partial unique index rather than a plain
-- one, so past stays are kept for the record while a double-booking is refused.
CREATE UNIQUE INDEX IF NOT EXISTS hostel_allocations_one_active_per_trainee
  ON public.hostel_allocations(trainee_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS hostel_allocations_hostel_idx
  ON public.hostel_allocations(hostel_id, status);

-- --------------------------------------------------------------- timetable
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'LECTURE'
    CHECK (session_type IN ('LECTURE', 'LAB', 'WORKSHOP', 'EXAM')),
  -- Set when the slot is published; this is the attendance_sessions row it
  -- created, so the plan and the register are the same object.
  attendance_session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'PUBLISHED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timetable_slots_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS timetable_slots_batch_date_idx
  ON public.timetable_slots(batch_id, date);
CREATE INDEX IF NOT EXISTS timetable_slots_date_idx
  ON public.timetable_slots(organization_id, date);

-- Clash detection lives in the database rather than only in the service,
-- because a timetable that double-books a room or a trainer is wrong no matter
-- which code path wrote it. Overlap is [start, end) — a slot ending at 11:00
-- and one starting at 11:00 do not clash.
CREATE OR REPLACE FUNCTION public.timetable_conflicts(
  p_date DATE, p_start TIME, p_end TIME,
  p_room UUID, p_trainer UUID, p_batch UUID, p_exclude UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, title TEXT, reason TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT s.id, s.title,
         CASE
           WHEN p_room    IS NOT NULL AND s.room_id    = p_room    THEN 'room'
           WHEN p_trainer IS NOT NULL AND s.trainer_id = p_trainer THEN 'trainer'
           ELSE 'batch'
         END AS reason
    FROM public.timetable_slots s
   WHERE s.date = p_date
     AND s.status <> 'CANCELLED'
     AND (p_exclude IS NULL OR s.id <> p_exclude)
     AND s.start_time < p_end
     AND s.end_time   > p_start
     AND (
       (p_room    IS NOT NULL AND s.room_id    = p_room)
       OR (p_trainer IS NOT NULL AND s.trainer_id = p_trainer)
       OR (p_batch   IS NOT NULL AND s.batch_id   = p_batch)
     );
$$;

GRANT EXECUTE ON FUNCTION public.timetable_conflicts(DATE, TIME, TIME, UUID, UUID, UUID, UUID)
  TO authenticated, service_role;

-- --------------------------------------------------------------------- RLS
ALTER TABLE public.rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots    ENABLE ROW LEVEL SECURITY;

-- Org members read; staff who manage batches manage the logistics around them.
-- Follows 0080's conventions exactly rather than inventing new permissions.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['rooms', 'hostels', 'hostel_allocations', 'timetable_slots'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
         USING (coopsetu.is_org_member(organization_id))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_manage ON public.%I FOR ALL TO authenticated
         USING (coopsetu.has_permission(organization_id, ''batch:manage''))
         WITH CHECK (coopsetu.has_permission(organization_id, ''batch:manage''))', t, t);
  END LOOP;
END $$;

-- Institution scoping, same RESTRICTIVE approach as 0085: narrows, never widens.
DROP POLICY IF EXISTS rooms_institution_scope ON public.rooms;
CREATE POLICY rooms_institution_scope ON public.rooms
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

DROP POLICY IF EXISTS hostels_institution_scope ON public.hostels;
CREATE POLICY hostels_institution_scope ON public.hostels
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

GRANT ALL ON public.rooms, public.hostels, public.hostel_allocations, public.timetable_slots
  TO anon, authenticated, service_role;
