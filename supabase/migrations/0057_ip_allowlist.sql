-- 1. Add ip_allowlist to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ip_allowlist text[] DEFAULT '{}';

-- Optional: Validate format if we wanted to enforce it in DB, but we will enforce in application logic.
