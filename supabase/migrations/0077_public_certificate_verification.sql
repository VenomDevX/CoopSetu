-- ============================================================================
-- CoopSetu — 0077 Public certificate verification
-- ============================================================================
-- app/api/v1/certificates/verify is documented as "Public endpoint — no auth
-- required", but public verification was broken in two independent ways:
--
--   1. lib/supabase/middleware.ts rejects every unauthenticated /api/v1/*
--      request that is not allow-listed, so the route returned 401. (Fixed in
--      the middleware, not here.)
--   2. Even past the middleware, the route queries `certificates` with the anon
--      client. `anon` holds no SELECT grant on that table and the only policy,
--      org_members_view_certificates, is restricted to org members — so the
--      query returned no row and the service reported "Certificate not found"
--      for perfectly valid certificates. A wrong answer, not an error.
--
-- Rather than granting `anon` broad SELECT on `certificates` — which would
-- expose every certificate row, and via the service's join the holder's email —
-- verification goes through this SECURITY DEFINER function. It answers for one
-- exact certificate number and returns only what a verifier needs.
--
-- Deliberately NOT returned: trainee email, trainee_id, programme_id, metadata,
-- and the qr_code. The previous implementation selected the holder's email into
-- the response; nothing in the UI ever used it.
--
-- `holder_name` IS returned: confirming that a named person holds a valid
-- credential is the entire point of verification. Certificate numbers are
-- CERT-NCCT-<year>-<6 random digits>, so guessing is throttled but not
-- impossible; the middleware's 100 req/min per-IP limit applies to this route.
--
-- NOTE: 0068 revokes `anon` EXECUTE from SECURITY DEFINER functions as a
-- blanket hardening rule. This function is a deliberate, documented exception —
-- anon MUST be able to call it — which is why it exposes a curated column list
-- instead of table access.
-- ============================================================================

begin;

create or replace function public.verify_certificate(p_certificate_number text)
returns table (
  certificate_number text,
  title              text,
  issued_at          timestamp with time zone,
  valid_until        timestamp with time zone,
  status             text,
  issuer_name        text,
  programme_title    text,
  holder_name        text
)
  language sql
  security definer
  stable
  set search_path = public, pg_catalog
as $$
  select c.certificate_number,
         c.title,
         c.issued_at,
         c.valid_until,
         c.status,
         c.issuer_name,
         p.title       as programme_title,
         pr.full_name  as holder_name
  from public.certificates c
  left join public.programmes p  on p.id  = c.programme_id
  left join public.trainees   t  on t.id  = c.trainee_id
  left join public.profiles   pr on pr.id = t.user_id
  where c.certificate_number = p_certificate_number;
$$;

comment on function public.verify_certificate(text) is
  'Public certificate verification. Returns a curated, non-sensitive view of a '
  'single certificate matched by exact certificate_number. Callable by anon by '
  'design — see 0077. Never returns the holder''s email.';

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated, service_role;

commit;
