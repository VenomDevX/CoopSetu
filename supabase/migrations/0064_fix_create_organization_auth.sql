-- ============================================================================
-- Handoff — 0064 Fix create_organization NOT_AUTHENTICATED regression
-- ============================================================================
-- Bug: migration 0037 revoked EXECUTE on create_organization from `authenticated`,
-- moving all callers to invoke it via the service-role (admin) client from
-- Next.js API routes. But the function still resolved the caller via
-- `auth.uid()`, which reads the `request.jwt.claims` GUC set by PostgREST from
-- the incoming JWT's `sub` claim. The service-role JWT has no `sub` claim
-- (role: service_role only), so `auth.uid()` is always NULL for these calls —
-- every org creation (manual signup and GitHub OAuth onboarding alike) failed
-- with `NOT_AUTHENTICATED`.
--
-- Fix: accept the acting user's id explicitly as a parameter (the caller — a
-- trusted Next.js API route — already knows it from its own authenticated
-- session) instead of relying on auth.uid(), matching the service-role calling
-- convention introduced by 0037.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_organization(text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_organization(
  p_user_id uuid,
  p_name text,
  p_slug text default null,
  p_industry text default null,
  p_company_size text default null,
  p_timezone text default 'UTC',
  p_description text default null,
  p_job_family text default null,
  p_job_title text default null,
  p_professional_specialization text default null,
  p_manager_type text default null,
  p_job_description text default null
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := p_user_id;
  v_org     public.organizations;
  v_member  public.organization_members;
  v_role_id uuid;
  v_slug    text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  v_slug := coalesce(nullif(p_slug,''),
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,6));

  INSERT INTO public.organizations (name, slug, industry, company_size, timezone, description, created_by)
  VALUES (p_name, v_slug, p_industry, p_company_size, coalesce(p_timezone,'UTC'), p_description, v_uid)
  RETURNING * INTO v_org;

  INSERT INTO public.organization_members (
    organization_id, user_id, employment_status, is_active,
    job_family, job_title, professional_specialization, manager_type, job_description
  )
  VALUES (
    v_org.id, v_uid, 'ACTIVE', true,
    p_job_family, p_job_title, p_professional_specialization, p_manager_type, p_job_description
  )
  RETURNING * INTO v_member;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'ORG_OWNER' AND organization_id IS NULL;
  INSERT INTO public.member_roles (organization_member_id, role_id)
  VALUES (v_member.id, v_role_id);

  RETURN v_org;
END;
$$;

-- Keep the same grant posture as 0037: no PostgREST-facing grants for normal
-- users. Only the service-role connection (used exclusively by trusted
-- server-side code) can invoke this function. DROP FUNCTION above created a
-- new function object, which does not inherit the blanket
-- "GRANT ALL ON ALL ROUTINES" from migration 0050 (that only covered routines
-- existing at the time), so service_role must be granted explicitly again.
REVOKE EXECUTE ON FUNCTION public.create_organization FROM authenticated, PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization TO service_role;
