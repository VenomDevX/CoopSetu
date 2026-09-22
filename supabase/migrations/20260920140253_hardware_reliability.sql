-- Hardware reliability and observability.
-- Telemetry is deliberately stored as bounded JSON so firmware revisions can
-- add counters without a migration for every field. The API validates size and
-- shape before writing it.
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS firmware_version TEXT,
  ADD COLUMN IF NOT EXISTS telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_boot_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reset_reason TEXT;

ALTER TABLE public.device_tokens
  DROP CONSTRAINT IF EXISTS device_tokens_telemetry_object;
ALTER TABLE public.device_tokens
  ADD CONSTRAINT device_tokens_telemetry_object
  CHECK (jsonb_typeof(telemetry) = 'object' AND pg_column_size(telemetry) <= 8192);

COMMENT ON COLUMN public.device_tokens.telemetry IS
  'Latest bounded terminal health snapshot: RSSI, heap, reset reason, camera/NFC state, queue depth.';

-- A member may only occupy one recognition slot on a given device. This makes
-- enrollment retries deterministic and prevents two slots identifying the same
-- person after a partial terminal/server failure.
CREATE UNIQUE INDEX IF NOT EXISTS face_slots_device_member_idx
  ON public.face_slots(device_id, member_id);
