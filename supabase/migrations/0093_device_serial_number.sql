-- ============================================================================
-- 0093 — human-readable serial number for attendance terminals
--
-- device_tokens already identifies a terminal by its bearer token (shown once,
-- then only a hint) and by label/device_name/location. None of those are
-- something an operator can read off the physical unit and type into a
-- support ticket or match against a shipping manifest. serial_number is that
-- field: entered once at provisioning time (printed on the case), distinct
-- from the bearer token and safe to display in full in the dashboard.
-- ============================================================================

ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Partial unique index rather than a table-level UNIQUE constraint: existing
-- rows and any future device issued without a serial (legacy flow) all have
-- NULL, and NULLs must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_serial_number_idx
  ON public.device_tokens(serial_number)
  WHERE serial_number IS NOT NULL;

COMMENT ON COLUMN public.device_tokens.serial_number IS
  'Manufacturer/provisioning serial printed on the physical unit. Distinct from the bearer token — this is safe to show in full.';
