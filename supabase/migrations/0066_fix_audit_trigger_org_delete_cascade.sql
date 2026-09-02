-- ============================================================================
-- Handoff — 0066 Fix audit_trigger FK violation on organization deletion
-- ============================================================================
-- Bug: deleting an organization cascades to organization_members (and, via
-- that, member_roles), each of which has an AFTER DELETE audit_trigger that
-- inserts an audit_logs row with organization_id = the org's id. Since the
-- organizations row is already gone within the same cascading DELETE, the
-- audit_logs.organization_id foreign key check fails immediately:
--   "insert or update on table audit_logs violates foreign key constraint
--    audit_logs_organization_id_fkey"
-- This made it impossible to ever delete an organization (e.g. as part of the
-- new account-deletion feature, when a user is the sole member of their org).
--
-- Fix: if the referenced organization no longer exists (i.e. it was deleted in
-- the same cascading operation), write the audit log with organization_id
-- NULL instead of failing the whole transaction. organization_id is already
-- nullable (see migration 0055).
-- ============================================================================

CREATE OR REPLACE FUNCTION handoff.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_entity_type text;
  v_entity_id uuid;
  v_org_id uuid;
  v_proj_id uuid;
  v_actor_user_id uuid;
  v_actor_member_id uuid;
  v_req_id uuid;
BEGIN
  v_entity_type := TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_after := to_jsonb(NEW);
    v_before := null;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_before := to_jsonb(OLD);
    v_after := null;
  END IF;

  -- Safely extract IDs from the JSONB representation
  IF v_after IS NOT NULL THEN
    v_entity_id := (v_after->>'id')::uuid;
    v_org_id := (v_after->>'organization_id')::uuid;
    v_proj_id := (v_after->>'project_id')::uuid;
  ELSE
    v_entity_id := (v_before->>'id')::uuid;
    v_org_id := (v_before->>'organization_id')::uuid;
    v_proj_id := (v_before->>'project_id')::uuid;
  END IF;

  -- If the organization no longer exists (deleted earlier in the same
  -- cascading operation), null it out rather than violating the FK.
  IF v_org_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
    v_org_id := NULL;
  END IF;

  v_actor_user_id := auth.uid();
  IF v_org_id IS NOT NULL AND v_actor_user_id IS NOT NULL THEN
    v_actor_member_id := handoff.current_member_id(v_org_id);
  END IF;

  IF v_entity_type = 'organization_members' THEN
    IF v_before IS NOT NULL THEN v_before := v_before - 'user_id'; END IF;
    IF v_after IS NOT NULL THEN v_after := v_after - 'user_id'; END IF;
  END IF;

  v_req_id := gen_random_uuid();

  INSERT INTO public.audit_logs (
    organization_id, actor_user_id, actor_member_id, actor_type,
    request_id, action, entity_type, entity_id, project_id,
    outcome, before_state, after_state
  ) VALUES (
    v_org_id, v_actor_user_id, v_actor_member_id, 'USER',
    v_req_id, v_action, v_entity_type, v_entity_id, v_proj_id,
    'SUCCESS', v_before, v_after
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
