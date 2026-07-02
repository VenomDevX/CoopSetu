-- ============================================================================
-- 0055_comprehensive_audit_logging.sql
-- Implements Phase 1 Comprehensive Audit Logging
-- ============================================================================

-- 1. Extend and alter audit_logs schema
ALTER TABLE public.audit_logs
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS user_agent;

ALTER TABLE public.audit_logs RENAME COLUMN resource_type TO entity_type;
ALTER TABLE public.audit_logs RENAME COLUMN resource_id TO entity_id;
ALTER TABLE public.audit_logs RENAME COLUMN old_value TO before_state;
ALTER TABLE public.audit_logs RENAME COLUMN new_value TO after_state;
ALTER TABLE public.audit_logs RENAME COLUMN created_at TO occurred_at;

ALTER TABLE public.audit_logs
  ALTER COLUMN organization_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS integrity_hash text;

ALTER TABLE public.audit_logs ALTER COLUMN actor_type DROP DEFAULT;
ALTER TABLE public.audit_logs ALTER COLUMN outcome DROP DEFAULT;

-- 2. Indexes
DROP INDEX IF EXISTS audit_logs_org_idx;
DROP INDEX IF EXISTS audit_logs_project_idx;

CREATE INDEX IF NOT EXISTS audit_logs_organization_idx ON public.audit_logs(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs(actor_member_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_request_idx ON public.audit_logs(request_id);
CREATE INDEX IF NOT EXISTS audit_logs_project_idx ON public.audit_logs(project_id, occurred_at DESC);

-- 3. Immutability controls (ensure no update/delete)
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete" ON public.audit_logs;

-- Drop function before recreating to avoid parameter rename errors
DROP FUNCTION IF EXISTS public.write_audit_log(uuid, text, text, uuid, uuid, jsonb, jsonb, jsonb);

-- Re-create write_audit_log with updated schema, keeping it restricted to SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_org uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_project_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
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
  -- Resolves actor member based on current user session
  select id into v_actor from public.organization_members
   where organization_id = p_org and user_id = auth.uid() and is_active limit 1;

  insert into public.audit_logs (
    organization_id, actor_member_id, actor_user_id, actor_type, action, entity_type, entity_id,
    project_id, outcome, before_state, after_state, metadata)
  values (
    p_org, v_actor, auth.uid(), 'USER', p_action, p_entity_type, p_entity_id,
    p_project_id, 'SUCCESS', p_before, p_after, coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;

  return v_id;
END;
$$;
-- Explicitly revoke from public and authenticated to force fallback to the secure server logic
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid,text,text,uuid,uuid,jsonb,jsonb,jsonb) FROM public, authenticated;

-- 4. Audit Trigger Function
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

-- 5. Attach trigger to required tables
DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;
CREATE TRIGGER trg_audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_tasks ON public.tasks;
CREATE TRIGGER trg_audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_organization_members ON public.organization_members;
CREATE TRIGGER trg_audit_organization_members AFTER INSERT OR UPDATE OR DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_member_roles ON public.member_roles;
CREATE TRIGGER trg_audit_member_roles AFTER INSERT OR UPDATE OR DELETE ON public.member_roles FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_bugs ON public.bugs;
CREATE TRIGGER trg_audit_bugs AFTER INSERT OR UPDATE OR DELETE ON public.bugs FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_security_reviews ON public.security_reviews;
CREATE TRIGGER trg_audit_security_reviews AFTER INSERT OR UPDATE OR DELETE ON public.security_reviews FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_releases ON public.releases;
CREATE TRIGGER trg_audit_releases AFTER INSERT OR UPDATE OR DELETE ON public.releases FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_approval_requests ON public.approval_requests;
CREATE TRIGGER trg_audit_approval_requests AFTER INSERT OR UPDATE OR DELETE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION handoff.audit_trigger();
