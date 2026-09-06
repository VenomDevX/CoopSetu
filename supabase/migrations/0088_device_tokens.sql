-- ============================================================================
-- 0088 — device tokens for attendance hardware
--
-- Two problems, one fix.
--
-- 1. app/api/v1/hardware/scan/route.ts builds a service-role client inline and
--    performs no authentication whatsoever. RLS is fully bypassed and the
--    trainee's TOTP is the only control standing between the open internet and
--    an attendance write. There is also no device identity, so nothing records
--    which terminal marked a record and there is no way to revoke one.
--
-- 2. The ESP32 terminal (firmware/CoopSetuTerminal) cannot post attendance at
--    all, because /api/v1/attendance/qr authenticates with a cookie session and
--    a wall-mounted device has no cookie. The firmware already sends
--    `Authorization: Bearer <token>` (see firmware/CoopSetuTerminal/api.cpp), so
--    this table is the missing other half - no firmware change is needed.
--
-- Tokens are stored as SHA-256 hashes. The plaintext is shown once at creation
-- and never again, so a database leak does not hand over working device
-- credentials.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Which institute's terminal this is. Attendance written by the device is
  -- attributed here, and 0085's scoping applies to whoever reads it back.
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  -- Last four characters of the plaintext, so an operator can tell two
  -- terminals apart in a list without the token being recoverable.
  token_hint TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_tokens_hash_idx ON public.device_tokens(token_hash);
CREATE INDEX IF NOT EXISTS device_tokens_org_idx  ON public.device_tokens(organization_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Staff who can manage attendance can manage the terminals that record it.
-- Deliberately no SELECT policy exposing token_hash to anon: the lookup path
-- runs through the service-role client in lib/auth/device-auth.ts, which
-- bypasses RLS, so widening this would only create exposure.
DROP POLICY IF EXISTS device_tokens_manage ON public.device_tokens;
CREATE POLICY device_tokens_manage ON public.device_tokens
  FOR ALL TO authenticated
  USING (coopsetu.has_permission(organization_id, 'attendance:manage'))
  WITH CHECK (coopsetu.has_permission(organization_id, 'attendance:manage'));

COMMENT ON TABLE public.device_tokens IS
  'Bearer credentials for attendance hardware. Hashed; plaintext shown once.';
