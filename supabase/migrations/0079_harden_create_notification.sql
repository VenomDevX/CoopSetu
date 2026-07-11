-- ============================================================================
-- Handoff — 0079 Harden create_notification against cross-tenant spoofing
-- ============================================================================
-- create_notification is SECURITY DEFINER and (since 0051 restored the grant so
-- the test suite passes) executable by `authenticated`. The prior body only
-- skipped self-notification; it never verified the caller belonged to p_org.
-- An authenticated user could therefore call it with an arbitrary p_org /
-- p_recipient / p_title / p_body and inject a notification into ANY user's
-- inbox in ANY org (a phishing / impersonation vector).
--
-- Fix: when invoked by an end user (auth.uid() IS NOT NULL, i.e. the
-- `authenticated` role), require the caller to be an active member of p_org and
-- the recipient to be an active member of the same org. Trusted server contexts
-- (service_role, where auth.uid() is NULL) keep their existing behaviour so the
-- app's server-side notification paths are unaffected. `anon` cannot reach this
-- function (revoked in 0033 and never restored).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_org uuid,
  p_recipient uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_id uuid;
BEGIN
  -- End-user (authenticated) path: enforce tenant membership on both sides.
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_actor
      FROM public.organization_members
     WHERE organization_id = p_org AND user_id = auth.uid() AND is_active
     LIMIT 1;

    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: not an active member of the target organization'
        USING errcode = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
       WHERE id = p_recipient AND organization_id = p_org AND is_active
    ) THEN
      RAISE EXCEPTION 'INVALID_RECIPIENT: recipient is not an active member of the organization'
        USING errcode = '23503';
    END IF;

    -- Don't notify yourself.
    IF v_actor = p_recipient THEN
      RETURN NULL;
    END IF;
  END IF;
  -- service_role / trusted server path: v_actor stays NULL, actor recorded as system.

  INSERT INTO public.notifications (
    organization_id, recipient_member_id, actor_member_id,
    type, title, body, entity_type, entity_id, project_id, metadata
  ) VALUES (
    p_org, p_recipient, v_actor,
    p_type, p_title, p_body, p_entity_type, p_entity_id, p_project_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
