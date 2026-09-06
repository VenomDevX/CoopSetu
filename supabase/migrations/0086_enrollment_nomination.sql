-- ============================================================================
-- 0086 — nomination metadata on enrollments
--
-- 0071 gave enrollments the right status machine
-- (PENDING -> APPROVED/REJECTED -> ENROLLED -> COMPLETED/DROPPED) but no way to
-- record *how* a row got there. PS 26087 asks for "registration and nomination
-- management", which are two different entry paths into the same lifecycle:
--
--   SELF       a candidate applies to an open programme
--   NOMINATED  an institute puts a candidate forward
--
-- Both land in PENDING and are approved by institute staff, so the columns
-- below are about provenance and audit, not a second workflow.
-- ============================================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'SELF';

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS nominated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nominated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at   TIMESTAMPTZ,
  -- Why a nomination was put forward, or why it was rejected. One column for
  -- both: the reviewer's decision note replaces the nominator's when a decision
  -- is recorded, and the status tells you which one you are reading.
  ADD COLUMN IF NOT EXISTS remarks TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_source_check') THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_source_check CHECK (source IN ('SELF', 'NOMINATED'));
  END IF;
END $$;

-- The nominations queue is always "pending rows for this programme", so the
-- index matches that access path rather than status alone.
CREATE INDEX IF NOT EXISTS enrollments_programme_status_idx
  ON public.enrollments(programme_id, status);

COMMENT ON COLUMN public.enrollments.source IS
  'SELF = candidate applied; NOMINATED = institute put them forward.';
