


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "handoff";


ALTER SCHEMA "handoff" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."legal_document_type" AS ENUM (
    'TERMS',
    'PRIVACY',
    'COOKIES'
);


ALTER TYPE "public"."legal_document_type" OWNER TO "postgres";


CREATE TYPE "public"."user_session_info" AS (
	"id" "uuid",
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"ip" "text",
	"user_agent" "text"
);


ALTER TYPE "public"."user_session_info" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."assign_task_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_num bigint;
  v_code text;
begin
  insert into public.org_task_counters(organization_id, last_number)
  values (new.organization_id, 1)
  on conflict (organization_id) do update set last_number = org_task_counters.last_number + 1
  returning last_number into v_num;

  new.task_number := v_num;
  select code into v_code from public.projects where id = new.project_id;
  new.task_key := coalesce(v_code,'TASK') || '-' || v_num::text;
  return new;
end;
$$;


ALTER FUNCTION "handoff"."assign_task_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."attach_updated_at"("p_table" "regclass") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  trig_name text := 'set_updated_at_' || replace(p_table::text, '.', '_');
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s;', trig_name, p_table);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION handoff.set_updated_at();',
    trig_name, p_table
  );
END;
$$;


ALTER FUNCTION "handoff"."attach_updated_at"("p_table" "regclass") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "handoff"."audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_assign_task"("p_task" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT id, organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:assign')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_task_assignee(p_task)
      )
    );
$$;


ALTER FUNCTION "handoff"."can_assign_task"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_assign_to"("p_task" "uuid", "p_member" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT id, organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:assign')
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.id = p_member
        AND m.organization_id = (SELECT organization_id FROM t)
        AND m.is_active
    )
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_member_team(p_member)
      )
    );
$$;


ALTER FUNCTION "handoff"."can_assign_to"("p_task" "uuid", "p_member" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_create_task_with_visibility"("p_org" "uuid", "p_project" "uuid", "p_visibility" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT handoff.has_permission(p_org, 'task:create')
    AND EXISTS (
      SELECT 1
      FROM public.projects pr
      WHERE pr.id = p_project
        AND pr.organization_id = p_org
    )
    AND COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT')
      IN ('PRIVATE_ASSIGNMENT', 'PROJECT_SHARED', 'ORGANIZATION_VISIBLE')
    AND (
      COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT') = 'PRIVATE_ASSIGNMENT'
      OR handoff.is_org_admin_or_owner(p_org)
      OR handoff.is_project_responsible_manager(p_project)
    );
$$;


ALTER FUNCTION "handoff"."can_create_task_with_visibility"("p_org" "uuid", "p_project" "uuid", "p_visibility" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_delete_task"("p_task" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:delete')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
    );
$$;


ALTER FUNCTION "handoff"."can_delete_task"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_edit_task"("p_task" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT id, organization_id, project_id, reporter_member_id, primary_assignee_member_id
    FROM public.tasks
    WHERE id = p_task
  ),
  me AS (
    SELECT handoff.current_member_id((SELECT organization_id FROM t)) AS member_id
  )
  SELECT handoff.can_view_task(p_task)
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:update')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (SELECT member_id FROM me) = (SELECT reporter_member_id FROM t)
      OR (SELECT member_id FROM me) = (SELECT primary_assignee_member_id FROM t)
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = p_task
          AND ta.organization_member_id = (SELECT member_id FROM me)
          AND ta.removed_at IS NULL
      )
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_task_assignee(p_task)
      )
    );
$$;


ALTER FUNCTION "handoff"."can_edit_task"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_manage_project"("p_project" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with p as (select organization_id from public.projects where id = p_project)
  select exists (select 1 from p)
    and (
      handoff.has_role((select organization_id from p),
        array['SUPER_ADMIN','ORG_OWNER','ORG_ADMIN','PROJECT_MANAGER','ENGINEERING_MANAGER'])
      or exists (
        select 1 from public.project_members pm
        join public.organization_members m on m.id = pm.organization_member_id
        where pm.project_id = p_project and m.user_id = auth.uid()
          and m.is_active and pm.can_manage
      )
    );
$$;


ALTER FUNCTION "handoff"."can_manage_project"("p_project" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_set_task_visibility"("p_task" "uuid", "p_visibility" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT organization_id, project_id
    FROM public.tasks
    WHERE id = p_task
  )
  SELECT handoff.can_edit_task(p_task)
    AND (
      COALESCE(p_visibility, 'PRIVATE_ASSIGNMENT') = 'PRIVATE_ASSIGNMENT'
      OR handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
    );
$$;


ALTER FUNCTION "handoff"."can_set_task_visibility"("p_task" "uuid", "p_visibility" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_view_project"("p_project" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with p as (select organization_id from public.projects where id = p_project)
  select exists (select 1 from p)
    and handoff.is_org_member((select organization_id from p))
    and (
      handoff.has_role((select organization_id from p),
        array['SUPER_ADMIN','ORG_OWNER','ORG_ADMIN','CEO','CTO','PROJECT_MANAGER',
              'ENGINEERING_MANAGER','AUDITOR','COMPLIANCE_REVIEWER'])
      or exists (
        select 1 from public.project_members pm
        join public.organization_members m on m.id = pm.organization_member_id
        where pm.project_id = p_project and m.user_id = auth.uid()
          and m.is_active and pm.can_view
      )
      or handoff.in_project_team(p_project)
    );
$$;


ALTER FUNCTION "handoff"."can_view_project"("p_project" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_view_release"("p_release" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT handoff.can_view_project(project_id) FROM public.releases WHERE id = p_release;
$$;


ALTER FUNCTION "handoff"."can_view_release"("p_release" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_view_task"("p_task" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT id, organization_id, project_id, reporter_member_id,
           primary_assignee_member_id, COALESCE(visibility_scope, 'PRIVATE_ASSIGNMENT') AS visibility_scope
    FROM public.tasks
    WHERE id = p_task
  ),
  me AS (
    SELECT handoff.current_member_id((SELECT organization_id FROM t)) AS member_id
  )
  SELECT EXISTS (SELECT 1 FROM t)
    AND (SELECT member_id FROM me) IS NOT NULL
    AND handoff.has_permission((SELECT organization_id FROM t), 'task:view')
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM t))
      OR (SELECT visibility_scope FROM t) = 'ORGANIZATION_VISIBLE'
      OR ((SELECT visibility_scope FROM t) = 'PROJECT_SHARED'
          AND handoff.can_view_project((SELECT project_id FROM t)))
      OR (SELECT member_id FROM me) = (SELECT reporter_member_id FROM t)
      OR (SELECT member_id FROM me) = (SELECT primary_assignee_member_id FROM t)
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = p_task
          AND ta.organization_member_id = (SELECT member_id FROM me)
          AND ta.removed_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = p_task
          AND COALESCE(ta.assigned_by_member_id, ta.assigned_by) = (SELECT member_id FROM me)
      )
      OR EXISTS (
        SELECT 1
        FROM public.task_visibility_members tvm
        WHERE tvm.task_id = p_task
          AND tvm.member_id = (SELECT member_id FROM me)
          AND tvm.revoked_at IS NULL
      )
      OR handoff.is_project_responsible_manager((SELECT project_id FROM t))
      OR (
        handoff.has_permission((SELECT organization_id FROM t), 'task:view_team_assignments')
        AND handoff.manages_task_assignee(p_task)
      )
    );
$$;


ALTER FUNCTION "handoff"."can_view_task"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."can_view_task_assignment_history"("p_task" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT handoff.can_view_task(p_task);
$$;


ALTER FUNCTION "handoff"."can_view_task_assignment_history"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."check_rate_limit"("p_ip" "text", "p_max_attempts" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'handoff'
    AS $$
declare
  v_count int;
  v_expires_at timestamptz;
begin
  -- Delete expired records for this IP before checking
  delete from public.rate_limits where ip = p_ip and expires_at <= now();

  insert into public.rate_limits (ip, count, expires_at)
  values (p_ip, 1, now() + (p_window_seconds || ' seconds')::interval)
  on conflict (ip) do update
  set count = rate_limits.count + 1
  returning count, expires_at into v_count, v_expires_at;

  if v_count > p_max_attempts then
    return false;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "handoff"."check_rate_limit"("p_ip" "text", "p_max_attempts" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."current_member_id"("p_org" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT m.id
  FROM public.organization_members m
  WHERE m.organization_id = p_org
    AND m.user_id = (SELECT auth.uid())
    AND m.is_active
  LIMIT 1;
$$;


ALTER FUNCTION "handoff"."current_member_id"("p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."generate_join_code"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$
  select 'TEAM-' ||
    (select string_agg(substr(chars, (random() * length(chars))::int + 1, 1), '')
       from (select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' as chars) c, generate_series(1, 4)) ||
    '-' ||
    (select string_agg(substr(chars, (random() * length(chars))::int + 1, 1), '')
       from (select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' as chars) c, generate_series(1, 4));
$$;


ALTER FUNCTION "handoff"."generate_join_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "handoff"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."has_permission"("p_org" "uuid", "p_perm" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.member_roles mr ON mr.organization_member_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active
      AND (
        r.code IN ('SUPER_ADMIN', 'ORG_ADMIN', 'ORG_OWNER')
        OR rp.permission_code = p_perm
      )
  );
$$;


ALTER FUNCTION "handoff"."has_permission"("p_org" "uuid", "p_perm" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."has_role"("p_org" "uuid", "p_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.member_roles mr ON mr.organization_member_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active
      AND r.code = ANY(p_roles)
  );
$$;


ALTER FUNCTION "handoff"."has_role"("p_org" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."hash_join_code"("p_raw_code" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'extensions'
    AS $$
  select encode(extensions.digest(upper(regexp_replace(p_raw_code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
$$;


ALTER FUNCTION "handoff"."hash_join_code"("p_raw_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."in_project_team"("p_project" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.project_teams pt
    join public.team_members tm on tm.team_id = pt.team_id
    join public.organization_members m on m.id = tm.organization_member_id
    where pt.project_id = p_project and m.user_id = auth.uid() and m.is_active
  );
$$;


ALTER FUNCTION "handoff"."in_project_team"("p_project" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."is_org_admin_or_owner"("p_org" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT handoff.has_role(p_org, ARRAY['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_OWNER']);
$$;


ALTER FUNCTION "handoff"."is_org_admin_or_owner"("p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."is_org_member"("p_org" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.is_active
  );
$$;


ALTER FUNCTION "handoff"."is_org_member"("p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."is_project_member"("p_project" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.project_members pm
    join public.organization_members m on m.id = pm.organization_member_id
    where pm.project_id = p_project and m.user_id = auth.uid() and m.is_active
  );
$$;


ALTER FUNCTION "handoff"."is_project_member"("p_project" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."is_project_responsible_manager"("p_project" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH p AS (
    SELECT id, organization_id, owner_member_id, project_manager_member_id
    FROM public.projects
    WHERE id = p_project
  )
  SELECT EXISTS (SELECT 1 FROM p)
    AND (
      handoff.is_org_admin_or_owner((SELECT organization_id FROM p))
      OR EXISTS (
        SELECT 1
        FROM p
        JOIN public.organization_members m
          ON m.id IN (p.owner_member_id, p.project_manager_member_id)
        WHERE m.user_id = (SELECT auth.uid())
          AND m.is_active
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.organization_members m ON m.id = pm.organization_member_id
        WHERE pm.project_id = p_project
          AND pm.can_manage
          AND m.user_id = (SELECT auth.uid())
          AND m.is_active
      )
    );
$$;


ALTER FUNCTION "handoff"."is_project_responsible_manager"("p_project" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."is_team_manager"("p_team" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with t as (select id, organization_id, team_lead_member_id from public.teams where id = p_team)
  select exists (select 1 from t)
    and (
      -- org-level managers always manage teams
      handoff.has_role((select organization_id from t),
        array['SUPER_ADMIN','ORG_OWNER','ORG_ADMIN','ENGINEERING_MANAGER'])
      or exists (  -- the team's designated lead
        select 1 from t
        join public.organization_members m on m.id = t.team_lead_member_id
        where m.user_id = auth.uid() and m.is_active
      )
      or exists (  -- a TEAM_MANAGER/TEAM_LEAD who belongs to this team
        select 1
        from public.team_members tm
        join public.organization_members m on m.id = tm.organization_member_id
        where tm.team_id = p_team and m.user_id = auth.uid() and m.is_active
          and handoff.has_role((select organization_id from t), array['TEAM_MANAGER','TEAM_LEAD'])
      )
    );
$$;


ALTER FUNCTION "handoff"."is_team_manager"("p_team" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."log_task_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid;
begin
  select id into v_actor from public.organization_members
   where organization_id = new.organization_id and user_id = auth.uid() and is_active limit 1;
  if new.status is distinct from old.status then
    insert into public.task_activity(task_id, actor_member_id, activity_type, old_value, new_value)
    values (new.id, v_actor, 'status_changed', to_jsonb(old.status), to_jsonb(new.status));
  end if;
  if new.primary_assignee_member_id is distinct from old.primary_assignee_member_id then
    insert into public.task_activity(task_id, actor_member_id, activity_type, old_value, new_value)
    values (new.id, v_actor, 'assignee_changed',
      to_jsonb(old.primary_assignee_member_id), to_jsonb(new.primary_assignee_member_id));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "handoff"."log_task_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."manages_member_team"("p_member" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.team_members tm
    where tm.organization_member_id = p_member
      and handoff.is_team_manager(tm.team_id)
  );
$$;


ALTER FUNCTION "handoff"."manages_member_team"("p_member" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."manages_task_assignee"("p_task" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH t AS (
    SELECT id, organization_id, primary_assignee_member_id
    FROM public.tasks
    WHERE id = p_task
  ),
  me AS (
    SELECT handoff.current_member_id((SELECT organization_id FROM t)) AS member_id
  ),
  assigned AS (
    SELECT primary_assignee_member_id AS member_id FROM t WHERE primary_assignee_member_id IS NOT NULL
    UNION
    SELECT organization_member_id FROM public.task_assignees
    WHERE task_id = p_task AND removed_at IS NULL
  )
  SELECT EXISTS (SELECT 1 FROM t)
    AND (SELECT member_id FROM me) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM assigned a
      JOIN public.organization_members m ON m.id = a.member_id
      WHERE m.manager_id = (SELECT member_id FROM me)
         OR handoff.manages_member_team(a.member_id)
    );
$$;


ALTER FUNCTION "handoff"."manages_task_assignee"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."notify_task_assigned"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_task record;
begin
  select t.organization_id, t.project_id, t.title, t.task_key
    into v_task from public.tasks t where t.id = new.task_id;
  perform public.create_notification(
    v_task.organization_id, new.organization_member_id, 'TASK_ASSIGNED',
    'You were assigned to ' || coalesce(v_task.task_key,'a task'),
    v_task.title, 'task', new.task_id, v_task.project_id, '{}'::jsonb);
  return new;
end;
$$;


ALTER FUNCTION "handoff"."notify_task_assigned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."project_org"("p_project" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select organization_id from public.projects where id = p_project;
$$;


ALTER FUNCTION "handoff"."project_org"("p_project" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "handoff"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."storage_org_ok"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'storage'
    AS $$
  select handoff.is_org_member(((storage.foldername(p_name))[1])::uuid);
$$;


ALTER FUNCTION "handoff"."storage_org_ok"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."task_org"("p_task" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organization_id FROM public.tasks WHERE id = p_task;
$$;


ALTER FUNCTION "handoff"."task_org"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."task_project"("p_task" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select project_id from public.tasks where id = p_task;
$$;


ALTER FUNCTION "handoff"."task_project"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "handoff"."team_org"("p_team" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select organization_id from public.teams where id = p_team;
$$;


ALTER FUNCTION "handoff"."team_org"("p_team" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite"("p_token_hash" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_email  text;
  v_inv    public.organization_invites;
  v_member uuid;
  v_role   uuid;
  v_roles_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_inv FROM public.organization_invites WHERE invite_token_hash = p_token_hash;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
  IF v_inv.status <> 'PENDING' THEN RAISE EXCEPTION 'INVITE_NOT_PENDING'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.organization_invites SET status = 'EXPIRED' WHERE id = v_inv.id;
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_inv.email IS NOT NULL AND lower(v_inv.email) <> lower(coalesce(v_email,'')) THEN
    RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH';
  END IF;

  INSERT INTO public.profiles (id, email) VALUES (v_uid, v_email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organization_members (
    organization_id, user_id, employment_status, is_active,
    department_id, job_family, job_title, manager_type
  )
  VALUES (
    v_inv.organization_id, v_uid, 'ACTIVE', true,
    v_inv.assigned_department_id, v_inv.assigned_job_family,
    v_inv.assigned_job_title, v_inv.assigned_manager_type
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE SET 
    is_active = true,
    department_id = coalesce(v_inv.assigned_department_id, public.organization_members.department_id),
    job_family = coalesce(v_inv.assigned_job_family, public.organization_members.job_family),
    job_title = coalesce(v_inv.assigned_job_title, public.organization_members.job_title),
    manager_type = coalesce(v_inv.assigned_manager_type, public.organization_members.manager_type)
  RETURNING id INTO v_member;
  
  IF v_member IS NULL THEN
    SELECT id INTO v_member FROM public.organization_members
     WHERE organization_id = v_inv.organization_id AND user_id = v_uid;
  END IF;

  IF v_inv.assigned_team_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, organization_member_id)
    VALUES (v_inv.assigned_team_id, v_member) ON CONFLICT DO NOTHING;
  END IF;

  -- Insert roles from the relational table
  INSERT INTO public.member_roles (organization_member_id, role_id)
  SELECT v_member, role_id FROM public.organization_invite_roles WHERE invite_id = v_inv.id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_roles_count = ROW_COUNT;

  -- Fallback to the text code if no relational roles exist
  IF v_roles_count = 0 THEN
    SELECT id INTO v_role FROM public.roles
     WHERE code = v_inv.role_code AND (organization_id IS NULL OR organization_id = v_inv.organization_id)
     ORDER BY organization_id NULLS LAST LIMIT 1;
    IF v_role IS NOT NULL THEN
      INSERT INTO public.member_roles (organization_member_id, role_id)
      VALUES (v_member, v_role) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE public.organization_invites
     SET status = 'ACCEPTED', accepted_at = now() WHERE id = v_inv.id;

  RETURN v_inv.organization_id;
END;
$$;


ALTER FUNCTION "public"."accept_invite"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_epic_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_org uuid; v_proj_org uuid;
BEGIN
  IF NEW.owner_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_owner_org FROM public.organization_members WHERE id = NEW.owner_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_owner_org THEN RAISE EXCEPTION 'Cross-tenant epic owner_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant epic project_id' USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_epic_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_project_deadline_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_project_org uuid;
  v_sprint_org uuid;
  v_task_org uuid;
  v_release_org uuid;
  v_owner_org uuid;
  v_creator_org uuid;
begin
  select organization_id into v_project_org from public.projects where id = new.project_id;
  if new.organization_id is distinct from v_project_org then
    raise exception 'Cross-tenant deadline project_id' using errcode = '23503';
  end if;

  if new.sprint_id is not null then
    select organization_id into v_sprint_org from public.sprints where id = new.sprint_id;
    if new.organization_id is distinct from v_sprint_org then
      raise exception 'Cross-tenant deadline sprint_id' using errcode = '23503';
    end if;
  end if;

  if new.task_id is not null then
    select organization_id into v_task_org from public.tasks where id = new.task_id;
    if new.organization_id is distinct from v_task_org then
      raise exception 'Cross-tenant deadline task_id' using errcode = '23503';
    end if;
  end if;

  if new.release_id is not null then
    select organization_id into v_release_org from public.releases where id = new.release_id;
    if new.organization_id is distinct from v_release_org then
      raise exception 'Cross-tenant deadline release_id' using errcode = '23503';
    end if;
  end if;

  if new.owner_member_id is not null then
    select organization_id into v_owner_org from public.organization_members where id = new.owner_member_id;
    if new.organization_id is distinct from v_owner_org then
      raise exception 'Cross-tenant deadline owner_member_id' using errcode = '23503';
    end if;
  end if;

  if new.created_by_member_id is not null then
    select organization_id into v_creator_org from public.organization_members where id = new.created_by_member_id;
    if new.organization_id is distinct from v_creator_org then
      raise exception 'Cross-tenant deadline created_by_member_id' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."check_project_deadline_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_project_member_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_proj_org uuid; v_mem_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  SELECT organization_id INTO v_mem_org FROM public.organization_members WHERE id = NEW.organization_member_id;
  IF v_proj_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for project_members' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_project_member_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_project_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_org uuid; v_pm_org uuid; v_port_org uuid; v_prog_org uuid;
BEGIN
  IF NEW.owner_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_owner_org FROM public.organization_members WHERE id = NEW.owner_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_owner_org THEN RAISE EXCEPTION 'Cross-tenant owner_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.project_manager_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_pm_org FROM public.organization_members WHERE id = NEW.project_manager_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_pm_org THEN RAISE EXCEPTION 'Cross-tenant project_manager_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.portfolio_id IS NOT NULL THEN
    SELECT organization_id INTO v_port_org FROM public.portfolios WHERE id = NEW.portfolio_id;
    IF NEW.organization_id IS DISTINCT FROM v_port_org THEN RAISE EXCEPTION 'Cross-tenant portfolio_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.program_id IS NOT NULL THEN
    SELECT organization_id INTO v_prog_org FROM public.programs WHERE id = NEW.program_id;
    IF NEW.organization_id IS DISTINCT FROM v_prog_org THEN RAISE EXCEPTION 'Cross-tenant program_id' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_project_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_sprint_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_proj_org uuid; v_team_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant sprint project_id' USING ERRCODE = '23503'; END IF;
  IF NEW.team_id IS NOT NULL THEN
    SELECT organization_id INTO v_team_org FROM public.teams WHERE id = NEW.team_id;
    IF NEW.organization_id IS DISTINCT FROM v_team_org THEN RAISE EXCEPTION 'Cross-tenant sprint team_id' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_sprint_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_task_assignee_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_task_org uuid;
  v_task_project uuid;
  v_mem_org uuid;
  v_assigner_org uuid;
  v_removed_by_org uuid;
BEGIN
  SELECT organization_id, project_id INTO v_task_org, v_task_project
  FROM public.tasks
  WHERE id = NEW.task_id;

  SELECT organization_id INTO v_mem_org
  FROM public.organization_members
  WHERE id = NEW.organization_member_id;

  IF v_task_org IS DISTINCT FROM v_mem_org THEN
    RAISE EXCEPTION 'Cross-tenant assignment blocked for task_assignees' USING ERRCODE = '23503';
  END IF;

  NEW.organization_id := COALESCE(NEW.organization_id, v_task_org);
  NEW.project_id := COALESCE(NEW.project_id, v_task_project);
  NEW.assigned_by_member_id := COALESCE(NEW.assigned_by_member_id, NEW.assigned_by);

  IF NEW.organization_id IS DISTINCT FROM v_task_org OR NEW.project_id IS DISTINCT FROM v_task_project THEN
    RAISE EXCEPTION 'Cross-tenant assignment metadata blocked for task_assignees' USING ERRCODE = '23503';
  END IF;

  IF NEW.assigned_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_assigner_org
    FROM public.organization_members
    WHERE id = NEW.assigned_by_member_id;
    IF v_assigner_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant assigned_by_member_id blocked for task_assignees' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF NEW.removed_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_removed_by_org
    FROM public.organization_members
    WHERE id = NEW.removed_by_member_id;
    IF v_removed_by_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant removed_by_member_id blocked for task_assignees' USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_task_assignee_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_task_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_proj_org uuid; v_epic_org uuid; v_sprint_org uuid; v_reporter_org uuid; v_assignee_org uuid;
BEGIN
  SELECT organization_id INTO v_proj_org FROM public.projects WHERE id = NEW.project_id;
  IF NEW.organization_id IS DISTINCT FROM v_proj_org THEN RAISE EXCEPTION 'Cross-tenant task project_id' USING ERRCODE = '23503'; END IF;
  IF NEW.epic_id IS NOT NULL THEN
    SELECT organization_id INTO v_epic_org FROM public.epics WHERE id = NEW.epic_id;
    IF NEW.organization_id IS DISTINCT FROM v_epic_org THEN RAISE EXCEPTION 'Cross-tenant task epic_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.sprint_id IS NOT NULL THEN
    SELECT organization_id INTO v_sprint_org FROM public.sprints WHERE id = NEW.sprint_id;
    IF NEW.organization_id IS DISTINCT FROM v_sprint_org THEN RAISE EXCEPTION 'Cross-tenant task sprint_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.reporter_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_reporter_org FROM public.organization_members WHERE id = NEW.reporter_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_reporter_org THEN RAISE EXCEPTION 'Cross-tenant task reporter_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  IF NEW.primary_assignee_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_assignee_org FROM public.organization_members WHERE id = NEW.primary_assignee_member_id;
    IF NEW.organization_id IS DISTINCT FROM v_assignee_org THEN RAISE EXCEPTION 'Cross-tenant task primary_assignee_member_id' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_task_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_task_visibility_member_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_task_org uuid;
  v_member_org uuid;
  v_granter_org uuid;
  v_revoker_org uuid;
BEGIN
  SELECT organization_id INTO v_task_org
  FROM public.tasks
  WHERE id = NEW.task_id;

  SELECT organization_id INTO v_member_org
  FROM public.organization_members
  WHERE id = NEW.member_id;

  IF v_task_org IS DISTINCT FROM v_member_org THEN
    RAISE EXCEPTION 'Cross-tenant member blocked for task_visibility_members' USING ERRCODE = '23503';
  END IF;

  IF NEW.granted_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_granter_org
    FROM public.organization_members
    WHERE id = NEW.granted_by_member_id;
    IF v_granter_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant granter blocked for task_visibility_members' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF NEW.revoked_by_member_id IS NOT NULL THEN
    SELECT organization_id INTO v_revoker_org
    FROM public.organization_members
    WHERE id = NEW.revoked_by_member_id;
    IF v_revoker_org IS DISTINCT FROM v_task_org THEN
      RAISE EXCEPTION 'Cross-tenant revoker blocked for task_visibility_members' USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_task_visibility_member_tenant"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bugs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "release_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "environment" "text",
    "reporter_member_id" "uuid",
    "assignee_member_id" "uuid",
    "steps_to_reproduce" "text",
    "expected_result" "text",
    "actual_result" "text",
    "root_cause" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bugs_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "bugs_severity_check" CHECK (("severity" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "bugs_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text", 'WONT_FIX'::"text"])))
);


ALTER TABLE "public"."bugs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_bug"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") RETURNS "public"."bugs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_bug public.bugs;
  v_task_id uuid;
  v_actor_member_id uuid;
BEGIN
  v_actor_member_id := handoff.current_member_id(auth.uid(), p_organization_id);
  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  INSERT INTO public.bugs (
    organization_id, project_id, sprint_id, release_id, incident_id,
    title, environment, severity, priority,
    steps_to_reproduce, expected_result, actual_result, reporter_member_id
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'sprint_id')::uuid,
    (p_payload->>'release_id')::uuid,
    (p_payload->>'incident_id')::uuid,
    p_payload->>'title',
    p_payload->>'environment',
    COALESCE(p_payload->>'severity', 'MODERATE'),
    COALESCE(p_payload->>'priority', 'MEDIUM'),
    p_payload->>'steps_to_reproduce',
    p_payload->>'expected_result',
    p_payload->>'actual_result',
    v_actor_member_id
  ) RETURNING * INTO v_bug;

  IF (p_payload->>'assignee_member_id') IS NOT NULL THEN
    INSERT INTO public.bug_assignments (organization_id, bug_id, member_id, assignment_type, assigned_by_member_id)
    VALUES (p_organization_id, v_bug.id, (p_payload->>'assignee_member_id')::uuid, 'ASSIGNEE', v_actor_member_id);
  END IF;

  IF p_payload->'task_ids' IS NOT NULL AND jsonb_typeof(p_payload->'task_ids') = 'array' THEN
    FOR v_task_id IN SELECT (jsonb_array_elements_text(p_payload->'task_ids'))::uuid LOOP
      INSERT INTO public.bug_tasks (organization_id, bug_id, task_id, linked_by_member_id)
      VALUES (p_organization_id, v_bug.id, v_task_id, v_actor_member_id);
    END LOOP;
  END IF;

  RETURN v_bug;
END;
$$;


ALTER FUNCTION "public"."create_bug"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_org" "uuid", "p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text" DEFAULT NULL::"text", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_project_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_notification"("p_org" "uuid", "p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_path" "text",
    "industry" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "working_days" integer[] DEFAULT '{1,2,3,4,5}'::integer[],
    "theme_preference" "text" DEFAULT 'system'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_size" "text",
    "description" "text",
    "is_demo" boolean DEFAULT false NOT NULL,
    "demo_session_id" "uuid",
    "ip_allowlist" "text"[] DEFAULT '{}'::"text"[],
    "initial_setup_completed_at" timestamp with time zone,
    "workspace_type" "text" DEFAULT 'ENTERPRISE'::"text" NOT NULL,
    CONSTRAINT "organizations_workspace_type_check" CHECK (("workspace_type" = ANY (ARRAY['ENTERPRISE'::"text", 'STUDENT_SOLO'::"text", 'STUDENT_TEAM'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization"("p_user_id" "uuid", "p_name" "text", "p_slug" "text" DEFAULT NULL::"text", "p_industry" "text" DEFAULT NULL::"text", "p_company_size" "text" DEFAULT NULL::"text", "p_timezone" "text" DEFAULT 'UTC'::"text", "p_description" "text" DEFAULT NULL::"text", "p_job_family" "text" DEFAULT NULL::"text", "p_job_title" "text" DEFAULT NULL::"text", "p_professional_specialization" "text" DEFAULT NULL::"text", "p_manager_type" "text" DEFAULT NULL::"text", "p_job_description" "text" DEFAULT NULL::"text") RETURNS "public"."organizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_organization"("p_user_id" "uuid", "p_name" "text", "p_slug" "text", "p_industry" "text", "p_company_size" "text", "p_timezone" "text", "p_description" "text", "p_job_family" "text", "p_job_title" "text", "p_professional_specialization" "text", "p_manager_type" "text", "p_job_description" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "portfolio_id" "uuid",
    "program_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "business_objective" "text",
    "scope" "text",
    "owner_member_id" "uuid",
    "project_manager_member_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "health" "text" DEFAULT 'ON_TRACK'::"text" NOT NULL,
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "security_classification" "text" DEFAULT 'INTERNAL'::"text" NOT NULL,
    "start_date" "date",
    "target_end_date" "date",
    "actual_end_date" "date",
    "budget_amount" numeric,
    "effort_estimate_hours" numeric,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_health_check" CHECK (("health" = ANY (ARRAY['ON_TRACK'::"text", 'AT_RISK'::"text", 'OFF_TRACK'::"text"]))),
    CONSTRAINT "projects_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "projects_security_classification_check" CHECK (("security_classification" = ANY (ARRAY['PUBLIC'::"text", 'INTERNAL'::"text", 'CONFIDENTIAL'::"text", 'RESTRICTED'::"text"]))),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['PLANNING'::"text", 'ACTIVE'::"text", 'ON_HOLD'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_project"("p_org" "uuid", "p_payload" "jsonb") RETURNS "public"."projects"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proj public.projects;
  v_owner uuid;
  v_pm uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING errcode = '28000'; END IF;
  IF NOT handoff.is_org_member(p_org) THEN RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF NOT handoff.has_permission(p_org, 'project:create') THEN RAISE EXCEPTION 'FORBIDDEN: project:create' USING errcode = '42501'; END IF;

  v_owner := (p_payload->>'owner_member_id')::uuid;
  v_pm := (p_payload->>'project_manager_member_id')::uuid;

  IF v_owner IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE id = v_owner AND organization_id = p_org AND is_active = true) THEN
      RAISE EXCEPTION 'INVALID_OWNER';
    END IF;
  END IF;

  IF v_pm IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE id = v_pm AND organization_id = p_org AND is_active = true) THEN
      RAISE EXCEPTION 'INVALID_PROJECT_MANAGER';
    END IF;
  END IF;

  INSERT INTO public.projects (
    organization_id, name, code, description, business_objective, scope,
    portfolio_id, program_id, owner_member_id, project_manager_member_id,
    status, priority, security_classification,
    start_date, target_end_date, budget_amount, effort_estimate_hours
  ) VALUES (
    p_org,
    p_payload->>'name',
    p_payload->>'code',
    nullif(p_payload->>'description', ''),
    nullif(p_payload->>'business_objective', ''),
    nullif(p_payload->>'scope', ''),
    (p_payload->>'portfolio_id')::uuid,
    (p_payload->>'program_id')::uuid,
    v_owner,
    v_pm,
    coalesce(nullif(p_payload->>'status', ''), 'PLANNING'),
    coalesce(nullif(p_payload->>'priority', ''), 'MEDIUM'),
    coalesce(nullif(p_payload->>'security_classification', ''), 'INTERNAL'),
    (p_payload->>'start_date')::date,
    (p_payload->>'target_end_date')::date,
    (p_payload->>'budget_amount')::numeric,
    (p_payload->>'effort_estimate_hours')::numeric
  )
  RETURNING * INTO v_proj;

  RETURN v_proj;
END;
$$;


ALTER FUNCTION "public"."create_project"("p_org" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "department_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "team_lead_member_id" "uuid",
    "capacity_hours_per_week" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "team_type" "text" DEFAULT 'ORGANIZATION_TEAM'::"text" NOT NULL,
    "created_by_member_id" "uuid",
    CONSTRAINT "teams_team_type_check" CHECK (("team_type" = ANY (ARRAY['ORGANIZATION_TEAM'::"text", 'PROJECT_TEAM'::"text"])))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_project_team"("p_project_id" "uuid", "p_team_name" "text", "p_team_code" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."teams"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project public.projects;
  v_org_id uuid;
  v_team public.teams;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_project IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  
  v_org_id := v_project.organization_id;

  SELECT id INTO v_member_id FROM public.organization_members WHERE user_id = v_uid AND organization_id = v_org_id AND is_active = true;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF NOT handoff.can_manage_project(p_project_id) THEN
    RAISE EXCEPTION 'NOT_PROJECT_MANAGER';
  END IF;

  IF NOT handoff.has_permission(v_org_id, 'team:create_project_team') THEN
    RAISE EXCEPTION 'MISSING_PERMISSION_CREATE_PROJECT_TEAM';
  END IF;

  INSERT INTO public.teams (
    organization_id, name, code, description, team_type, created_by_member_id
  ) VALUES (
    v_org_id, p_team_name, p_team_code, p_description, 'PROJECT_TEAM', v_member_id
  ) RETURNING * INTO v_team;

  INSERT INTO public.project_teams (
    project_id, team_id
  ) VALUES (
    p_project_id, v_team.id
  );

  RETURN v_team;
END;
$$;


ALTER FUNCTION "public"."create_project_team"("p_project_id" "uuid", "p_team_name" "text", "p_team_code" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_student_solo_workspace"("p_user_id" "uuid", "p_name" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."organizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org public.organizations;
  v_member_id uuid;
  v_role_id uuid;
  v_slug text;
begin
  if p_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  v_slug := 'student-' || substr(gen_random_uuid()::text, 1, 12);

  insert into public.organizations (name, slug, workspace_type, description, created_by, initial_setup_completed_at)
  values (p_name, v_slug, 'STUDENT_SOLO', p_description, p_user_id, now())
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_org.id, p_user_id, 'ACTIVE', true)
  returning id into v_member_id;

  select id into v_role_id from public.roles where code = 'STUDENT_SOLO_OWNER' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id) values (v_member_id, v_role_id);

  return v_org;
end;
$$;


ALTER FUNCTION "public"."create_student_solo_workspace"("p_user_id" "uuid", "p_name" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_student_team"("p_user_id" "uuid", "p_name" "text", "p_event_name" "text" DEFAULT NULL::"text", "p_short_description" "text" DEFAULT NULL::"text", "p_expected_team_size" integer DEFAULT NULL::integer, "p_max_team_size" integer DEFAULT 10, "p_primary_team_role" "text" DEFAULT NULL::"text") RETURNS TABLE("out_organization_id" "uuid", "out_name" "text", "out_slug" "text", "raw_join_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org public.organizations;
  v_member_id uuid;
  v_role_id uuid;
  v_slug text;
  v_raw_code text;
begin
  if p_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_max_team_size is null or p_max_team_size <= 0 or p_max_team_size > 50 then
    raise exception 'INVALID_MAX_TEAM_SIZE';
  end if;

  v_slug := 'student-team-' || substr(gen_random_uuid()::text, 1, 12);

  insert into public.organizations (name, slug, workspace_type, created_by, initial_setup_completed_at)
  values (p_name, v_slug, 'STUDENT_TEAM', p_user_id, now())
  returning * into v_org;

  insert into public.student_team_settings (
    organization_id, event_name, short_description, expected_team_size,
    max_team_size, primary_team_role
  ) values (
    v_org.id, p_event_name, p_short_description, p_expected_team_size,
    p_max_team_size, p_primary_team_role
  );

  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_org.id, p_user_id, 'ACTIVE', true)
  returning id into v_member_id;

  select id into v_role_id from public.roles where code = 'STUDENT_TEAM_LEAD' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id) values (v_member_id, v_role_id);

  v_raw_code := handoff.generate_join_code();
  insert into public.student_team_join_codes (organization_id, code_hash, created_by)
  values (v_org.id, handoff.hash_join_code(v_raw_code), v_member_id);

  return query select v_org.id, v_org.name, v_org.slug, v_raw_code::text;
end;
$$;


ALTER FUNCTION "public"."create_student_team"("p_user_id" "uuid", "p_name" "text", "p_event_name" "text", "p_short_description" "text", "p_expected_team_size" integer, "p_max_team_size" integer, "p_primary_team_role" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "release_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "owner_member_id" "uuid",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "environment" "text",
    "scope" "text",
    "acceptance_criteria" "text"
);


ALTER TABLE "public"."test_plans" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_test_plan"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") RETURNS "public"."test_plans"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan public.test_plans;
  v_task_id uuid;
  v_reviewer_id uuid;
  v_test_case jsonb;
  v_actor_member_id uuid;
BEGIN
  v_actor_member_id := handoff.current_member_id(auth.uid(), p_organization_id);
  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  INSERT INTO public.test_plans (
    organization_id, project_id, sprint_id, release_id,
    title, environment, scope, acceptance_criteria, due_date, owner_member_id
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'sprint_id')::uuid,
    (p_payload->>'release_id')::uuid,
    p_payload->>'title',
    p_payload->>'environment',
    p_payload->>'scope',
    p_payload->>'acceptance_criteria',
    CASE WHEN p_payload->>'due_date' IS NOT NULL AND p_payload->>'due_date' != '' THEN (p_payload->>'due_date')::date ELSE NULL END,
    (p_payload->>'owner_member_id')::uuid
  ) RETURNING * INTO v_plan;

  IF (p_payload->>'owner_member_id') IS NOT NULL THEN
    INSERT INTO public.test_plan_assignments (
      organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
    ) VALUES (
      p_organization_id, v_plan.id, (p_payload->>'owner_member_id')::uuid, 'OWNER', v_actor_member_id
    );
  END IF;

  IF p_payload->'reviewer_ids' IS NOT NULL AND jsonb_typeof(p_payload->'reviewer_ids') = 'array' THEN
    FOR v_reviewer_id IN SELECT (jsonb_array_elements_text(p_payload->'reviewer_ids'))::uuid LOOP
      INSERT INTO public.test_plan_assignments (
        organization_id, test_plan_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_reviewer_id, 'REVIEWER', v_actor_member_id
      );
    END LOOP;
  END IF;

  IF p_payload->'task_ids' IS NOT NULL AND jsonb_typeof(p_payload->'task_ids') = 'array' THEN
    FOR v_task_id IN SELECT (jsonb_array_elements_text(p_payload->'task_ids'))::uuid LOOP
      INSERT INTO public.test_plan_tasks (
        organization_id, test_plan_id, task_id, linked_by_member_id
      ) VALUES (
        p_organization_id, v_plan.id, v_task_id, v_actor_member_id
      );
    END LOOP;
  END IF;

  IF p_payload->'test_cases' IS NOT NULL AND jsonb_typeof(p_payload->'test_cases') = 'array' THEN
    FOR v_test_case IN SELECT * FROM jsonb_array_elements(p_payload->'test_cases') LOOP
      INSERT INTO public.test_cases (
        organization_id, project_id, test_plan_id,
        title, preconditions, steps, expected_result, priority
      ) VALUES (
        p_organization_id, p_project_id, v_plan.id,
        v_test_case->>'title',
        v_test_case->>'preconditions',
        v_test_case->>'steps',
        v_test_case->>'expected_result',
        COALESCE(v_test_case->>'priority', 'MEDIUM')
      );
    END LOOP;
  END IF;

  RETURN v_plan;
END;
$$;


ALTER FUNCTION "public"."create_test_plan"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_sessions"() RETURNS SETOF "public"."user_session_info"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT 
    id, 
    created_at, 
    updated_at, 
    ip, 
    user_agent
  FROM auth.sessions
  WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_active_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invite"("p_token_hash" "text") RETURNS TABLE("organization_id" "uuid", "organization_name" "text", "email" "text", "role_code" "text", "status" "text", "is_expired" boolean, "assigned_department_id" "uuid", "assigned_team_id" "uuid", "assigned_job_family" "text", "assigned_job_title" "text", "assigned_manager_type" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT i.organization_id, o.name, i.email, i.role_code, i.status,
         (i.expires_at < now()) as is_expired,
         i.assigned_department_id, i.assigned_team_id,
         i.assigned_job_family, i.assigned_job_title,
         i.assigned_manager_type
  FROM public.organization_invites i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.invite_token_hash = p_token_hash;
$$;


ALTER FUNCTION "public"."get_invite"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_join_code_status"("p_org" "uuid") RETURNS TABLE("id" "uuid", "organization_id" "uuid", "created_by" "uuid", "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "max_uses" integer, "used_count" integer, "is_active" boolean, "revoked_at" timestamp with time zone, "last_rotated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jc.id, jc.organization_id, jc.created_by, jc.created_at,
         jc.expires_at, jc.max_uses, jc.used_count, jc.is_active,
         jc.revoked_at, jc.last_rotated_at
  from public.student_team_join_codes jc
  where jc.organization_id = p_org
    and jc.is_active
    and handoff.has_permission(p_org, 'student_team:manage_join_code')
  order by jc.created_at desc
  limit 1;
$$;


ALTER FUNCTION "public"."get_join_code_status"("p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."member_permissions"("p_member" "uuid") RETURNS TABLE("permission_code" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with m as (
    select * from public.organization_members where id = p_member and user_id = auth.uid() and is_active = true
  )
  select distinct p.code
  from m
  cross join public.permissions p
  where exists (
    select 1
    from public.member_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.organization_member_id = m.id
      and r.code in ('SUPER_ADMIN','ORG_ADMIN','ORG_OWNER')
  )
  union
  select distinct rp.permission_code
  from m
  join public.member_roles mr on mr.organization_member_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id;
$$;


ALTER FUNCTION "public"."member_permissions"("p_member" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_join_code"("p_raw_code" "text") RETURNS TABLE("team_name" "text", "event_name" "text", "available_spots" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select o.name, s.event_name,
         greatest(s.max_team_size - (
           select count(*) from public.organization_members m
           where m.organization_id = o.id and m.is_active
         ), 0)
  from public.student_team_join_codes jc
  join public.organizations o on o.id = jc.organization_id and o.workspace_type = 'STUDENT_TEAM'
  join public.student_team_settings s on s.organization_id = o.id
  where jc.code_hash = handoff.hash_join_code(p_raw_code)
    and jc.is_active
    and (jc.expires_at is null or jc.expires_at > now())
    and (jc.max_uses is null or jc.used_count < jc.max_uses);
$$;


ALTER FUNCTION "public"."preview_join_code"("p_raw_code" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_legal_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "terms_document_id" "uuid" NOT NULL,
    "privacy_document_id" "uuid" NOT NULL,
    "cookies_document_id" "uuid",
    "accepted_terms_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_privacy_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_cookies_at" timestamp with time zone,
    "acceptance_source" "text" NOT NULL,
    "request_id" "text" NOT NULL,
    "ip_hash" "text",
    "user_agent_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_legal_acceptances" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_legal_acceptance"("p_terms_document_id" "uuid", "p_privacy_document_id" "uuid", "p_cookies_document_id" "uuid", "p_acceptance_source" "text", "p_request_id" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") RETURNS "public"."user_legal_acceptances"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.user_legal_acceptances;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Re-verify both documents are the currently active, published version of
  -- the correct type. This blocks acceptance against a stale/superseded id.
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_terms_document_id AND document_type = 'TERMS'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Terms document is not the active version';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_privacy_document_id AND document_type = 'PRIVACY'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Privacy document is not the active version';
  END IF;

  IF p_cookies_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_cookies_document_id AND document_type = 'COOKIES'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cookies document is not the active version';
  END IF;

  INSERT INTO public.user_legal_acceptances (
    user_id, terms_document_id, privacy_document_id, cookies_document_id,
    accepted_terms_at, accepted_privacy_at, accepted_cookies_at,
    acceptance_source, request_id, ip_hash, user_agent_hash
  ) VALUES (
    auth.uid(), p_terms_document_id, p_privacy_document_id, p_cookies_document_id,
    now(), now(), CASE WHEN p_cookies_document_id IS NOT NULL THEN now() ELSE NULL END,
    p_acceptance_source, p_request_id, p_ip_hash, p_user_agent_hash
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."record_legal_acceptance"("p_terms_document_id" "uuid", "p_privacy_document_id" "uuid", "p_cookies_document_id" "uuid", "p_acceptance_source" "text", "p_request_id" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_student_team_join_code"("p_user_id" "uuid", "p_raw_code" "text") RETURNS "public"."organizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_hash text;
  v_jc record;
  v_org record;
  v_member_count int;
  v_max_size int;
  v_member_id uuid;
  v_role_id uuid;
begin
  if p_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_raw_code is null or length(trim(p_raw_code)) = 0 then raise exception 'INVALID_CODE'; end if;

  v_hash := handoff.hash_join_code(p_raw_code);

  select * into v_jc from public.student_team_join_codes
    where code_hash = v_hash and is_active
    for update;

  if not found then raise exception 'INVALID_CODE'; end if;
  if v_jc.expires_at is not null and v_jc.expires_at < now() then raise exception 'INVALID_CODE'; end if;
  if v_jc.max_uses is not null and v_jc.used_count >= v_jc.max_uses then raise exception 'INVALID_CODE'; end if;

  select * into v_org from public.organizations
    where id = v_jc.organization_id and workspace_type = 'STUDENT_TEAM';
  if not found then raise exception 'INVALID_CODE'; end if;

  select id into v_member_id from public.organization_members
    where organization_id = v_org.id and user_id = p_user_id;

  if v_member_id is not null and exists (
    select 1 from public.organization_members where id = v_member_id and is_active
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  select max_team_size into v_max_size from public.student_team_settings where organization_id = v_org.id;
  select count(*) into v_member_count from public.organization_members
    where organization_id = v_org.id and is_active;
  if v_member_count >= v_max_size then raise exception 'TEAM_FULL'; end if;

  if v_member_id is not null then
    -- rejoining after a prior departure: reactivate the existing row
    update public.organization_members set is_active = true, employment_status = 'ACTIVE'
      where id = v_member_id;
  else
    insert into public.organization_members (organization_id, user_id, employment_status, is_active)
    values (v_org.id, p_user_id, 'ACTIVE', true)
    returning id into v_member_id;
  end if;

  select id into v_role_id from public.roles where code = 'STUDENT_MEMBER' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id)
  values (v_member_id, v_role_id)
  on conflict do nothing;

  update public.student_team_join_codes set used_count = used_count + 1 where id = v_jc.id;

  return v_org;
end;
$$;


ALTER FUNCTION "public"."redeem_student_team_join_code"("p_user_id" "uuid", "p_raw_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_can_deploy"("p_release" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_req_comp boolean;
  v_req text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT r.organization_id, r.requires_compliance_approval 
  INTO v_org_id, v_req_comp 
  FROM public.releases r 
  WHERE r.id = p_release;

  IF v_org_id IS NULL THEN RETURN false; END IF;
  IF NOT handoff.is_org_member(v_org_id) THEN RETURN false; END IF;
  IF NOT handoff.can_view_release(p_release) THEN RETURN false; END IF;

  FOR v_req IN SELECT unnest(
    CASE WHEN v_req_comp THEN array['QA','SECURITY','COMPLIANCE','RELEASE_MANAGER']
    ELSE array['QA','SECURITY','RELEASE_MANAGER'] END
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.release_approvals ra
      WHERE ra.release_id = p_release AND ra.approval_type = v_req AND ra.status = 'APPROVED'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."release_can_deploy"("p_release" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_member_id uuid;
begin
  select id into v_member_id from public.organization_members
    where organization_id = p_org and user_id = p_caller_user_id and is_active;

  if v_member_id is null or not exists (
    select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    where mr.organization_member_id = v_member_id and rp.permission_code = 'student_team:manage_join_code'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.student_team_join_codes
    set is_active = false, revoked_at = now()
    where organization_id = p_org and is_active;
end;
$$;


ALTER FUNCTION "public"."revoke_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_session"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  DELETE FROM auth.sessions
  WHERE id = p_session_id AND user_id = auth.uid();
$$;


ALTER FUNCTION "public"."revoke_session"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rotate_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_member_id uuid;
  v_raw_code text;
begin
  select id into v_member_id from public.organization_members
    where organization_id = p_org and user_id = p_caller_user_id and is_active;

  if v_member_id is null or not exists (
    select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    where mr.organization_member_id = v_member_id and rp.permission_code = 'student_team:manage_join_code'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.student_team_join_codes
    set is_active = false, revoked_at = now()
    where organization_id = p_org and is_active;

  v_raw_code := handoff.generate_join_code();
  insert into public.student_team_join_codes (organization_id, code_hash, created_by, last_rotated_at)
  values (p_org, handoff.hash_join_code(v_raw_code), v_member_id, now());

  return v_raw_code;
end;
$$;


ALTER FUNCTION "public"."rotate_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "release_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "risk_score" integer,
    "reviewer_member_id" "uuid",
    "due_date" "date",
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "repository_id" "uuid",
    "task_id" "uuid",
    "risk_level" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "scope" "text",
    "description" "text",
    CONSTRAINT "security_reviews_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "security_reviews_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'IN_PROGRESS'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."security_reviews" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_security_review"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") RETURNS "public"."security_reviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_review public.security_reviews;
  v_reviewer_id uuid;
  v_actor_member_id uuid;
BEGIN
  v_actor_member_id := handoff.current_member_id(auth.uid(), p_organization_id);
  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not an active member';
  END IF;

  INSERT INTO public.security_reviews (
    organization_id, project_id, release_id, repository_id, task_id,
    title, risk_level, scope, description, due_date,
    reviewer_member_id, status
  ) VALUES (
    p_organization_id, p_project_id,
    (p_payload->>'release_id')::uuid,
    (p_payload->>'repository_id')::uuid,
    (p_payload->>'task_id')::uuid,
    p_payload->>'title',
    COALESCE(p_payload->>'risk_level', 'LOW'),
    p_payload->>'scope',
    p_payload->>'description',
    CASE WHEN p_payload->>'due_date' IS NOT NULL AND p_payload->>'due_date' != '' THEN (p_payload->>'due_date')::date ELSE NULL END,
    (p_payload->>'reviewer_member_id')::uuid,
    'IN_PROGRESS'
  ) RETURNING * INTO v_review;

  IF p_payload->'additional_reviewer_ids' IS NOT NULL AND jsonb_typeof(p_payload->'additional_reviewer_ids') = 'array' THEN
    FOR v_reviewer_id IN SELECT (jsonb_array_elements_text(p_payload->'additional_reviewer_ids'))::uuid LOOP
      INSERT INTO public.security_review_assignments (
        organization_id, security_review_id, member_id, assignment_type, assigned_by_member_id
      ) VALUES (
        p_organization_id, v_review.id, v_reviewer_id, 'ADDITIONAL_REVIEWER', v_actor_member_id
      );
    END LOOP;
  END IF;

  RETURN v_review;
END;
$$;


ALTER FUNCTION "public"."start_security_review"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_task_assignee_access_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_task record;
  v_actor uuid;
BEGIN
  SELECT organization_id, project_id
    INTO v_task
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found for task_assignees' USING ERRCODE = '23503';
  END IF;

  NEW.organization_id := v_task.organization_id;
  NEW.project_id := v_task.project_id;
  NEW.assigned_by_member_id := COALESCE(NEW.assigned_by_member_id, NEW.assigned_by);
  NEW.assigned_by := COALESCE(NEW.assigned_by, NEW.assigned_by_member_id);

  NEW.assignment_type := COALESCE(
    NEW.assignment_type,
    CASE upper(COALESCE(NEW.assignment_role, ''))
      WHEN 'PRIMARY' THEN 'PRIMARY'
      WHEN 'REVIEWER' THEN 'REVIEWER'
      WHEN 'OBSERVER' THEN 'OBSERVER'
      ELSE 'ADDITIONAL'
    END
  );
  NEW.assignment_role := COALESCE(
    NEW.assignment_role,
    CASE NEW.assignment_type
      WHEN 'PRIMARY' THEN 'PRIMARY'
      WHEN 'REVIEWER' THEN 'REVIEWER'
      WHEN 'OBSERVER' THEN 'OBSERVER'
      ELSE 'ASSIGNEE'
    END
  );

  IF NEW.removed_at IS NOT NULL AND NEW.removed_by_member_id IS NULL THEN
    v_actor := handoff.current_member_id(v_task.organization_id);
    NEW.removed_by_member_id := v_actor;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_task_assignee_access_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_team_leadership"("p_org" "uuid", "p_from_user_id" "uuid", "p_to_member_id" "uuid", "p_demote_to" "text" DEFAULT 'STUDENT_CO_LEAD'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_from_member_id uuid;
  v_lead_role_id uuid;
  v_demote_role_id uuid;
begin
  if p_demote_to not in ('STUDENT_CO_LEAD','STUDENT_MEMBER') then
    raise exception 'INVALID_DEMOTE_ROLE';
  end if;

  select id into v_from_member_id from public.organization_members
    where organization_id = p_org and user_id = p_from_user_id and is_active;
  if v_from_member_id is null then raise exception 'FORBIDDEN'; end if;

  if not exists (
    select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
    where mr.organization_member_id = v_from_member_id and r.code = 'STUDENT_TEAM_LEAD'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.organization_members
    where id = p_to_member_id and organization_id = p_org and is_active
  ) then
    raise exception 'INVALID_TARGET_MEMBER';
  end if;

  select id into v_lead_role_id from public.roles where code = 'STUDENT_TEAM_LEAD' and organization_id is null;
  select id into v_demote_role_id from public.roles where code = p_demote_to and organization_id is null;

  delete from public.member_roles where organization_member_id = v_from_member_id and role_id = v_lead_role_id;
  delete from public.member_roles where organization_member_id = p_to_member_id
    and role_id in (select id from public.roles where code in ('STUDENT_CO_LEAD','STUDENT_MEMBER') and organization_id is null);

  insert into public.member_roles (organization_member_id, role_id) values (p_to_member_id, v_lead_role_id);
  insert into public.member_roles (organization_member_id, role_id) values (v_from_member_id, v_demote_role_id)
    on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."transfer_team_leadership"("p_org" "uuid", "p_from_user_id" "uuid", "p_to_member_id" "uuid", "p_demote_to" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."write_audit_log"("p_org" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_project_id" "uuid" DEFAULT NULL::"uuid", "p_before" "jsonb" DEFAULT NULL::"jsonb", "p_after" "jsonb" DEFAULT NULL::"jsonb", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid;
  v_id uuid;
BEGIN
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


ALTER FUNCTION "public"."write_audit_log"("p_org" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_before" "jsonb", "p_after" "jsonb", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "requester_member_id" "uuid",
    "project_id" "uuid",
    "task_id" "uuid",
    "request_type" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "response" "text",
    "provider_mode" "text" DEFAULT 'mock'::"text" NOT NULL,
    "status" "text" DEFAULT 'COMPLETED'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model_name" "text",
    "intent" "text",
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."ai_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_settings" (
    "organization_id" "uuid" NOT NULL,
    "provider_mode" "text" DEFAULT 'mock'::"text" NOT NULL,
    "allow_project_data" boolean DEFAULT true NOT NULL,
    "allow_document_data" boolean DEFAULT true NOT NULL,
    "allow_repository_data" boolean DEFAULT true NOT NULL,
    "require_source_citations" boolean DEFAULT true NOT NULL,
    "log_prompts" boolean DEFAULT true NOT NULL,
    "allow_restricted_data" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_request_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid",
    "source_title" "text"
);


ALTER TABLE "public"."ai_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "task_id" "uuid",
    "release_id" "uuid",
    "approval_type" "text" NOT NULL,
    "requested_by_member_id" "uuid",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "required_role" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_requests_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."approval_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "approval_request_id" "uuid" NOT NULL,
    "approver_member_id" "uuid",
    "decision" "text" NOT NULL,
    "comment" "text",
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approvals_decision_check" CHECK (("decision" = ANY (ARRAY['APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "uploaded_by_member_id" "uuid",
    "project_id" "uuid",
    "task_id" "uuid",
    "document_id" "uuid",
    "release_id" "uuid",
    "incident_id" "uuid",
    "bucket" "text" DEFAULT 'attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "classification" "text" DEFAULT 'INTERNAL'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "attachments_classification_check" CHECK (("classification" = ANY (ARRAY['PUBLIC'::"text", 'INTERNAL'::"text", 'CONFIDENTIAL'::"text", 'RESTRICTED'::"text"])))
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "actor_member_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "project_id" "uuid",
    "before_state" "jsonb",
    "after_state" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_type" "text" NOT NULL,
    "session_id" "uuid",
    "request_id" "uuid",
    "ip_hash" "text",
    "user_agent_hash" "text",
    "outcome" "text" NOT NULL,
    "reason_code" "text",
    "integrity_hash" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bug_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "bug_id" "uuid" NOT NULL,
    "actor_member_id" "uuid",
    "action_type" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bug_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bug_assignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "bug_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "assignment_type" "text" NOT NULL,
    "assigned_by_member_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone,
    "removed_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bug_assignees_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['PRIMARY'::"text", 'ADDITIONAL'::"text", 'REVIEWER'::"text", 'OBSERVER'::"text"])))
);


ALTER TABLE "public"."bug_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bug_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "bug_id" "uuid" NOT NULL,
    "attachment_id" "uuid" NOT NULL,
    "uploaded_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bug_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ci_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'RUNNING'::"text" NOT NULL,
    "duration_seconds" integer,
    "logs_summary" "text"
);


ALTER TABLE "public"."ci_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ci_pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "repository_id" "uuid" NOT NULL,
    "external_id" "text",
    "branch" "text",
    "status" "text" DEFAULT 'RUNNING'::"text" NOT NULL,
    "triggered_by_member_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "ci_pipelines_status_check" CHECK (("status" = ANY (ARRAY['QUEUED'::"text", 'RUNNING'::"text", 'PASSED'::"text", 'FAILED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."ci_pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_mentions" (
    "comment_id" "uuid" NOT NULL,
    "mentioned_member_id" "uuid" NOT NULL
);


ALTER TABLE "public"."comment_mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "repository_id" "uuid" NOT NULL,
    "external_hash" "text",
    "message" "text",
    "author_member_id" "uuid",
    "branch" "text",
    "linked_task_id" "uuid",
    "committed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_controls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "framework_name" "text",
    "description" "text",
    "owner_member_id" "uuid",
    "status" "text" DEFAULT 'NOT_STARTED'::"text" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "compliance_controls_status_check" CHECK (("status" = ANY (ARRAY['NOT_STARTED'::"text", 'IN_PROGRESS'::"text", 'COMPLIANT'::"text", 'NON_COMPLIANT'::"text"])))
);


ALTER TABLE "public"."compliance_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "compliance_control_id" "uuid" NOT NULL,
    "attachment_id" "uuid",
    "document_id" "uuid",
    "description" "text",
    "submitted_by_member_id" "uuid",
    "status" "text" DEFAULT 'SUBMITTED'::"text" NOT NULL,
    "reviewed_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compliance_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "demo_member_id" "uuid" NOT NULL,
    "active_demo_role" "text" NOT NULL,
    "seed_version" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "last_active_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."demo_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "head_member_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deployment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deployment_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "log_level" "text" NOT NULL,
    "message" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "deployment_logs_log_level_check" CHECK (("log_level" = ANY (ARRAY['INFO'::"text", 'WARN'::"text", 'ERROR'::"text"])))
);


ALTER TABLE "public"."deployment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deployments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "release_id" "uuid" NOT NULL,
    "environment_id" "uuid",
    "version" "text",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "triggered_by_member_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "rollback_of_deployment_id" "uuid",
    "logs_summary" "text",
    CONSTRAINT "deployments_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'DEPLOYING'::"text", 'DEPLOYED'::"text", 'FAILED'::"text", 'ROLLED_BACK'::"text"])))
);


ALTER TABLE "public"."deployments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "author_member_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_links" (
    "document_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL
);


ALTER TABLE "public"."document_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content_markdown" "text" NOT NULL,
    "created_by_member_id" "uuid",
    "change_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text",
    "document_type" "text" DEFAULT 'TEAM_NOTE'::"text" NOT NULL,
    "content_markdown" "text" DEFAULT ''::"text" NOT NULL,
    "classification" "text" DEFAULT 'INTERNAL'::"text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "owner_member_id" "uuid",
    "approved_by_member_id" "uuid",
    "approved_at" timestamp with time zone,
    "current_version" integer DEFAULT 1 NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "documents_classification_check" CHECK (("classification" = ANY (ARRAY['PUBLIC'::"text", 'INTERNAL'::"text", 'CONFIDENTIAL'::"text", 'RESTRICTED'::"text"]))),
    CONSTRAINT "documents_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'IN_REVIEW'::"text", 'APPROVED'::"text", 'ARCHIVED'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "available_hours" numeric DEFAULT 8 NOT NULL,
    "reason" "text"
);


ALTER TABLE "public"."employee_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "proficiency_level" integer DEFAULT 1 NOT NULL,
    "verified_at" timestamp with time zone,
    CONSTRAINT "employee_skills_proficiency_level_check" CHECK ((("proficiency_level" >= 1) AND ("proficiency_level" <= 5)))
);


ALTER TABLE "public"."employee_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."environments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "environment_type" "text" DEFAULT 'DEVELOPMENT'::"text" NOT NULL,
    "description" "text",
    "is_production" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "environments_environment_type_check" CHECK (("environment_type" = ANY (ARRAY['DEVELOPMENT'::"text", 'TESTING'::"text", 'STAGING'::"text", 'UAT'::"text", 'PRODUCTION'::"text"])))
);


ALTER TABLE "public"."environments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."epics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "owner_member_id" "uuid",
    "start_date" "date",
    "target_end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "epics_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "epics_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'DONE'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."epics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by_member_id" "uuid" NOT NULL,
    "import_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'PREVIEWED'::"text" NOT NULL,
    "mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_jobs_import_type_check" CHECK (("import_type" = ANY (ARRAY['PROJECTS'::"text", 'TASKS'::"text"]))),
    CONSTRAINT "import_jobs_status_check" CHECK (("status" = ANY (ARRAY['PREVIEWED'::"text", 'CONFIRMED'::"text", 'FAILED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_job_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "mapped_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_resource_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_rows_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'VALID'::"text", 'INVALID'::"text", 'CREATED'::"text", 'SKIPPED'::"text"])))
);


ALTER TABLE "public"."import_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incident_followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "title" "text" NOT NULL,
    "owner_member_id" "uuid",
    "due_date" "date",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL
);


ALTER TABLE "public"."incident_followups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incident_participants" (
    "incident_id" "uuid" NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "role" "text"
);


ALTER TABLE "public"."incident_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incident_timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "actor_member_id" "uuid",
    "event_type" "text" DEFAULT 'UPDATE'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."incident_timeline_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "release_id" "uuid",
    "title" "text" NOT NULL,
    "severity" "text" DEFAULT 'SEV3'::"text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "incident_commander_member_id" "uuid",
    "affected_services" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "customer_impact" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "summary" "text",
    "root_cause" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "incidents_severity_check" CHECK (("severity" = ANY (ARRAY['SEV1'::"text", 'SEV2'::"text", 'SEV3'::"text", 'SEV4'::"text"]))),
    CONSTRAINT "incidents_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'INVESTIGATING'::"text", 'IDENTIFIED'::"text", 'MONITORING'::"text", 'RESOLVED'::"text"])))
);


ALTER TABLE "public"."incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "display_name" "text",
    "status" "text" DEFAULT 'MOCK_CONNECTED'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "encrypted_secrets" "text"
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "leave_type" "text" DEFAULT 'PTO'::"text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "approved_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "leave_requests_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_type" "public"."legal_document_type" NOT NULL,
    "version" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "is_active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "check_active_is_published" CHECK ((NOT (("is_active" = true) AND ("published_at" IS NULL))))
);


ALTER TABLE "public"."legal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_roles" (
    "organization_member_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "uuid"
);


ALTER TABLE "public"."member_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "status" "text" DEFAULT 'PLANNED'::"text" NOT NULL,
    "owner_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "milestones_status_check" CHECK (("status" = ANY (ARRAY['PLANNED'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'MISSED'::"text"])))
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "organization_member_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "in_app_enabled" boolean DEFAULT true NOT NULL,
    "email_enabled" boolean DEFAULT false NOT NULL,
    "push_enabled" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "recipient_member_id" "uuid" NOT NULL,
    "actor_member_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "project_id" "uuid",
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "snoozed_until" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_task_counters" (
    "organization_id" "uuid" NOT NULL,
    "last_number" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."org_task_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invite_roles" (
    "organization_id" "uuid" NOT NULL,
    "invite_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_invite_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role_code" "text" NOT NULL,
    "invited_by" "uuid",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_department_id" "uuid",
    "assigned_team_id" "uuid",
    "assigned_job_family" "text",
    "assigned_job_title" "text",
    "assigned_manager_type" "text",
    "invite_token_hash" "text",
    CONSTRAINT "organization_invites_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'REVOKED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."organization_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "department_id" "uuid",
    "manager_id" "uuid",
    "employment_status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_family" "text",
    "job_title" "text",
    "job_description" "text",
    "professional_specialization" "text",
    "employment_type" "text",
    "manager_type" "text",
    CONSTRAINT "organization_members_employment_status_check" CHECK (("employment_status" = ANY (ARRAY['ACTIVE'::"text", 'INVITED'::"text", 'SUSPENDED'::"text", 'OFFBOARDED'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "owner_member_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "health" "text" DEFAULT 'ON_TRACK'::"text" NOT NULL,
    "target_start_date" "date",
    "target_end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "portfolios_health_check" CHECK (("health" = ANY (ARRAY['ON_TRACK'::"text", 'AT_RISK'::"text", 'OFF_TRACK'::"text"])))
);


ALTER TABLE "public"."portfolios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."postmortems" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "summary" "text",
    "detection" "text",
    "impact" "text",
    "root_cause" "text",
    "response" "text",
    "resolution" "text",
    "lessons_learned" "text",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "author_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."postmortems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."presence_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."presence_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "avatar_path" "text",
    "job_title" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" "text",
    "username_normalized" "text",
    "bio" "text",
    "profile_completed_at" timestamp with time zone,
    CONSTRAINT "username_normalized_lower_trim" CHECK ((("username_normalized" IS NULL) OR ("username_normalized" = "lower"(TRIM(BOTH FROM "username_normalized"))))),
    CONSTRAINT "valid_username" CHECK ((("username" IS NULL) OR (("length"("username") >= 3) AND ("length"("username") <= 30) AND ("username" ~ '^[a-zA-Z0-9\._\-]+$'::"text"))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "portfolio_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "program_manager_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "health" "text" DEFAULT 'ON_TRACK'::"text" NOT NULL,
    "target_start_date" "date",
    "target_end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "programs_health_check" CHECK (("health" = ANY (ARRAY['ON_TRACK'::"text", 'AT_RISK'::"text", 'OFF_TRACK'::"text"])))
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "actor_member_id" "uuid",
    "activity_type" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_deadlines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "sprint_id" "uuid",
    "task_id" "uuid",
    "release_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date" NOT NULL,
    "owner_member_id" "uuid",
    "status" "text" DEFAULT 'PLANNED'::"text" NOT NULL,
    "created_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_deadlines_status_check" CHECK (("status" = ANY (ARRAY['PLANNED'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'MISSED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."project_deadlines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "depends_on_project_id" "uuid" NOT NULL,
    "dependency_type" "text" DEFAULT 'BLOCKS'::"text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_dependencies_check" CHECK (("project_id" <> "depends_on_project_id"))
);


ALTER TABLE "public"."project_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "project_role" "text",
    "can_view" boolean DEFAULT true NOT NULL,
    "can_comment" boolean DEFAULT true NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "can_manage" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_risks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "risk_level" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "probability" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "impact" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "owner_member_id" "uuid",
    "mitigation_plan" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_risks_impact_check" CHECK (("impact" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text"]))),
    CONSTRAINT "project_risks_probability_check" CHECK (("probability" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text"]))),
    CONSTRAINT "project_risks_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "project_risks_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'MITIGATING'::"text", 'CLOSED'::"text", 'ACCEPTED'::"text"])))
);


ALTER TABLE "public"."project_risks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "allocation_percent" numeric DEFAULT 100 NOT NULL
);


ALTER TABLE "public"."project_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pull_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "repository_id" "uuid" NOT NULL,
    "external_id" "text",
    "title" "text" NOT NULL,
    "author_member_id" "uuid",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "source_branch" "text",
    "target_branch" "text",
    "linked_task_id" "uuid",
    "build_status" "text",
    "test_status" "text",
    "risk_level" "text",
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "merged_at" timestamp with time zone,
    CONSTRAINT "pull_requests_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'MERGED'::"text", 'CLOSED'::"text", 'DRAFT'::"text"])))
);


ALTER TABLE "public"."pull_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "ip" "text" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."release_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "release_id" "uuid" NOT NULL,
    "approval_type" "text" NOT NULL,
    "required_role" "text",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "approved_by_member_id" "uuid",
    "comment" "text",
    CONSTRAINT "release_approvals_approval_type_check" CHECK (("approval_type" = ANY (ARRAY['QA'::"text", 'SECURITY'::"text", 'COMPLIANCE'::"text", 'RELEASE_MANAGER'::"text"]))),
    CONSTRAINT "release_approvals_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."release_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."releases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "version" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "release_manager_member_id" "uuid",
    "planned_release_at" timestamp with time zone,
    "released_at" timestamp with time zone,
    "requires_compliance_approval" boolean DEFAULT false NOT NULL,
    "rollback_plan" "text",
    "release_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "releases_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'DEVELOPMENT_COMPLETE'::"text", 'CODE_REVIEW_COMPLETE'::"text", 'QA_PENDING'::"text", 'QA_APPROVED'::"text", 'SECURITY_PENDING'::"text", 'SECURITY_APPROVED'::"text", 'COMPLIANCE_PENDING'::"text", 'COMPLIANCE_APPROVED'::"text", 'RELEASE_MANAGER_PENDING'::"text", 'APPROVED_FOR_DEPLOYMENT'::"text", 'DEPLOYING'::"text", 'DEPLOYED'::"text", 'ROLLED_BACK'::"text", 'BLOCKED'::"text"])))
);


ALTER TABLE "public"."releases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "delivered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "actor_member_id" "uuid",
    "export_type" "text" NOT NULL,
    "format" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'COMPLETED'::"text" NOT NULL,
    "file_name" "text",
    "row_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "report_exports_format_check" CHECK (("format" = ANY (ARRAY['CSV'::"text", 'PDF'::"text"]))),
    CONSTRAINT "report_exports_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'COMPLETED'::"text", 'FAILED'::"text", 'BLOCKED_BY_INTEGRATION'::"text"])))
);


ALTER TABLE "public"."report_exports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "cron_expression" "text" NOT NULL,
    "recipients" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "next_run_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by_member_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repositories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid",
    "name" "text" NOT NULL,
    "provider" "text" DEFAULT 'github'::"text" NOT NULL,
    "default_branch" "text" DEFAULT 'main'::"text" NOT NULL,
    "url" "text",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."repositories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_code" "text" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "owner_member_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "columns" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_shared" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "security_review_id" "uuid",
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "owner_member_id" "uuid",
    "remediation_task_id" "uuid",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_findings_severity_check" CHECK (("severity" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "security_findings_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'MITIGATING'::"text", 'RESOLVED'::"text", 'ACCEPTED'::"text"])))
);


ALTER TABLE "public"."security_findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_review_assignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "security_review_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "assignment_type" "text" DEFAULT 'REVIEWER'::"text" NOT NULL,
    "assigned_by_member_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone,
    "removed_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_review_assignees_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['PRIMARY'::"text", 'REVIEWER'::"text", 'OBSERVER'::"text"])))
);


ALTER TABLE "public"."security_review_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_review_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "security_review_id" "uuid" NOT NULL,
    "check_name" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "security_review_checks_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'PASSED'::"text", 'FAILED'::"text", 'NA'::"text"])))
);


ALTER TABLE "public"."security_review_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "name" "text" NOT NULL,
    "goal" "text",
    "status" "text" DEFAULT 'PLANNED'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "capacity_hours" numeric DEFAULT 0 NOT NULL,
    "planned_story_points" numeric DEFAULT 0 NOT NULL,
    "completed_story_points" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sprints_status_check" CHECK (("status" = ANY (ARRAY['PLANNED'::"text", 'ACTIVE'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."sprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_team_join_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "max_uses" integer,
    "used_count" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "revoked_at" timestamp with time zone,
    "last_rotated_at" timestamp with time zone,
    CONSTRAINT "student_team_join_codes_max_uses_check" CHECK ((("max_uses" IS NULL) OR ("max_uses" > 0)))
);


ALTER TABLE "public"."student_team_join_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_team_member_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "label_normalized" "text" NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_team_member_labels_label_check" CHECK ((("length"("label") >= 1) AND ("length"("label") <= 60)))
);


ALTER TABLE "public"."student_team_member_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_team_settings" (
    "organization_id" "uuid" NOT NULL,
    "event_name" "text",
    "short_description" "text",
    "expected_team_size" integer,
    "max_team_size" integer NOT NULL,
    "primary_team_role" "text",
    "co_lead_can_manage_members" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_team_settings_expected_team_size_check" CHECK (("expected_team_size" > 0)),
    CONSTRAINT "student_team_settings_max_team_size_check" CHECK ((("max_team_size" > 0) AND ("max_team_size" <= 50)))
);


ALTER TABLE "public"."student_team_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "actor_member_id" "uuid",
    "activity_type" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "assignment_role" "text" DEFAULT 'ASSIGNEE'::"text",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "assignment_type" "text" NOT NULL,
    "assigned_by_member_id" "uuid",
    "removed_at" timestamp with time zone,
    "removed_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_assignees_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['PRIMARY'::"text", 'ADDITIONAL'::"text", 'REVIEWER'::"text", 'OBSERVER'::"text"])))
);


ALTER TABLE "public"."task_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checklist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone,
    "position" numeric DEFAULT 1000 NOT NULL
);


ALTER TABLE "public"."task_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "author_member_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "parent_comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "dependency_type" "text" DEFAULT 'BLOCKS'::"text" NOT NULL,
    "notes" "text",
    CONSTRAINT "task_dependencies_check" CHECK (("task_id" <> "depends_on_task_id"))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_label_links" (
    "task_id" "uuid" NOT NULL,
    "label_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_label_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."task_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_visibility_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "granted_by_member_id" "uuid",
    "access_type" "text" DEFAULT 'VIEWER'::"text" NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_visibility_members_access_type_check" CHECK (("access_type" = ANY (ARRAY['VIEWER'::"text", 'REVIEWER'::"text", 'OBSERVER'::"text"])))
);


ALTER TABLE "public"."task_visibility_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_watchers" (
    "task_id" "uuid" NOT NULL,
    "organization_member_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_watchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "epic_id" "uuid",
    "sprint_id" "uuid",
    "task_number" bigint NOT NULL,
    "task_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "task_type" "text" DEFAULT 'TASK'::"text" NOT NULL,
    "status" "text" DEFAULT 'BACKLOG'::"text" NOT NULL,
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "security_classification" "text" DEFAULT 'INTERNAL'::"text" NOT NULL,
    "reporter_member_id" "uuid",
    "primary_assignee_member_id" "uuid",
    "due_date" "date",
    "start_date" "date",
    "estimated_hours" numeric,
    "actual_hours" numeric DEFAULT 0 NOT NULL,
    "story_points" numeric,
    "acceptance_criteria" "text",
    "is_blocked" boolean DEFAULT false NOT NULL,
    "blocker_reason" "text",
    "position" numeric DEFAULT 1000 NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility_scope" "text" DEFAULT 'PRIVATE_ASSIGNMENT'::"text" NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "tasks_security_classification_check" CHECK (("security_classification" = ANY (ARRAY['PUBLIC'::"text", 'INTERNAL'::"text", 'CONFIDENTIAL'::"text", 'RESTRICTED'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['BACKLOG'::"text", 'READY'::"text", 'IN_PROGRESS'::"text", 'BLOCKED'::"text", 'CODE_REVIEW'::"text", 'QA_TESTING'::"text", 'SECURITY_REVIEW'::"text", 'READY_FOR_RELEASE'::"text", 'DONE'::"text", 'CANCELLED'::"text"]))),
    CONSTRAINT "tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['TASK'::"text", 'STORY'::"text", 'BUG'::"text", 'IMPROVEMENT'::"text", 'TECHNICAL_DEBT'::"text", 'SECURITY_TASK'::"text", 'INCIDENT_FOLLOW_UP'::"text", 'RESEARCH'::"text", 'SPIKE'::"text", 'COMPLIANCE_TASK'::"text"]))),
    CONSTRAINT "tasks_visibility_scope_check" CHECK (("visibility_scope" = ANY (ARRAY['PRIVATE_ASSIGNMENT'::"text", 'PROJECT_SHARED'::"text", 'ORGANIZATION_VISIBLE'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "role_in_team" "text",
    "allocation_percent" numeric DEFAULT 100 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_members_allocation_percent_check" CHECK ((("allocation_percent" >= (0)::numeric) AND ("allocation_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_plan_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "preconditions" "text",
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "expected_result" "text",
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "linked_task_id" "uuid"
);


ALTER TABLE "public"."test_cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_plan_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "test_plan_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "assignment_type" "text" DEFAULT 'REVIEWER'::"text" NOT NULL,
    "assigned_by_member_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone,
    "removed_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "test_plan_assignments_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['OWNER'::"text", 'REVIEWER'::"text", 'ADDITIONAL'::"text"])))
);


ALTER TABLE "public"."test_plan_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_plan_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "test_plan_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "linked_by_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."test_plan_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_run_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_run_id" "uuid" NOT NULL,
    "test_case_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "actual_result" "text",
    "executed_by_member_id" "uuid",
    CONSTRAINT "test_run_results_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'PASSED'::"text", 'FAILED'::"text", 'BLOCKED'::"text", 'SKIPPED'::"text"])))
);


ALTER TABLE "public"."test_run_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "test_plan_id" "uuid" NOT NULL,
    "executed_by_member_id" "uuid",
    "environment_id" "uuid",
    "status" "text" DEFAULT 'IN_PROGRESS'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."test_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "organization_member_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "minutes" integer NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "time_entries_minutes_check" CHECK (("minutes" >= 0))
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."ai_sources"
    ADD CONSTRAINT "ai_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bug_activity"
    ADD CONSTRAINT "bug_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bug_assignees"
    ADD CONSTRAINT "bug_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bug_attachments"
    ADD CONSTRAINT "bug_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ci_jobs"
    ADD CONSTRAINT "ci_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ci_pipelines"
    ADD CONSTRAINT "ci_pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_mentions"
    ADD CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("comment_id", "mentioned_member_id");



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_controls"
    ADD CONSTRAINT "compliance_controls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_evidence"
    ADD CONSTRAINT "compliance_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_demo_member_id_key" UNIQUE ("demo_member_id");



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deployment_logs"
    ADD CONSTRAINT "deployment_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_comments"
    ADD CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_links"
    ADD CONSTRAINT "document_links_pkey" PRIMARY KEY ("document_id", "entity_type", "entity_id");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_document_id_version_number_key" UNIQUE ("document_id", "version_number");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_organization_member_id_date_key" UNIQUE ("organization_member_id", "date");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_organization_member_id_skill_id_key" UNIQUE ("organization_member_id", "skill_id");



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."environments"
    ADD CONSTRAINT "environments_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."environments"
    ADD CONSTRAINT "environments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."epics"
    ADD CONSTRAINT "epics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_rows"
    ADD CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incident_followups"
    ADD CONSTRAINT "incident_followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incident_participants"
    ADD CONSTRAINT "incident_participants_pkey" PRIMARY KEY ("incident_id", "organization_member_id");



ALTER TABLE ONLY "public"."incident_timeline_events"
    ADD CONSTRAINT "incident_timeline_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_organization_id_provider_key" UNIQUE ("organization_id", "provider");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_pkey" PRIMARY KEY ("organization_member_id", "role_id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("organization_member_id", "notification_type");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_task_counters"
    ADD CONSTRAINT "org_task_counters_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."organization_invite_roles"
    ADD CONSTRAINT "organization_invite_roles_pkey" PRIMARY KEY ("invite_id", "role_id");



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_organization_id_email_status_key" UNIQUE ("organization_id", "email", "status");



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."postmortems"
    ADD CONSTRAINT "postmortems_incident_id_key" UNIQUE ("incident_id");



ALTER TABLE ONLY "public"."postmortems"
    ADD CONSTRAINT "postmortems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presence_sessions"
    ADD CONSTRAINT "presence_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_activity"
    ADD CONSTRAINT "project_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_dependencies"
    ADD CONSTRAINT "project_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_organization_member_id_key" UNIQUE ("project_id", "organization_member_id");



ALTER TABLE ONLY "public"."project_risks"
    ADD CONSTRAINT "project_risks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_project_id_team_id_key" UNIQUE ("project_id", "team_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_organization_id_code_key" UNIQUE ("organization_id", "code");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("ip");



ALTER TABLE ONLY "public"."release_approvals"
    ADD CONSTRAINT "release_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_approvals"
    ADD CONSTRAINT "release_approvals_release_id_approval_type_key" UNIQUE ("release_id", "approval_type");



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_deliveries"
    ADD CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_exports"
    ADD CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repositories"
    ADD CONSTRAINT "repositories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_organization_id_code_key" UNIQUE ("organization_id", "code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_findings"
    ADD CONSTRAINT "security_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_review_assignees"
    ADD CONSTRAINT "security_review_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_review_checks"
    ADD CONSTRAINT "security_review_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_team_join_codes"
    ADD CONSTRAINT "student_team_join_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_team_member_labels"
    ADD CONSTRAINT "student_team_member_labels_organization_member_id_label_nor_key" UNIQUE ("organization_member_id", "label_normalized");



ALTER TABLE ONLY "public"."student_team_member_labels"
    ADD CONSTRAINT "student_team_member_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_team_settings"
    ADD CONSTRAINT "student_team_settings_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_checklists"
    ADD CONSTRAINT "task_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_depends_on_task_id_key" UNIQUE ("task_id", "depends_on_task_id");



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_pkey" PRIMARY KEY ("task_id", "label_id");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_visibility_members"
    ADD CONSTRAINT "task_visibility_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("task_id", "organization_member_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_organization_id_task_number_key" UNIQUE ("organization_id", "task_number");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_organization_member_id_key" UNIQUE ("team_id", "organization_member_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_cases"
    ADD CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_plan_assignments"
    ADD CONSTRAINT "test_plan_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_plan_tasks"
    ADD CONSTRAINT "test_plan_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_plans"
    ADD CONSTRAINT "test_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_run_results"
    ADD CONSTRAINT "test_run_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_runs"
    ADD CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_legal_acceptances"
    ADD CONSTRAINT "user_legal_acceptances_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_requests_org_idx" ON "public"."ai_requests" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "approval_requests_org_idx" ON "public"."approval_requests" USING "btree" ("organization_id", "status");



CREATE INDEX "attachments_project_idx" ON "public"."attachments" USING "btree" ("project_id");



CREATE INDEX "attachments_task_idx" ON "public"."attachments" USING "btree" ("task_id");



CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_member_id", "occurred_at" DESC);



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "audit_logs_organization_idx" ON "public"."audit_logs" USING "btree" ("organization_id", "occurred_at" DESC);



CREATE INDEX "audit_logs_project_idx" ON "public"."audit_logs" USING "btree" ("project_id", "occurred_at" DESC);



CREATE INDEX "audit_logs_request_idx" ON "public"."audit_logs" USING "btree" ("request_id");



CREATE INDEX "bug_activity_bug_idx" ON "public"."bug_activity" USING "btree" ("bug_id");



CREATE UNIQUE INDEX "bug_assignees_one_active_member_idx" ON "public"."bug_assignees" USING "btree" ("bug_id", "member_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "bug_assignees_org_member_idx" ON "public"."bug_assignees" USING "btree" ("organization_id", "member_id");



CREATE INDEX "bug_attachments_bug_idx" ON "public"."bug_attachments" USING "btree" ("bug_id");



CREATE INDEX "bugs_project_idx" ON "public"."bugs" USING "btree" ("project_id", "status");



CREATE UNIQUE INDEX "commits_repo_external_uidx" ON "public"."commits" USING "btree" ("repository_id", "external_hash");



CREATE UNIQUE INDEX "demo_sessions_active_auth_idx" ON "public"."demo_sessions" USING "btree" ("auth_user_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "departments_org_idx" ON "public"."departments" USING "btree" ("organization_id");



CREATE INDEX "deployment_logs_deployment_idx" ON "public"."deployment_logs" USING "btree" ("deployment_id");



CREATE INDEX "deployments_release_idx" ON "public"."deployments" USING "btree" ("release_id");



CREATE INDEX "documents_org_idx" ON "public"."documents" USING "btree" ("organization_id");



CREATE INDEX "epics_project_idx" ON "public"."epics" USING "btree" ("project_id");



CREATE INDEX "idx_ai_requests_project_id" ON "public"."ai_requests" USING "btree" ("project_id");



CREATE INDEX "idx_ai_requests_requester_member_id" ON "public"."ai_requests" USING "btree" ("requester_member_id");



CREATE INDEX "idx_ai_requests_task_id" ON "public"."ai_requests" USING "btree" ("task_id");



CREATE INDEX "idx_ai_sources_ai_request_id" ON "public"."ai_sources" USING "btree" ("ai_request_id");



CREATE INDEX "idx_approval_requests_project_id" ON "public"."approval_requests" USING "btree" ("project_id");



CREATE INDEX "idx_approval_requests_release_id" ON "public"."approval_requests" USING "btree" ("release_id");



CREATE INDEX "idx_approval_requests_requested_by_member_id" ON "public"."approval_requests" USING "btree" ("requested_by_member_id");



CREATE INDEX "idx_approval_requests_task_id" ON "public"."approval_requests" USING "btree" ("task_id");



CREATE INDEX "idx_approvals_approval_request_id" ON "public"."approvals" USING "btree" ("approval_request_id");



CREATE INDEX "idx_approvals_approver_member_id" ON "public"."approvals" USING "btree" ("approver_member_id");



CREATE INDEX "idx_approvals_organization_id" ON "public"."approvals" USING "btree" ("organization_id");



CREATE INDEX "idx_attachments_organization_id" ON "public"."attachments" USING "btree" ("organization_id");



CREATE INDEX "idx_attachments_uploaded_by_member_id" ON "public"."attachments" USING "btree" ("uploaded_by_member_id");



CREATE INDEX "idx_audit_logs_actor_member_id" ON "public"."audit_logs" USING "btree" ("actor_member_id");



CREATE INDEX "idx_bugs_assignee_member_id" ON "public"."bugs" USING "btree" ("assignee_member_id");



CREATE INDEX "idx_bugs_org_status" ON "public"."bugs" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_bugs_organization_id" ON "public"."bugs" USING "btree" ("organization_id");



CREATE INDEX "idx_bugs_release_id" ON "public"."bugs" USING "btree" ("release_id");



CREATE INDEX "idx_bugs_reporter_member_id" ON "public"."bugs" USING "btree" ("reporter_member_id");



CREATE INDEX "idx_bugs_task_id" ON "public"."bugs" USING "btree" ("task_id");



CREATE INDEX "idx_ci_jobs_pipeline_id" ON "public"."ci_jobs" USING "btree" ("pipeline_id");



CREATE INDEX "idx_ci_pipelines_organization_id" ON "public"."ci_pipelines" USING "btree" ("organization_id");



CREATE INDEX "idx_ci_pipelines_repository_id" ON "public"."ci_pipelines" USING "btree" ("repository_id");



CREATE INDEX "idx_ci_pipelines_triggered_by_member_id" ON "public"."ci_pipelines" USING "btree" ("triggered_by_member_id");



CREATE INDEX "idx_comment_mentions_mentioned_member_id" ON "public"."comment_mentions" USING "btree" ("mentioned_member_id");



CREATE INDEX "idx_commits_author_member_id" ON "public"."commits" USING "btree" ("author_member_id");



CREATE INDEX "idx_commits_linked_task_id" ON "public"."commits" USING "btree" ("linked_task_id");



CREATE INDEX "idx_commits_organization_id" ON "public"."commits" USING "btree" ("organization_id");



CREATE INDEX "idx_commits_repository_id" ON "public"."commits" USING "btree" ("repository_id");



CREATE INDEX "idx_compliance_controls_organization_id" ON "public"."compliance_controls" USING "btree" ("organization_id");



CREATE INDEX "idx_compliance_controls_owner_member_id" ON "public"."compliance_controls" USING "btree" ("owner_member_id");



CREATE INDEX "idx_compliance_evidence_attachment_id" ON "public"."compliance_evidence" USING "btree" ("attachment_id");



CREATE INDEX "idx_compliance_evidence_compliance_control_id" ON "public"."compliance_evidence" USING "btree" ("compliance_control_id");



CREATE INDEX "idx_compliance_evidence_organization_id" ON "public"."compliance_evidence" USING "btree" ("organization_id");



CREATE INDEX "idx_compliance_evidence_reviewed_by_member_id" ON "public"."compliance_evidence" USING "btree" ("reviewed_by_member_id");



CREATE INDEX "idx_compliance_evidence_submitted_by_member_id" ON "public"."compliance_evidence" USING "btree" ("submitted_by_member_id");



CREATE INDEX "idx_departments_head_member_id" ON "public"."departments" USING "btree" ("head_member_id");



CREATE INDEX "idx_deployments_environment_id" ON "public"."deployments" USING "btree" ("environment_id");



CREATE INDEX "idx_deployments_organization_id" ON "public"."deployments" USING "btree" ("organization_id");



CREATE INDEX "idx_deployments_project_id" ON "public"."deployments" USING "btree" ("project_id");



CREATE INDEX "idx_deployments_rollback_of_deployment_id" ON "public"."deployments" USING "btree" ("rollback_of_deployment_id");



CREATE INDEX "idx_deployments_triggered_by_member_id" ON "public"."deployments" USING "btree" ("triggered_by_member_id");



CREATE INDEX "idx_document_comments_author_member_id" ON "public"."document_comments" USING "btree" ("author_member_id");



CREATE INDEX "idx_document_comments_document_id" ON "public"."document_comments" USING "btree" ("document_id");



CREATE INDEX "idx_document_comments_parent_comment_id" ON "public"."document_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_document_versions_created_by_member_id" ON "public"."document_versions" USING "btree" ("created_by_member_id");



CREATE INDEX "idx_documents_approved_by_member_id" ON "public"."documents" USING "btree" ("approved_by_member_id");



CREATE INDEX "idx_documents_owner_member_id" ON "public"."documents" USING "btree" ("owner_member_id");



CREATE INDEX "idx_documents_project_id" ON "public"."documents" USING "btree" ("project_id");



CREATE INDEX "idx_employee_skills_skill_id" ON "public"."employee_skills" USING "btree" ("skill_id");



CREATE INDEX "idx_epics_organization_id" ON "public"."epics" USING "btree" ("organization_id");



CREATE INDEX "idx_epics_owner_member_id" ON "public"."epics" USING "btree" ("owner_member_id");



CREATE INDEX "idx_incident_followups_incident_id" ON "public"."incident_followups" USING "btree" ("incident_id");



CREATE INDEX "idx_incident_followups_owner_member_id" ON "public"."incident_followups" USING "btree" ("owner_member_id");



CREATE INDEX "idx_incident_followups_task_id" ON "public"."incident_followups" USING "btree" ("task_id");



CREATE INDEX "idx_incident_participants_organization_member_id" ON "public"."incident_participants" USING "btree" ("organization_member_id");



CREATE INDEX "idx_incident_timeline_events_actor_member_id" ON "public"."incident_timeline_events" USING "btree" ("actor_member_id");



CREATE INDEX "idx_incidents_incident_commander_member_id" ON "public"."incidents" USING "btree" ("incident_commander_member_id");



CREATE INDEX "idx_incidents_project_id" ON "public"."incidents" USING "btree" ("project_id");



CREATE INDEX "idx_incidents_release_id" ON "public"."incidents" USING "btree" ("release_id");



CREATE INDEX "idx_leave_requests_approved_by" ON "public"."leave_requests" USING "btree" ("approved_by");



CREATE INDEX "idx_leave_requests_organization_member_id" ON "public"."leave_requests" USING "btree" ("organization_member_id");



CREATE UNIQUE INDEX "idx_legal_docs_active_type" ON "public"."legal_documents" USING "btree" ("document_type") WHERE ("is_active" = true);



CREATE INDEX "idx_member_roles_granted_by" ON "public"."member_roles" USING "btree" ("granted_by");



CREATE INDEX "idx_member_roles_role_id" ON "public"."member_roles" USING "btree" ("role_id");



CREATE INDEX "idx_milestones_owner_member_id" ON "public"."milestones" USING "btree" ("owner_member_id");



CREATE INDEX "idx_notifications_actor_member_id" ON "public"."notifications" USING "btree" ("actor_member_id");



CREATE INDEX "idx_notifications_organization_id" ON "public"."notifications" USING "btree" ("organization_id");



CREATE INDEX "idx_notifications_project_id" ON "public"."notifications" USING "btree" ("project_id");



CREATE INDEX "idx_organization_invite_roles_role_id" ON "public"."organization_invite_roles" USING "btree" ("role_id");



CREATE INDEX "idx_organization_invites_invited_by" ON "public"."organization_invites" USING "btree" ("invited_by");



CREATE INDEX "idx_organization_members_department_id" ON "public"."organization_members" USING "btree" ("department_id");



CREATE INDEX "idx_organization_members_manager_id" ON "public"."organization_members" USING "btree" ("manager_id");



CREATE INDEX "idx_organizations_created_by" ON "public"."organizations" USING "btree" ("created_by");



CREATE INDEX "idx_portfolios_owner_member_id" ON "public"."portfolios" USING "btree" ("owner_member_id");



CREATE INDEX "idx_postmortems_author_member_id" ON "public"."postmortems" USING "btree" ("author_member_id");



CREATE INDEX "idx_presence_sessions_organization_member_id" ON "public"."presence_sessions" USING "btree" ("organization_member_id");



CREATE INDEX "idx_programs_portfolio_id" ON "public"."programs" USING "btree" ("portfolio_id");



CREATE INDEX "idx_programs_program_manager_id" ON "public"."programs" USING "btree" ("program_manager_id");



CREATE INDEX "idx_project_activity_actor_member_id" ON "public"."project_activity" USING "btree" ("actor_member_id");



CREATE INDEX "idx_project_dependencies_depends_on_project_id" ON "public"."project_dependencies" USING "btree" ("depends_on_project_id");



CREATE INDEX "idx_project_dependencies_project_id" ON "public"."project_dependencies" USING "btree" ("project_id");



CREATE INDEX "idx_project_risks_owner_member_id" ON "public"."project_risks" USING "btree" ("owner_member_id");



CREATE INDEX "idx_project_teams_team_id" ON "public"."project_teams" USING "btree" ("team_id");



CREATE INDEX "idx_projects_archived_by" ON "public"."projects" USING "btree" ("archived_by");



CREATE INDEX "idx_projects_owner_member_id" ON "public"."projects" USING "btree" ("owner_member_id");



CREATE INDEX "idx_projects_portfolio_id" ON "public"."projects" USING "btree" ("portfolio_id");



CREATE INDEX "idx_projects_program_id" ON "public"."projects" USING "btree" ("program_id");



CREATE INDEX "idx_projects_project_manager_member_id" ON "public"."projects" USING "btree" ("project_manager_member_id");



CREATE INDEX "idx_pull_requests_author_member_id" ON "public"."pull_requests" USING "btree" ("author_member_id");



CREATE INDEX "idx_pull_requests_linked_task_id" ON "public"."pull_requests" USING "btree" ("linked_task_id");



CREATE INDEX "idx_pull_requests_organization_id" ON "public"."pull_requests" USING "btree" ("organization_id");



CREATE INDEX "idx_release_approvals_approved_by_member_id" ON "public"."release_approvals" USING "btree" ("approved_by_member_id");



CREATE INDEX "idx_releases_organization_id" ON "public"."releases" USING "btree" ("organization_id");



CREATE INDEX "idx_releases_release_manager_member_id" ON "public"."releases" USING "btree" ("release_manager_member_id");



CREATE INDEX "idx_repositories_integration_id" ON "public"."repositories" USING "btree" ("integration_id");



CREATE INDEX "idx_role_permissions_permission_code" ON "public"."role_permissions" USING "btree" ("permission_code");



CREATE INDEX "idx_saved_views_organization_id" ON "public"."saved_views" USING "btree" ("organization_id");



CREATE INDEX "idx_saved_views_owner_member_id" ON "public"."saved_views" USING "btree" ("owner_member_id");



CREATE INDEX "idx_security_findings_organization_id" ON "public"."security_findings" USING "btree" ("organization_id");



CREATE INDEX "idx_security_findings_owner_member_id" ON "public"."security_findings" USING "btree" ("owner_member_id");



CREATE INDEX "idx_security_findings_remediation_task_id" ON "public"."security_findings" USING "btree" ("remediation_task_id");



CREATE INDEX "idx_security_findings_security_review_id" ON "public"."security_findings" USING "btree" ("security_review_id");



CREATE INDEX "idx_security_review_checks_reviewed_by" ON "public"."security_review_checks" USING "btree" ("reviewed_by");



CREATE INDEX "idx_security_review_checks_security_review_id" ON "public"."security_review_checks" USING "btree" ("security_review_id");



CREATE INDEX "idx_security_reviews_org_status" ON "public"."security_reviews" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_security_reviews_organization_id" ON "public"."security_reviews" USING "btree" ("organization_id");



CREATE INDEX "idx_security_reviews_project_id" ON "public"."security_reviews" USING "btree" ("project_id");



CREATE INDEX "idx_security_reviews_project_status" ON "public"."security_reviews" USING "btree" ("project_id", "status");



CREATE INDEX "idx_security_reviews_release_id" ON "public"."security_reviews" USING "btree" ("release_id");



CREATE INDEX "idx_security_reviews_reviewer_member_id" ON "public"."security_reviews" USING "btree" ("reviewer_member_id");



CREATE INDEX "idx_sprints_organization_id" ON "public"."sprints" USING "btree" ("organization_id");



CREATE INDEX "idx_sprints_team_id" ON "public"."sprints" USING "btree" ("team_id");



CREATE INDEX "idx_task_activity_actor_member_id" ON "public"."task_activity" USING "btree" ("actor_member_id");



CREATE INDEX "idx_task_assignees_assigned_by" ON "public"."task_assignees" USING "btree" ("assigned_by");



CREATE INDEX "idx_task_checklist_items_checklist_id" ON "public"."task_checklist_items" USING "btree" ("checklist_id");



CREATE INDEX "idx_task_checklist_items_completed_by" ON "public"."task_checklist_items" USING "btree" ("completed_by");



CREATE INDEX "idx_task_checklists_task_id" ON "public"."task_checklists" USING "btree" ("task_id");



CREATE INDEX "idx_task_comments_author_member_id" ON "public"."task_comments" USING "btree" ("author_member_id");



CREATE INDEX "idx_task_comments_organization_id" ON "public"."task_comments" USING "btree" ("organization_id");



CREATE INDEX "idx_task_comments_parent_comment_id" ON "public"."task_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_task_dependencies_depends_on_task_id" ON "public"."task_dependencies" USING "btree" ("depends_on_task_id");



CREATE INDEX "idx_task_label_links_label_id" ON "public"."task_label_links" USING "btree" ("label_id");



CREATE INDEX "idx_task_watchers_organization_member_id" ON "public"."task_watchers" USING "btree" ("organization_member_id");



CREATE INDEX "idx_tasks_archived_by" ON "public"."tasks" USING "btree" ("archived_by");



CREATE INDEX "idx_tasks_epic_id" ON "public"."tasks" USING "btree" ("epic_id");



CREATE INDEX "idx_tasks_org_status" ON "public"."tasks" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_tasks_reporter_member_id" ON "public"."tasks" USING "btree" ("reporter_member_id");



CREATE INDEX "idx_teams_created_by_member_id" ON "public"."teams" USING "btree" ("created_by_member_id");



CREATE INDEX "idx_teams_department_id" ON "public"."teams" USING "btree" ("department_id");



CREATE INDEX "idx_teams_team_lead_member_id" ON "public"."teams" USING "btree" ("team_lead_member_id");



CREATE INDEX "idx_test_cases_linked_task_id" ON "public"."test_cases" USING "btree" ("linked_task_id");



CREATE INDEX "idx_test_cases_test_plan_id" ON "public"."test_cases" USING "btree" ("test_plan_id");



CREATE INDEX "idx_test_plans_organization_id" ON "public"."test_plans" USING "btree" ("organization_id");



CREATE INDEX "idx_test_plans_owner_member_id" ON "public"."test_plans" USING "btree" ("owner_member_id");



CREATE INDEX "idx_test_plans_project_id" ON "public"."test_plans" USING "btree" ("project_id");



CREATE INDEX "idx_test_plans_release_id" ON "public"."test_plans" USING "btree" ("release_id");



CREATE INDEX "idx_test_run_results_executed_by_member_id" ON "public"."test_run_results" USING "btree" ("executed_by_member_id");



CREATE INDEX "idx_test_run_results_test_case_id" ON "public"."test_run_results" USING "btree" ("test_case_id");



CREATE INDEX "idx_test_run_results_test_run_id" ON "public"."test_run_results" USING "btree" ("test_run_id");



CREATE INDEX "idx_test_runs_environment_id" ON "public"."test_runs" USING "btree" ("environment_id");



CREATE INDEX "idx_test_runs_executed_by_member_id" ON "public"."test_runs" USING "btree" ("executed_by_member_id");



CREATE INDEX "idx_test_runs_organization_id" ON "public"."test_runs" USING "btree" ("organization_id");



CREATE INDEX "idx_test_runs_test_plan_id" ON "public"."test_runs" USING "btree" ("test_plan_id");



CREATE INDEX "idx_time_entries_organization_id" ON "public"."time_entries" USING "btree" ("organization_id");



CREATE INDEX "idx_time_entries_organization_member_id" ON "public"."time_entries" USING "btree" ("organization_member_id");



CREATE INDEX "idx_time_entries_task_id" ON "public"."time_entries" USING "btree" ("task_id");



CREATE INDEX "idx_user_legal_acceptances_user_id" ON "public"."user_legal_acceptances" USING "btree" ("user_id");



CREATE INDEX "import_jobs_org_idx" ON "public"."import_jobs" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "import_rows_job_idx" ON "public"."import_rows" USING "btree" ("import_job_id", "row_number");



CREATE INDEX "incident_timeline_idx" ON "public"."incident_timeline_events" USING "btree" ("incident_id", "occurred_at");



CREATE INDEX "incidents_org_idx" ON "public"."incidents" USING "btree" ("organization_id", "status");



CREATE INDEX "milestones_project_idx" ON "public"."milestones" USING "btree" ("project_id");



CREATE INDEX "notifications_recipient_idx" ON "public"."notifications" USING "btree" ("recipient_member_id", "created_at" DESC);



CREATE INDEX "notifications_unread_idx" ON "public"."notifications" USING "btree" ("recipient_member_id") WHERE ("read_at" IS NULL);



CREATE INDEX "organization_invite_roles_org_idx" ON "public"."organization_invite_roles" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "organization_invites_hash_idx" ON "public"."organization_invites" USING "btree" ("invite_token_hash") WHERE ("invite_token_hash" IS NOT NULL);



CREATE INDEX "organization_invites_org_idx" ON "public"."organization_invites" USING "btree" ("organization_id");



CREATE INDEX "organization_members_org_idx" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "organization_members_user_idx" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "portfolios_org_idx" ON "public"."portfolios" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "profiles_username_normalized_idx" ON "public"."profiles" USING "btree" ("username_normalized") WHERE ("username_normalized" IS NOT NULL);



CREATE INDEX "programs_org_idx" ON "public"."programs" USING "btree" ("organization_id");



CREATE INDEX "project_activity_project_idx" ON "public"."project_activity" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "project_deadlines_org_date_idx" ON "public"."project_deadlines" USING "btree" ("organization_id", "due_date");



CREATE INDEX "project_deadlines_project_idx" ON "public"."project_deadlines" USING "btree" ("project_id", "due_date");



CREATE INDEX "project_members_member_idx" ON "public"."project_members" USING "btree" ("organization_member_id");



CREATE INDEX "project_members_project_idx" ON "public"."project_members" USING "btree" ("project_id");



CREATE INDEX "project_risks_project_idx" ON "public"."project_risks" USING "btree" ("project_id");



CREATE INDEX "projects_org_idx" ON "public"."projects" USING "btree" ("organization_id");



CREATE INDEX "projects_status_idx" ON "public"."projects" USING "btree" ("organization_id", "status");



CREATE UNIQUE INDEX "pull_requests_repo_external_uidx" ON "public"."pull_requests" USING "btree" ("repository_id", "external_id");



CREATE INDEX "pull_requests_repo_idx" ON "public"."pull_requests" USING "btree" ("repository_id");



CREATE INDEX "releases_project_idx" ON "public"."releases" USING "btree" ("project_id");



CREATE INDEX "report_exports_org_idx" ON "public"."report_exports" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "repositories_org_idx" ON "public"."repositories" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "roles_system_code_uniq" ON "public"."roles" USING "btree" ("code") WHERE ("organization_id" IS NULL);



CREATE INDEX "security_findings_project_idx" ON "public"."security_findings" USING "btree" ("project_id", "status");



CREATE UNIQUE INDEX "security_review_assignees_one_active_idx" ON "public"."security_review_assignees" USING "btree" ("security_review_id", "member_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "skills_org_idx" ON "public"."skills" USING "btree" ("organization_id");



CREATE INDEX "sprints_project_idx" ON "public"."sprints" USING "btree" ("project_id");



CREATE UNIQUE INDEX "student_team_join_codes_active_uniq" ON "public"."student_team_join_codes" USING "btree" ("organization_id") WHERE "is_active";



CREATE INDEX "student_team_join_codes_hash_idx" ON "public"."student_team_join_codes" USING "btree" ("code_hash") WHERE "is_active";



CREATE INDEX "student_team_join_codes_org_idx" ON "public"."student_team_join_codes" USING "btree" ("organization_id");



CREATE INDEX "student_team_member_labels_member_idx" ON "public"."student_team_member_labels" USING "btree" ("organization_member_id");



CREATE INDEX "task_activity_task_idx" ON "public"."task_activity" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "task_assignees_active_task_idx" ON "public"."task_assignees" USING "btree" ("task_id", "removed_at");



CREATE INDEX "task_assignees_assigned_by_idx" ON "public"."task_assignees" USING "btree" ("assigned_by_member_id");



CREATE INDEX "task_assignees_member_idx" ON "public"."task_assignees" USING "btree" ("organization_member_id");



CREATE UNIQUE INDEX "task_assignees_one_active_member_idx" ON "public"."task_assignees" USING "btree" ("task_id", "organization_member_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "task_assignees_org_member_active_idx" ON "public"."task_assignees" USING "btree" ("organization_id", "organization_member_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "task_assignees_task_idx" ON "public"."task_assignees" USING "btree" ("task_id");



CREATE INDEX "task_comments_task_idx" ON "public"."task_comments" USING "btree" ("task_id", "created_at");



CREATE UNIQUE INDEX "task_visibility_members_active_unique_idx" ON "public"."task_visibility_members" USING "btree" ("task_id", "member_id", "access_type") WHERE ("revoked_at" IS NULL);



CREATE INDEX "task_visibility_members_member_idx" ON "public"."task_visibility_members" USING "btree" ("member_id", "revoked_at");



CREATE INDEX "task_visibility_members_task_idx" ON "public"."task_visibility_members" USING "btree" ("task_id", "revoked_at");



CREATE INDEX "tasks_assignee_idx" ON "public"."tasks" USING "btree" ("primary_assignee_member_id");



CREATE INDEX "tasks_due_idx" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "tasks_project_idx" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "tasks_sprint_idx" ON "public"."tasks" USING "btree" ("sprint_id");



CREATE INDEX "tasks_status_idx" ON "public"."tasks" USING "btree" ("project_id", "status");



CREATE INDEX "tasks_visibility_scope_idx" ON "public"."tasks" USING "btree" ("organization_id", "visibility_scope");



CREATE INDEX "team_members_member_idx" ON "public"."team_members" USING "btree" ("organization_member_id");



CREATE INDEX "team_members_team_idx" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "teams_org_idx" ON "public"."teams" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "test_plan_assignments_one_active_member_idx" ON "public"."test_plan_assignments" USING "btree" ("test_plan_id", "member_id") WHERE ("removed_at" IS NULL);



CREATE UNIQUE INDEX "test_plan_tasks_unique_idx" ON "public"."test_plan_tasks" USING "btree" ("test_plan_id", "task_id");



CREATE OR REPLACE TRIGGER "set_updated_at_ai_settings" BEFORE UPDATE ON "public"."ai_settings" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_approval_requests" BEFORE UPDATE ON "public"."approval_requests" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_bug_assignees" BEFORE UPDATE ON "public"."bug_assignees" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_bugs" BEFORE UPDATE ON "public"."bugs" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_compliance_controls" BEFORE UPDATE ON "public"."compliance_controls" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_departments" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_documents" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_epics" BEFORE UPDATE ON "public"."epics" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_import_jobs" BEFORE UPDATE ON "public"."import_jobs" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_incidents" BEFORE UPDATE ON "public"."incidents" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_integrations" BEFORE UPDATE ON "public"."integrations" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_leave_requests" BEFORE UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_milestones" BEFORE UPDATE ON "public"."milestones" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_notifications" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_organization_invites" BEFORE UPDATE ON "public"."organization_invites" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_organization_members" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_organizations" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_portfolios" BEFORE UPDATE ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_postmortems" BEFORE UPDATE ON "public"."postmortems" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_programs" BEFORE UPDATE ON "public"."programs" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_project_deadlines" BEFORE UPDATE ON "public"."project_deadlines" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_project_members" BEFORE UPDATE ON "public"."project_members" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_project_risks" BEFORE UPDATE ON "public"."project_risks" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_projects" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_releases" BEFORE UPDATE ON "public"."releases" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_roles" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_saved_views" BEFORE UPDATE ON "public"."saved_views" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_security_review_assignees" BEFORE UPDATE ON "public"."security_review_assignees" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_security_reviews" BEFORE UPDATE ON "public"."security_reviews" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sprints" BEFORE UPDATE ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_student_team_settings" BEFORE UPDATE ON "public"."student_team_settings" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_task_assignees" BEFORE UPDATE ON "public"."task_assignees" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_task_comments" BEFORE UPDATE ON "public"."task_comments" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_task_visibility_members" BEFORE UPDATE ON "public"."task_visibility_members" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_tasks" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_team_members" BEFORE UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_teams" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_test_plan_assignments" BEFORE UPDATE ON "public"."test_plan_assignments" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_test_plans" BEFORE UPDATE ON "public"."test_plans" FOR EACH ROW EXECUTE FUNCTION "handoff"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_assign_task_number" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "handoff"."assign_task_number"();



CREATE OR REPLACE TRIGGER "trg_audit_approval_requests" AFTER INSERT OR DELETE OR UPDATE ON "public"."approval_requests" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_bugs" AFTER INSERT OR DELETE OR UPDATE ON "public"."bugs" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_member_roles" AFTER INSERT OR DELETE OR UPDATE ON "public"."member_roles" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_organization_members" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_projects" AFTER INSERT OR DELETE OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_releases" AFTER INSERT OR DELETE OR UPDATE ON "public"."releases" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_security_reviews" AFTER INSERT OR DELETE OR UPDATE ON "public"."security_reviews" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_student_team_member_labels" AFTER INSERT OR DELETE OR UPDATE ON "public"."student_team_member_labels" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_student_team_settings" AFTER INSERT OR DELETE OR UPDATE ON "public"."student_team_settings" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_tasks" AFTER INSERT OR DELETE OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "handoff"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_check_epic_tenant" BEFORE INSERT OR UPDATE ON "public"."epics" FOR EACH ROW EXECUTE FUNCTION "public"."check_epic_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_project_deadline_tenant" BEFORE INSERT OR UPDATE ON "public"."project_deadlines" FOR EACH ROW EXECUTE FUNCTION "public"."check_project_deadline_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_project_member_tenant" BEFORE INSERT OR UPDATE ON "public"."project_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_project_member_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_project_tenant" BEFORE INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."check_project_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_sprint_tenant" BEFORE INSERT OR UPDATE ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "public"."check_sprint_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_task_assignee_tenant" BEFORE INSERT OR UPDATE ON "public"."task_assignees" FOR EACH ROW EXECUTE FUNCTION "public"."check_task_assignee_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_task_tenant" BEFORE INSERT OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."check_task_tenant"();



CREATE OR REPLACE TRIGGER "trg_check_task_visibility_member_tenant" BEFORE INSERT OR UPDATE ON "public"."task_visibility_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_task_visibility_member_tenant"();



CREATE OR REPLACE TRIGGER "trg_log_task_change" AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "handoff"."log_task_change"();



CREATE OR REPLACE TRIGGER "trg_notify_task_assigned" AFTER INSERT ON "public"."task_assignees" FOR EACH ROW EXECUTE FUNCTION "handoff"."notify_task_assigned"();



CREATE OR REPLACE TRIGGER "trg_sync_task_assignee_access_fields" BEFORE INSERT OR UPDATE ON "public"."task_assignees" FOR EACH ROW EXECUTE FUNCTION "public"."sync_task_assignee_access_fields"();



ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_requester_member_id_fkey" FOREIGN KEY ("requester_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_requests"
    ADD CONSTRAINT "ai_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_sources"
    ADD CONSTRAINT "ai_sources_ai_request_id_fkey" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_approver_member_id_fkey" FOREIGN KEY ("approver_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_uploaded_by_member_id_fkey" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_activity"
    ADD CONSTRAINT "bug_activity_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bug_activity"
    ADD CONSTRAINT "bug_activity_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_activity"
    ADD CONSTRAINT "bug_activity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_assignees"
    ADD CONSTRAINT "bug_assignees_assigned_by_member_id_fkey" FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bug_assignees"
    ADD CONSTRAINT "bug_assignees_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_assignees"
    ADD CONSTRAINT "bug_assignees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_assignees"
    ADD CONSTRAINT "bug_assignees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_assignees"
    ADD CONSTRAINT "bug_assignees_removed_by_member_id_fkey" FOREIGN KEY ("removed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bug_attachments"
    ADD CONSTRAINT "bug_attachments_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_attachments"
    ADD CONSTRAINT "bug_attachments_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_attachments"
    ADD CONSTRAINT "bug_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_attachments"
    ADD CONSTRAINT "bug_attachments_uploaded_by_member_id_fkey" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_assignee_member_id_fkey" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_reporter_member_id_fkey" FOREIGN KEY ("reporter_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ci_jobs"
    ADD CONSTRAINT "ci_jobs_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."ci_pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ci_pipelines"
    ADD CONSTRAINT "ci_pipelines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ci_pipelines"
    ADD CONSTRAINT "ci_pipelines_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ci_pipelines"
    ADD CONSTRAINT "ci_pipelines_triggered_by_member_id_fkey" FOREIGN KEY ("triggered_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comment_mentions"
    ADD CONSTRAINT "comment_mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_mentions"
    ADD CONSTRAINT "comment_mentions_mentioned_member_id_fkey" FOREIGN KEY ("mentioned_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_author_member_id_fkey" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_controls"
    ADD CONSTRAINT "compliance_controls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_controls"
    ADD CONSTRAINT "compliance_controls_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."compliance_evidence"
    ADD CONSTRAINT "compliance_evidence_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."compliance_evidence"
    ADD CONSTRAINT "compliance_evidence_compliance_control_id_fkey" FOREIGN KEY ("compliance_control_id") REFERENCES "public"."compliance_controls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_evidence"
    ADD CONSTRAINT "compliance_evidence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_evidence"
    ADD CONSTRAINT "compliance_evidence_reviewed_by_member_id_fkey" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."compliance_evidence"
    ADD CONSTRAINT "compliance_evidence_submitted_by_member_id_fkey" FOREIGN KEY ("submitted_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_demo_member_id_fkey" FOREIGN KEY ("demo_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_sessions"
    ADD CONSTRAINT "demo_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_head_member_id_fkey" FOREIGN KEY ("head_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployment_logs"
    ADD CONSTRAINT "deployment_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployment_logs"
    ADD CONSTRAINT "deployment_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_rollback_of_deployment_id_fkey" FOREIGN KEY ("rollback_of_deployment_id") REFERENCES "public"."deployments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deployments"
    ADD CONSTRAINT "deployments_triggered_by_member_id_fkey" FOREIGN KEY ("triggered_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_comments"
    ADD CONSTRAINT "document_comments_author_member_id_fkey" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_comments"
    ADD CONSTRAINT "document_comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_comments"
    ADD CONSTRAINT "document_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."document_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_links"
    ADD CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_approved_by_member_id_fkey" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."environments"
    ADD CONSTRAINT "environments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."epics"
    ADD CONSTRAINT "epics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."epics"
    ADD CONSTRAINT "epics_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."epics"
    ADD CONSTRAINT "epics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_rows"
    ADD CONSTRAINT "import_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_followups"
    ADD CONSTRAINT "incident_followups_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_followups"
    ADD CONSTRAINT "incident_followups_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incident_followups"
    ADD CONSTRAINT "incident_followups_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incident_participants"
    ADD CONSTRAINT "incident_participants_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_participants"
    ADD CONSTRAINT "incident_participants_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_timeline_events"
    ADD CONSTRAINT "incident_timeline_events_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incident_timeline_events"
    ADD CONSTRAINT "incident_timeline_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_incident_commander_member_id_fkey" FOREIGN KEY ("incident_commander_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_member_id_fkey" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "org_members_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_task_counters"
    ADD CONSTRAINT "org_task_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invite_roles"
    ADD CONSTRAINT "organization_invite_roles_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "public"."organization_invites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invite_roles"
    ADD CONSTRAINT "organization_invite_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invite_roles"
    ADD CONSTRAINT "organization_invite_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invites"
    ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_department_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."postmortems"
    ADD CONSTRAINT "postmortems_author_member_id_fkey" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."postmortems"
    ADD CONSTRAINT "postmortems_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presence_sessions"
    ADD CONSTRAINT "presence_sessions_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_program_manager_id_fkey" FOREIGN KEY ("program_manager_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_activity"
    ADD CONSTRAINT "project_activity_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_activity"
    ADD CONSTRAINT "project_activity_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_deadlines"
    ADD CONSTRAINT "project_deadlines_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_dependencies"
    ADD CONSTRAINT "project_dependencies_depends_on_project_id_fkey" FOREIGN KEY ("depends_on_project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_dependencies"
    ADD CONSTRAINT "project_dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_risks"
    ADD CONSTRAINT "project_risks_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_risks"
    ADD CONSTRAINT "project_risks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_manager_member_id_fkey" FOREIGN KEY ("project_manager_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_author_member_id_fkey" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_approvals"
    ADD CONSTRAINT "release_approvals_approved_by_member_id_fkey" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."release_approvals"
    ADD CONSTRAINT "release_approvals_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_release_manager_member_id_fkey" FOREIGN KEY ("release_manager_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_deliveries"
    ADD CONSTRAINT "report_deliveries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."report_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_exports"
    ADD CONSTRAINT "report_exports_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_exports"
    ADD CONSTRAINT "report_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_runs"
    ADD CONSTRAINT "report_runs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."repositories"
    ADD CONSTRAINT "repositories_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."repositories"
    ADD CONSTRAINT "repositories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "public"."permissions"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_views"
    ADD CONSTRAINT "saved_views_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_findings"
    ADD CONSTRAINT "security_findings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_findings"
    ADD CONSTRAINT "security_findings_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_findings"
    ADD CONSTRAINT "security_findings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_findings"
    ADD CONSTRAINT "security_findings_remediation_task_id_fkey" FOREIGN KEY ("remediation_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_findings"
    ADD CONSTRAINT "security_findings_security_review_id_fkey" FOREIGN KEY ("security_review_id") REFERENCES "public"."security_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_review_assignees"
    ADD CONSTRAINT "security_review_assignees_assigned_by_member_id_fkey" FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_review_assignees"
    ADD CONSTRAINT "security_review_assignees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_review_assignees"
    ADD CONSTRAINT "security_review_assignees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_review_assignees"
    ADD CONSTRAINT "security_review_assignees_removed_by_member_id_fkey" FOREIGN KEY ("removed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_review_assignees"
    ADD CONSTRAINT "security_review_assignees_security_review_id_fkey" FOREIGN KEY ("security_review_id") REFERENCES "public"."security_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_review_checks"
    ADD CONSTRAINT "security_review_checks_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_review_checks"
    ADD CONSTRAINT "security_review_checks_security_review_id_fkey" FOREIGN KEY ("security_review_id") REFERENCES "public"."security_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_reviewer_member_id_fkey" FOREIGN KEY ("reviewer_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_reviews"
    ADD CONSTRAINT "security_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_team_join_codes"
    ADD CONSTRAINT "student_team_join_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_team_join_codes"
    ADD CONSTRAINT "student_team_join_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_team_member_labels"
    ADD CONSTRAINT "student_team_member_labels_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_team_member_labels"
    ADD CONSTRAINT "student_team_member_labels_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_team_settings"
    ADD CONSTRAINT "student_team_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_assigned_by_member_id_fkey" FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_removed_by_member_id_fkey" FOREIGN KEY ("removed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "public"."task_checklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_checklists"
    ADD CONSTRAINT "task_checklists_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_author_member_id_fkey" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."task_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."task_labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_visibility_members"
    ADD CONSTRAINT "task_visibility_members_granted_by_member_id_fkey" FOREIGN KEY ("granted_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_visibility_members"
    ADD CONSTRAINT "task_visibility_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_visibility_members"
    ADD CONSTRAINT "task_visibility_members_revoked_by_member_id_fkey" FOREIGN KEY ("revoked_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_visibility_members"
    ADD CONSTRAINT "task_visibility_members_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "public"."epics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_primary_assignee_member_id_fkey" FOREIGN KEY ("primary_assignee_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_reporter_member_id_fkey" FOREIGN KEY ("reporter_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_team_lead_member_id_fkey" FOREIGN KEY ("team_lead_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_cases"
    ADD CONSTRAINT "test_cases_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_cases"
    ADD CONSTRAINT "test_cases_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "public"."test_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plan_assignments"
    ADD CONSTRAINT "test_plan_assignments_assigned_by_member_id_fkey" FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_plan_assignments"
    ADD CONSTRAINT "test_plan_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plan_assignments"
    ADD CONSTRAINT "test_plan_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plan_assignments"
    ADD CONSTRAINT "test_plan_assignments_removed_by_member_id_fkey" FOREIGN KEY ("removed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_plan_assignments"
    ADD CONSTRAINT "test_plan_assignments_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "public"."test_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plan_tasks"
    ADD CONSTRAINT "test_plan_tasks_linked_by_member_id_fkey" FOREIGN KEY ("linked_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_plan_tasks"
    ADD CONSTRAINT "test_plan_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plan_tasks"
    ADD CONSTRAINT "test_plan_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plan_tasks"
    ADD CONSTRAINT "test_plan_tasks_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "public"."test_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plans"
    ADD CONSTRAINT "test_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plans"
    ADD CONSTRAINT "test_plans_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_plans"
    ADD CONSTRAINT "test_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_plans"
    ADD CONSTRAINT "test_plans_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_run_results"
    ADD CONSTRAINT "test_run_results_executed_by_member_id_fkey" FOREIGN KEY ("executed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_run_results"
    ADD CONSTRAINT "test_run_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_run_results"
    ADD CONSTRAINT "test_run_results_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_runs"
    ADD CONSTRAINT "test_runs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_runs"
    ADD CONSTRAINT "test_runs_executed_by_member_id_fkey" FOREIGN KEY ("executed_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."test_runs"
    ADD CONSTRAINT "test_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_runs"
    ADD CONSTRAINT "test_runs_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "public"."test_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_organization_member_id_fkey" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_legal_acceptances"
    ADD CONSTRAINT "user_legal_acceptances_cookies_document_id_fkey" FOREIGN KEY ("cookies_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_legal_acceptances"
    ADD CONSTRAINT "user_legal_acceptances_privacy_document_id_fkey" FOREIGN KEY ("privacy_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_legal_acceptances"
    ADD CONSTRAINT "user_legal_acceptances_terms_document_id_fkey" FOREIGN KEY ("terms_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_legal_acceptances"
    ADD CONSTRAINT "user_legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Public can view active legal documents" ON "public"."legal_documents" FOR SELECT USING ((("is_active" = true) AND ("published_at" IS NOT NULL)));



CREATE POLICY "Users can view their own legal acceptances" ON "public"."user_legal_acceptances" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "activity_insert" ON "public"."project_activity" FOR INSERT WITH CHECK ("handoff"."can_view_project"("project_id"));



CREATE POLICY "activity_select" ON "public"."project_activity" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



ALTER TABLE "public"."ai_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_requests_insert" ON "public"."ai_requests" FOR INSERT WITH CHECK (("handoff"."has_permission"("organization_id", 'ai:use'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "ai_requests"."requester_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "ai_requests_select" ON "public"."ai_requests" FOR SELECT USING (("handoff"."is_org_member"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "ai_requests"."requester_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."ai_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_settings_delete" ON "public"."ai_settings" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'organization:manage'::"text"));



CREATE POLICY "ai_settings_insert" ON "public"."ai_settings" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'organization:manage'::"text"));



CREATE POLICY "ai_settings_update" ON "public"."ai_settings" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'organization:manage'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'organization:manage'::"text"));



ALTER TABLE "public"."ai_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_sources_insert" ON "public"."ai_sources" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_requests" "r"
  WHERE (("r"."id" = "ai_sources"."ai_request_id") AND "handoff"."is_org_member"("r"."organization_id")))));



CREATE POLICY "ai_sources_select" ON "public"."ai_sources" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ai_requests" "r"
  WHERE (("r"."id" = "ai_sources"."ai_request_id") AND "handoff"."is_org_member"("r"."organization_id")))));



CREATE POLICY "appr_req_delete" ON "public"."approval_requests" FOR DELETE USING (("handoff"."has_permission"("organization_id", 'approval:create'::"text") OR "handoff"."has_permission"("organization_id", 'approval:decide'::"text")));



CREATE POLICY "appr_req_insert" ON "public"."approval_requests" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "appr_req_select" ON "public"."approval_requests" FOR SELECT USING (("handoff"."is_org_member"("organization_id") AND (("requested_by_member_id" = "handoff"."current_member_id"("organization_id")) OR (EXISTS ( SELECT 1
   FROM "public"."approvals" "a"
  WHERE (("a"."approval_request_id" = "a"."id") AND ("a"."approver_member_id" = "handoff"."current_member_id"("a"."organization_id"))))) OR ((("project_id" IS NULL) OR "handoff"."can_view_project"("project_id")) AND (("task_id" IS NULL) OR "handoff"."can_view_task"("task_id")) AND (("release_id" IS NULL) OR "handoff"."can_view_release"("release_id"))))));



CREATE POLICY "appr_req_update" ON "public"."approval_requests" FOR UPDATE USING (("handoff"."has_permission"("organization_id", 'approval:create'::"text") OR "handoff"."has_permission"("organization_id", 'approval:decide'::"text"))) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."approval_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approvals_insert" ON "public"."approvals" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'approval:decide'::"text"));



CREATE POLICY "approvals_select" ON "public"."approvals" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attachments_delete" ON "public"."attachments" FOR DELETE USING (((("task_id" IS NULL) OR "handoff"."can_view_task"("task_id")) AND ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "attachments"."uploaded_by_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (("task_id" IS NOT NULL) AND "handoff"."can_assign_task"("task_id")))));



CREATE POLICY "attachments_insert" ON "public"."attachments" FOR INSERT WITH CHECK (("handoff"."is_org_member"("organization_id") AND (("task_id" IS NULL) OR "handoff"."can_view_task"("task_id")) AND (("project_id" IS NULL) OR "handoff"."can_view_project"("project_id")) AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "attachments"."uploaded_by_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "attachments_select" ON "public"."attachments" FOR SELECT USING (("handoff"."is_org_member"("organization_id") AND (("task_id" IS NULL) OR "handoff"."can_view_task"("task_id")) AND (("project_id" IS NULL) OR "handoff"."can_view_project"("project_id"))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select" ON "public"."audit_logs" FOR SELECT USING ("handoff"."has_permission"("organization_id", 'audit:view'::"text"));



ALTER TABLE "public"."bug_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bug_activity_select" ON "public"."bug_activity" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bugs"
  WHERE (("bugs"."id" = "bug_activity"."bug_id") AND "handoff"."can_view_project"("bugs"."project_id") AND (("bugs"."task_id" IS NULL) OR "handoff"."can_view_task"("bugs"."task_id"))))));



ALTER TABLE "public"."bug_assignees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bug_assignees_manage" ON "public"."bug_assignees" USING ((EXISTS ( SELECT 1
   FROM "public"."bugs"
  WHERE (("bugs"."id" = "bug_assignees"."bug_id") AND "handoff"."can_view_project"("bugs"."project_id") AND (("bugs"."task_id" IS NULL) OR "handoff"."can_view_task"("bugs"."task_id"))))));



CREATE POLICY "bug_assignees_select" ON "public"."bug_assignees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bugs"
  WHERE (("bugs"."id" = "bug_assignees"."bug_id") AND "handoff"."can_view_project"("bugs"."project_id") AND (("bugs"."task_id" IS NULL) OR "handoff"."can_view_task"("bugs"."task_id"))))));



ALTER TABLE "public"."bug_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bug_attachments_select" ON "public"."bug_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bugs"
  WHERE (("bugs"."id" = "bug_attachments"."bug_id") AND "handoff"."can_view_project"("bugs"."project_id") AND (("bugs"."task_id" IS NULL) OR "handoff"."can_view_task"("bugs"."task_id"))))));



ALTER TABLE "public"."bugs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bugs_delete" ON "public"."bugs" FOR DELETE USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "bugs_insert" ON "public"."bugs" FOR INSERT WITH CHECK ("handoff"."can_view_project"("project_id"));



CREATE POLICY "bugs_manage" ON "public"."bugs" USING (("handoff"."can_view_project"("project_id") AND (("task_id" IS NULL) OR "handoff"."can_view_task"("task_id")))) WITH CHECK (("handoff"."can_view_project"("project_id") AND (("task_id" IS NULL) OR "handoff"."can_view_task"("task_id"))));



CREATE POLICY "bugs_select" ON "public"."bugs" FOR SELECT USING (("handoff"."can_view_project"("project_id") AND (("task_id" IS NULL) OR "handoff"."can_view_task"("task_id"))));



CREATE POLICY "bugs_update" ON "public"."bugs" FOR UPDATE USING ("handoff"."can_view_project"("project_id")) WITH CHECK ("handoff"."can_view_project"("project_id"));



CREATE POLICY "checklist_items_delete" ON "public"."task_checklist_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."task_checklists" "c"
  WHERE (("c"."id" = "task_checklist_items"."checklist_id") AND "handoff"."can_edit_task"("c"."task_id")))));



CREATE POLICY "checklist_items_insert" ON "public"."task_checklist_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."task_checklists" "c"
  WHERE (("c"."id" = "task_checklist_items"."checklist_id") AND "handoff"."can_edit_task"("c"."task_id")))));



CREATE POLICY "checklist_items_select" ON "public"."task_checklist_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."task_checklists" "c"
  WHERE (("c"."id" = "task_checklist_items"."checklist_id") AND "handoff"."can_view_task"("c"."task_id")))));



CREATE POLICY "checklist_items_update" ON "public"."task_checklist_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."task_checklists" "c"
  WHERE (("c"."id" = "task_checklist_items"."checklist_id") AND "handoff"."can_edit_task"("c"."task_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."task_checklists" "c"
  WHERE (("c"."id" = "task_checklist_items"."checklist_id") AND "handoff"."can_edit_task"("c"."task_id")))));



CREATE POLICY "checklists_delete" ON "public"."task_checklists" FOR DELETE USING ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "checklists_insert" ON "public"."task_checklists" FOR INSERT WITH CHECK ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "checklists_select" ON "public"."task_checklists" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "checklists_update" ON "public"."task_checklists" FOR UPDATE USING ("handoff"."can_edit_task"("task_id")) WITH CHECK ("handoff"."can_edit_task"("task_id"));



ALTER TABLE "public"."ci_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ci_jobs_delete" ON "public"."ci_jobs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."ci_pipelines" "p"
  WHERE (("p"."id" = "ci_jobs"."pipeline_id") AND "handoff"."has_permission"("p"."organization_id", 'integration:manage'::"text")))));



CREATE POLICY "ci_jobs_insert" ON "public"."ci_jobs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ci_pipelines" "p"
  WHERE (("p"."id" = "ci_jobs"."pipeline_id") AND "handoff"."is_org_member"("p"."organization_id")))));



CREATE POLICY "ci_jobs_select" ON "public"."ci_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ci_pipelines" "p"
  WHERE (("p"."id" = "ci_jobs"."pipeline_id") AND "handoff"."is_org_member"("p"."organization_id")))));



CREATE POLICY "ci_jobs_update" ON "public"."ci_jobs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."ci_pipelines" "p"
  WHERE (("p"."id" = "ci_jobs"."pipeline_id") AND "handoff"."has_permission"("p"."organization_id", 'integration:manage'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ci_pipelines" "p"
  WHERE (("p"."id" = "ci_jobs"."pipeline_id") AND "handoff"."is_org_member"("p"."organization_id")))));



ALTER TABLE "public"."ci_pipelines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_mentions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_insert" ON "public"."task_comments" FOR INSERT WITH CHECK (("handoff"."can_view_task"("task_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "task_comments"."author_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "comments_select" ON "public"."task_comments" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "comments_update_own" ON "public"."task_comments" FOR UPDATE USING (("handoff"."can_view_task"("task_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "task_comments"."author_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (("handoff"."can_view_task"("task_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "task_comments"."author_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."commits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commits_delete" ON "public"."commits" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "commits_insert" ON "public"."commits" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "commits_select" ON "public"."commits" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "commits_update" ON "public"."commits" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text")) WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "complianc_delete" ON "public"."compliance_controls" FOR DELETE USING (("handoff"."has_permission"("organization_id", 'document:approve'::"text") OR "handoff"."has_role"("organization_id", ARRAY['COMPLIANCE_REVIEWER'::"text", 'ORG_ADMIN'::"text", 'SUPER_ADMIN'::"text"])));



CREATE POLICY "complianc_insert" ON "public"."compliance_controls" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "complianc_update" ON "public"."compliance_controls" FOR UPDATE USING (("handoff"."has_permission"("organization_id", 'document:approve'::"text") OR "handoff"."has_role"("organization_id", ARRAY['COMPLIANCE_REVIEWER'::"text", 'ORG_ADMIN'::"text", 'SUPER_ADMIN'::"text"]))) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."compliance_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compliance_ev_delete" ON "public"."compliance_evidence" FOR DELETE USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "compliance_ev_insert" ON "public"."compliance_evidence" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "compliance_ev_select" ON "public"."compliance_evidence" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "compliance_ev_update" ON "public"."compliance_evidence" FOR UPDATE USING ("handoff"."is_org_member"("organization_id")) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."compliance_evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compliance_select" ON "public"."compliance_controls" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."demo_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demo_sessions_select" ON "public"."demo_sessions" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "demo_sessions_update" ON "public"."demo_sessions" FOR UPDATE USING (("auth_user_id" = "auth"."uid"())) WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "deny_all" ON "public"."org_task_counters" AS RESTRICTIVE USING (false);



CREATE POLICY "deny_all" ON "public"."rate_limits" AS RESTRICTIVE USING (false);



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_delete" ON "public"."departments" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'team:create'::"text"));



CREATE POLICY "departments_insert" ON "public"."departments" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'team:create'::"text"));



CREATE POLICY "departments_select" ON "public"."departments" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "departments_update" ON "public"."departments" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'team:create'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'team:create'::"text"));



ALTER TABLE "public"."deployment_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deployment_logs_manage" ON "public"."deployment_logs" USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "deployment_logs_select" ON "public"."deployment_logs" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



ALTER TABLE "public"."deployments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deployments_delete" ON "public"."deployments" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'release:deploy'::"text"));



CREATE POLICY "deployments_insert" ON "public"."deployments" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'release:deploy'::"text"));



CREATE POLICY "deployments_select" ON "public"."deployments" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "deployments_update" ON "public"."deployments" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'release:deploy'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'release:deploy'::"text"));



CREATE POLICY "deps_delete" ON "public"."project_dependencies" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "deps_insert" ON "public"."project_dependencies" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "deps_update" ON "public"."project_dependencies" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "doc_comments_insert" ON "public"."document_comments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     JOIN "public"."organization_members" "m" ON (("m"."id" = "document_comments"."author_member_id")))
  WHERE (("d"."id" = "document_comments"."document_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "handoff"."is_org_member"("d"."organization_id")))));



CREATE POLICY "doc_comments_select" ON "public"."document_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_comments"."document_id") AND "handoff"."is_org_member"("d"."organization_id")))));



CREATE POLICY "doc_links_all" ON "public"."document_links" USING ((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_links"."document_id") AND "handoff"."is_org_member"("d"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_links"."document_id") AND "handoff"."is_org_member"("d"."organization_id")))));



CREATE POLICY "doc_versions_insert" ON "public"."document_versions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_versions"."document_id") AND "handoff"."has_permission"("d"."organization_id", 'document:update'::"text")))));



CREATE POLICY "doc_versions_select" ON "public"."document_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_versions"."document_id") AND "handoff"."is_org_member"("d"."organization_id")))));



ALTER TABLE "public"."document_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_insert" ON "public"."documents" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'document:create'::"text"));



CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT USING (("handoff"."is_org_member"("organization_id") AND (("classification" <> 'RESTRICTED'::"text") OR ("project_id" IS NULL) OR "handoff"."can_view_project"("project_id"))));



CREATE POLICY "documents_update" ON "public"."documents" FOR UPDATE USING (("handoff"."has_permission"("organization_id", 'document:update'::"text") OR "handoff"."has_permission"("organization_id", 'document:approve'::"text"))) WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "emp_avail_delete" ON "public"."employee_availability" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_availability"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "emp_avail_insert" ON "public"."employee_availability" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_availability"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "emp_avail_select" ON "public"."employee_availability" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_availability"."organization_member_id") AND "handoff"."is_org_member"("m"."organization_id")))));



CREATE POLICY "emp_avail_update" ON "public"."employee_availability" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_availability"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_availability"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "emp_skills_delete" ON "public"."employee_skills" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_skills"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "emp_skills_insert" ON "public"."employee_skills" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_skills"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "emp_skills_select" ON "public"."employee_skills" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_skills"."organization_member_id") AND "handoff"."is_org_member"("m"."organization_id")))));



CREATE POLICY "emp_skills_update" ON "public"."employee_skills" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_skills"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "employee_skills"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



ALTER TABLE "public"."employee_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."environments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "environments_delete" ON "public"."environments" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "environments_insert" ON "public"."environments" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "environments_select" ON "public"."environments" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "environments_update" ON "public"."environments" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



ALTER TABLE "public"."epics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "epics_delete" ON "public"."epics" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "epics_insert" ON "public"."epics" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "epics_select" ON "public"."epics" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "epics_update" ON "public"."epics" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_jobs_insert" ON "public"."import_jobs" FOR INSERT WITH CHECK ((("created_by_member_id" = "handoff"."current_member_id"("organization_id")) AND ((("import_type" = 'PROJECTS'::"text") AND "handoff"."has_permission"("organization_id", 'project:import'::"text")) OR (("import_type" = 'TASKS'::"text") AND "handoff"."has_permission"("organization_id", 'task:import'::"text")))));



CREATE POLICY "import_jobs_select" ON "public"."import_jobs" FOR SELECT USING ((("created_by_member_id" = "handoff"."current_member_id"("organization_id")) OR "handoff"."has_permission"("organization_id", 'project:import'::"text")));



CREATE POLICY "import_jobs_update" ON "public"."import_jobs" FOR UPDATE USING ((("created_by_member_id" = "handoff"."current_member_id"("organization_id")) AND ((("import_type" = 'PROJECTS'::"text") AND "handoff"."has_permission"("organization_id", 'project:import'::"text")) OR (("import_type" = 'TASKS'::"text") AND "handoff"."has_permission"("organization_id", 'task:import'::"text"))))) WITH CHECK ((("created_by_member_id" = "handoff"."current_member_id"("organization_id")) AND ((("import_type" = 'PROJECTS'::"text") AND "handoff"."has_permission"("organization_id", 'project:import'::"text")) OR (("import_type" = 'TASKS'::"text") AND "handoff"."has_permission"("organization_id", 'task:import'::"text")))));



ALTER TABLE "public"."import_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_rows_manage" ON "public"."import_rows" USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs" "j"
  WHERE (("j"."id" = "import_rows"."import_job_id") AND ("j"."created_by_member_id" = "handoff"."current_member_id"("j"."organization_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_jobs" "j"
  WHERE (("j"."id" = "import_rows"."import_job_id") AND ("j"."created_by_member_id" = "handoff"."current_member_id"("j"."organization_id"))))));



CREATE POLICY "import_rows_select" ON "public"."import_rows" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."import_jobs" "j"
  WHERE (("j"."id" = "import_rows"."import_job_id") AND (("j"."created_by_member_id" = "handoff"."current_member_id"("j"."organization_id")) OR "handoff"."has_permission"("j"."organization_id", 'project:import'::"text") OR "handoff"."has_permission"("j"."organization_id", 'task:import'::"text"))))));



CREATE POLICY "inc_followups_all" ON "public"."incident_followups" USING ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "incident_followups"."incident_id") AND "handoff"."is_org_member"("i"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "incident_followups"."incident_id") AND "handoff"."is_org_member"("i"."organization_id")))));



CREATE POLICY "inc_part_all" ON "public"."incident_participants" USING ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "incident_participants"."incident_id") AND "handoff"."is_org_member"("i"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "incident_participants"."incident_id") AND "handoff"."is_org_member"("i"."organization_id")))));



CREATE POLICY "inc_timeline_insert" ON "public"."incident_timeline_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "incident_timeline_events"."incident_id") AND "handoff"."is_org_member"("i"."organization_id")))));



CREATE POLICY "inc_timeline_select" ON "public"."incident_timeline_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "incident_timeline_events"."incident_id") AND "handoff"."is_org_member"("i"."organization_id")))));



ALTER TABLE "public"."incident_followups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incident_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incident_timeline_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incidents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incidents_delete" ON "public"."incidents" FOR DELETE USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "incidents_insert" ON "public"."incidents" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "incidents_select" ON "public"."incidents" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "incidents_update" ON "public"."incidents" FOR UPDATE USING ("handoff"."is_org_member"("organization_id")) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integrations_delete" ON "public"."integrations" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "integrations_insert" ON "public"."integrations" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "integrations_select" ON "public"."integrations" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "integrations_update" ON "public"."integrations" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "invites_delete" ON "public"."organization_invites" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'member:invite'::"text"));



CREATE POLICY "invites_insert" ON "public"."organization_invites" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'member:invite'::"text"));



CREATE POLICY "invites_select" ON "public"."organization_invites" FOR SELECT USING ("handoff"."has_permission"("organization_id", 'member:invite'::"text"));



CREATE POLICY "invites_update" ON "public"."organization_invites" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'member:invite'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'member:invite'::"text"));



CREATE POLICY "leav_delete" ON "public"."leave_requests" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "leave_requests"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "leav_insert" ON "public"."leave_requests" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "leave_requests"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



CREATE POLICY "leav_update" ON "public"."leave_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "leave_requests"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "leave_requests"."organization_member_id") AND (("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))));



ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_select" ON "public"."leave_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "leave_requests"."organization_member_id") AND "handoff"."is_org_member"("m"."organization_id")))));



ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_roles_delete" ON "public"."member_roles" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "member_roles"."organization_member_id") AND "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text")))));



CREATE POLICY "member_roles_insert" ON "public"."member_roles" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "member_roles"."organization_member_id") AND "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text")))));



CREATE POLICY "member_roles_select" ON "public"."member_roles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "member_roles"."organization_member_id") AND "handoff"."is_org_member"("m"."organization_id")))));



CREATE POLICY "member_roles_update" ON "public"."member_roles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "member_roles"."organization_member_id") AND "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "member_roles"."organization_member_id") AND "handoff"."has_permission"("m"."organization_id", 'member:manage'::"text")))));



CREATE POLICY "mentions_insert" ON "public"."comment_mentions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."task_comments" "c"
     JOIN "public"."organization_members" "m" ON (("m"."id" = "c"."author_member_id")))
  WHERE (("c"."id" = "comment_mentions"."comment_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "handoff"."can_view_task"("c"."task_id")))));



CREATE POLICY "mentions_select" ON "public"."comment_mentions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."task_comments" "c"
  WHERE (("c"."id" = "comment_mentions"."comment_id") AND "handoff"."can_view_task"("c"."task_id")))));



ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "milestones_delete" ON "public"."milestones" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "milestones_insert" ON "public"."milestones" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "milestones_select" ON "public"."milestones" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "milestones_update" ON "public"."milestones" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "notif_prefs_all" ON "public"."notification_preferences" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "notification_preferences"."organization_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "notification_preferences"."organization_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "notifications"."recipient_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "notifications"."recipient_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "notifications"."recipient_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "org_admins_can_view_invite_roles" ON "public"."organization_invite_roles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."organization_members" "om"
     JOIN "public"."member_roles" "mr" ON (("mr"."organization_member_id" = "om"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "mr"."role_id")))
  WHERE (("om"."organization_id" = "organization_invite_roles"."organization_id") AND ("om"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("r"."code" = ANY (ARRAY['ORG_OWNER'::"text", 'ORG_ADMIN'::"text"]))))));



CREATE POLICY "org_members_insert" ON "public"."organization_members" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'member:manage'::"text"));



CREATE POLICY "org_members_select" ON "public"."organization_members" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "org_members_update" ON "public"."organization_members" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'member:manage'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'member:manage'::"text"));



ALTER TABLE "public"."org_task_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invite_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_insert" ON "public"."organizations" FOR INSERT WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "organizations_select" ON "public"."organizations" FOR SELECT USING ("handoff"."is_org_member"("id"));



CREATE POLICY "organizations_update" ON "public"."organizations" FOR UPDATE USING ("handoff"."has_permission"("id", 'organization:manage'::"text")) WITH CHECK ("handoff"."has_permission"("id", 'organization:manage'::"text"));



ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permissions_select" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pipelines_delete" ON "public"."ci_pipelines" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "pipelines_insert" ON "public"."ci_pipelines" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "pipelines_select" ON "public"."ci_pipelines" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "pipelines_update" ON "public"."ci_pipelines" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text")) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."portfolios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portfolios_delete" ON "public"."portfolios" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



CREATE POLICY "portfolios_insert" ON "public"."portfolios" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



CREATE POLICY "portfolios_select" ON "public"."portfolios" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "portfolios_update" ON "public"."portfolios" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'project:create'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



ALTER TABLE "public"."postmortems" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "postmortems_all" ON "public"."postmortems" USING ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "postmortems"."incident_id") AND "handoff"."is_org_member"("i"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."incidents" "i"
  WHERE (("i"."id" = "postmortems"."incident_id") AND "handoff"."is_org_member"("i"."organization_id")))));



CREATE POLICY "presence_all" ON "public"."presence_sessions" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "presence_sessions"."organization_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "presence_sessions"."organization_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."presence_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM ("public"."organization_members" "me"
     JOIN "public"."organization_members" "them" ON (("them"."organization_id" = "me"."organization_id")))
  WHERE (("me"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "me"."is_active" AND ("them"."user_id" = "profiles"."id"))))));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programs_delete" ON "public"."programs" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



CREATE POLICY "programs_insert" ON "public"."programs" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



CREATE POLICY "programs_update" ON "public"."programs" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'project:create'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



ALTER TABLE "public"."project_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_deadlines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_deadlines_insert" ON "public"."project_deadlines" FOR INSERT WITH CHECK (("handoff"."can_view_project"("project_id") AND ("handoff"."has_permission"("organization_id", 'deadline:create'::"text") OR "handoff"."has_permission"("organization_id", 'project:update'::"text")) AND ("created_by_member_id" = "handoff"."current_member_id"("organization_id"))));



CREATE POLICY "project_deadlines_select" ON "public"."project_deadlines" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "project_deadlines_update" ON "public"."project_deadlines" FOR UPDATE USING (("handoff"."can_view_project"("project_id") AND ("handoff"."has_permission"("organization_id", 'deadline:create'::"text") OR "handoff"."has_permission"("organization_id", 'project:update'::"text")))) WITH CHECK (("handoff"."can_view_project"("project_id") AND ("handoff"."has_permission"("organization_id", 'deadline:create'::"text") OR "handoff"."has_permission"("organization_id", 'project:update'::"text"))));



ALTER TABLE "public"."project_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_members_delete" ON "public"."project_members" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "project_members_insert" ON "public"."project_members" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "project_members_select" ON "public"."project_members" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "project_members_update" ON "public"."project_members" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



ALTER TABLE "public"."project_risks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_teams_delete" ON "public"."project_teams" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "project_teams_insert" ON "public"."project_teams" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "project_teams_select" ON "public"."project_teams" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "project_teams_update" ON "public"."project_teams" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_insert" ON "public"."projects" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'project:create'::"text"));



CREATE POLICY "projects_select" ON "public"."projects" FOR SELECT USING ("handoff"."can_view_project"("id"));



CREATE POLICY "projects_update" ON "public"."projects" FOR UPDATE USING ("handoff"."can_manage_project"("id")) WITH CHECK ("handoff"."can_manage_project"("id"));



CREATE POLICY "prs_delete" ON "public"."pull_requests" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "prs_insert" ON "public"."pull_requests" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "prs_select" ON "public"."pull_requests" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "prs_update" ON "public"."pull_requests" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text")) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."pull_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rel_appr_delete" ON "public"."release_approvals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."releases" "r"
  WHERE (("r"."id" = "release_approvals"."release_id") AND "handoff"."is_org_member"("r"."organization_id")))));



CREATE POLICY "rel_appr_insert" ON "public"."release_approvals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."releases" "r"
  WHERE (("r"."id" = "release_approvals"."release_id") AND "handoff"."is_org_member"("r"."organization_id")))));



CREATE POLICY "rel_appr_select" ON "public"."release_approvals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."releases" "r"
  WHERE (("r"."id" = "release_approvals"."release_id") AND "handoff"."can_view_project"("r"."project_id")))));



CREATE POLICY "rel_appr_update" ON "public"."release_approvals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."releases" "r"
  WHERE (("r"."id" = "release_approvals"."release_id") AND "handoff"."is_org_member"("r"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."releases" "r"
  WHERE (("r"."id" = "release_approvals"."release_id") AND "handoff"."is_org_member"("r"."organization_id")))));



ALTER TABLE "public"."release_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."releases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "releases_insert" ON "public"."releases" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'release:create'::"text"));



CREATE POLICY "releases_select" ON "public"."releases" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "releases_update" ON "public"."releases" FOR UPDATE USING (("handoff"."has_permission"("organization_id", 'release:create'::"text") OR "handoff"."has_permission"("organization_id", 'release:approve'::"text"))) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."report_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_exports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_exports_insert" ON "public"."report_exports" FOR INSERT WITH CHECK (("handoff"."has_permission"("organization_id", 'report:export'::"text") AND ("actor_member_id" = "handoff"."current_member_id"("organization_id"))));



CREATE POLICY "report_exports_select" ON "public"."report_exports" FOR SELECT USING (("handoff"."has_permission"("organization_id", 'report:export'::"text") OR "handoff"."has_permission"("organization_id", 'audit:view'::"text")));



ALTER TABLE "public"."report_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_schedules_manage" ON "public"."report_schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."reports" "r"
  WHERE (("r"."id" = "report_schedules"."report_id") AND "handoff"."has_permission"("r"."organization_id", 'report:schedule'::"text")))));



CREATE POLICY "report_schedules_select" ON "public"."report_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."reports" "r"
  WHERE (("r"."id" = "report_schedules"."report_id") AND "handoff"."has_permission"("r"."organization_id", 'report:view'::"text")))));



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_manage" ON "public"."reports" USING ("handoff"."has_permission"("organization_id", 'report:create'::"text"));



CREATE POLICY "reports_select" ON "public"."reports" FOR SELECT USING ("handoff"."has_permission"("organization_id", 'report:view'::"text"));



CREATE POLICY "repos_delete" ON "public"."repositories" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "repos_insert" ON "public"."repositories" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



CREATE POLICY "repos_select" ON "public"."repositories" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "repos_update" ON "public"."repositories" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'integration:manage'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'integration:manage'::"text"));



ALTER TABLE "public"."repositories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "risks_delete" ON "public"."project_risks" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "risks_insert" ON "public"."project_risks" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "risks_select" ON "public"."project_risks" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "risks_update" ON "public"."project_risks" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_delete" ON "public"."role_permissions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."roles" "r"
  WHERE (("r"."id" = "role_permissions"."role_id") AND ("r"."organization_id" IS NOT NULL) AND "handoff"."has_permission"("r"."organization_id", 'member:manage'::"text")))));



CREATE POLICY "role_permissions_insert" ON "public"."role_permissions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."roles" "r"
  WHERE (("r"."id" = "role_permissions"."role_id") AND ("r"."organization_id" IS NOT NULL) AND "handoff"."has_permission"("r"."organization_id", 'member:manage'::"text")))));



CREATE POLICY "role_permissions_select" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "role_permissions_update" ON "public"."role_permissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."roles" "r"
  WHERE (("r"."id" = "role_permissions"."role_id") AND ("r"."organization_id" IS NOT NULL) AND "handoff"."has_permission"("r"."organization_id", 'member:manage'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."roles" "r"
  WHERE (("r"."id" = "role_permissions"."role_id") AND ("r"."organization_id" IS NOT NULL) AND "handoff"."has_permission"("r"."organization_id", 'member:manage'::"text")))));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_delete" ON "public"."roles" FOR DELETE USING ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text")));



CREATE POLICY "roles_insert" ON "public"."roles" FOR INSERT WITH CHECK ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text")));



CREATE POLICY "roles_select" ON "public"."roles" FOR SELECT USING ((("organization_id" IS NULL) OR "handoff"."is_org_member"("organization_id")));



CREATE POLICY "roles_update" ON "public"."roles" FOR UPDATE USING ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text"))) WITH CHECK ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text")));



ALTER TABLE "public"."saved_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_views_delete" ON "public"."saved_views" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "saved_views"."owner_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "saved_views_insert" ON "public"."saved_views" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "saved_views"."owner_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "saved_views_select" ON "public"."saved_views" FOR SELECT USING (("handoff"."is_org_member"("organization_id") AND ("is_shared" OR (EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "saved_views"."owner_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "saved_views_update" ON "public"."saved_views" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "saved_views"."owner_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "m"
  WHERE (("m"."id" = "saved_views"."owner_member_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "sec_checks_delete" ON "public"."security_review_checks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."security_reviews" "sr"
  WHERE (("sr"."id" = "security_review_checks"."security_review_id") AND "handoff"."has_permission"("sr"."organization_id", 'security:review'::"text")))));



CREATE POLICY "sec_checks_insert" ON "public"."security_review_checks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."security_reviews" "sr"
  WHERE (("sr"."id" = "security_review_checks"."security_review_id") AND "handoff"."has_permission"("sr"."organization_id", 'security:review'::"text")))));



CREATE POLICY "sec_checks_select" ON "public"."security_review_checks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."security_reviews" "sr"
  WHERE (("sr"."id" = "security_review_checks"."security_review_id") AND "handoff"."can_view_project"("sr"."project_id")))));



CREATE POLICY "sec_checks_update" ON "public"."security_review_checks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."security_reviews" "sr"
  WHERE (("sr"."id" = "security_review_checks"."security_review_id") AND "handoff"."has_permission"("sr"."organization_id", 'security:review'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."security_reviews" "sr"
  WHERE (("sr"."id" = "security_review_checks"."security_review_id") AND "handoff"."has_permission"("sr"."organization_id", 'security:review'::"text")))));



CREATE POLICY "sec_findings_delete" ON "public"."security_findings" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'security:review'::"text"));



CREATE POLICY "sec_findings_insert" ON "public"."security_findings" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'security:review'::"text"));



CREATE POLICY "sec_findings_select" ON "public"."security_findings" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "sec_findings_update" ON "public"."security_findings" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'security:review'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'security:review'::"text"));



CREATE POLICY "sec_review_assignees_manage" ON "public"."security_review_assignees" USING ("handoff"."can_view_project"(( SELECT "security_reviews"."project_id"
   FROM "public"."security_reviews"
  WHERE ("security_reviews"."id" = "security_review_assignees"."security_review_id"))));



CREATE POLICY "sec_review_assignees_select" ON "public"."security_review_assignees" FOR SELECT USING ("handoff"."can_view_project"(( SELECT "security_reviews"."project_id"
   FROM "public"."security_reviews"
  WHERE ("security_reviews"."id" = "security_review_assignees"."security_review_id"))));



CREATE POLICY "sec_reviews_delete" ON "public"."security_reviews" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'security:review'::"text"));



CREATE POLICY "sec_reviews_insert" ON "public"."security_reviews" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'security:review'::"text"));



CREATE POLICY "sec_reviews_select" ON "public"."security_reviews" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "sec_reviews_update" ON "public"."security_reviews" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'security:review'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'security:review'::"text"));



ALTER TABLE "public"."security_findings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_review_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_review_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "skills_delete" ON "public"."skills" FOR DELETE USING ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text")));



CREATE POLICY "skills_insert" ON "public"."skills" FOR INSERT WITH CHECK ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text")));



CREATE POLICY "skills_select" ON "public"."skills" FOR SELECT USING ((("organization_id" IS NULL) OR "handoff"."is_org_member"("organization_id")));



CREATE POLICY "skills_update" ON "public"."skills" FOR UPDATE USING ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text"))) WITH CHECK ((("organization_id" IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'member:manage'::"text")));



ALTER TABLE "public"."sprints" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sprints_delete" ON "public"."sprints" FOR DELETE USING ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "sprints_insert" ON "public"."sprints" FOR INSERT WITH CHECK ("handoff"."can_manage_project"("project_id"));



CREATE POLICY "sprints_select" ON "public"."sprints" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "sprints_update" ON "public"."sprints" FOR UPDATE USING ("handoff"."can_manage_project"("project_id")) WITH CHECK ("handoff"."can_manage_project"("project_id"));



ALTER TABLE "public"."student_team_join_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_team_labels_select" ON "public"."student_team_member_labels" FOR SELECT USING ("handoff"."is_org_member"(( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."id" = "student_team_member_labels"."organization_member_id"))));



ALTER TABLE "public"."student_team_member_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_team_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_team_settings_select" ON "public"."student_team_settings" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "student_team_settings_update" ON "public"."student_team_settings" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'student_team:manage_settings'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'student_team:manage_settings'::"text"));



ALTER TABLE "public"."task_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_activity_insert" ON "public"."task_activity" FOR INSERT WITH CHECK ("handoff"."can_view_task"("task_id"));



CREATE POLICY "task_activity_select" ON "public"."task_activity" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



ALTER TABLE "public"."task_assignees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_assignees_delete" ON "public"."task_assignees" FOR DELETE USING ("handoff"."can_assign_task"("task_id"));



CREATE POLICY "task_assignees_insert" ON "public"."task_assignees" FOR INSERT WITH CHECK ("handoff"."can_assign_to"("task_id", "organization_member_id"));



CREATE POLICY "task_assignees_select" ON "public"."task_assignees" FOR SELECT USING ("handoff"."can_view_task_assignment_history"("task_id"));



CREATE POLICY "task_assignees_update" ON "public"."task_assignees" FOR UPDATE USING ("handoff"."can_assign_task"("task_id")) WITH CHECK ("handoff"."can_assign_to"("task_id", "organization_member_id"));



ALTER TABLE "public"."task_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_checklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_deps_delete" ON "public"."task_dependencies" FOR DELETE USING ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "task_deps_insert" ON "public"."task_dependencies" FOR INSERT WITH CHECK (("handoff"."can_edit_task"("task_id") AND "handoff"."can_view_task"("depends_on_task_id")));



CREATE POLICY "task_deps_select" ON "public"."task_dependencies" FOR SELECT USING (("handoff"."can_view_task"("task_id") AND "handoff"."can_view_task"("depends_on_task_id")));



CREATE POLICY "task_deps_update" ON "public"."task_dependencies" FOR UPDATE USING ("handoff"."can_edit_task"("task_id")) WITH CHECK (("handoff"."can_edit_task"("task_id") AND "handoff"."can_view_task"("depends_on_task_id")));



ALTER TABLE "public"."task_label_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_label_links_delete" ON "public"."task_label_links" FOR DELETE USING ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "task_label_links_insert" ON "public"."task_label_links" FOR INSERT WITH CHECK ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "task_label_links_select" ON "public"."task_label_links" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "task_label_links_update" ON "public"."task_label_links" FOR UPDATE USING ("handoff"."can_edit_task"("task_id")) WITH CHECK ("handoff"."can_edit_task"("task_id"));



ALTER TABLE "public"."task_labels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_labels_delete" ON "public"."task_labels" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'task:create'::"text"));



CREATE POLICY "task_labels_insert" ON "public"."task_labels" FOR INSERT WITH CHECK ("handoff"."has_permission"("organization_id", 'task:create'::"text"));



CREATE POLICY "task_labels_select" ON "public"."task_labels" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "task_labels_update" ON "public"."task_labels" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'task:create'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'task:create'::"text"));



ALTER TABLE "public"."task_visibility_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_visibility_members_delete" ON "public"."task_visibility_members" FOR DELETE USING ("handoff"."can_assign_task"("task_id"));



CREATE POLICY "task_visibility_members_insert" ON "public"."task_visibility_members" FOR INSERT WITH CHECK ("handoff"."can_assign_to"("task_id", "member_id"));



CREATE POLICY "task_visibility_members_select" ON "public"."task_visibility_members" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "task_visibility_members_update" ON "public"."task_visibility_members" FOR UPDATE USING ("handoff"."can_assign_task"("task_id")) WITH CHECK ("handoff"."can_assign_to"("task_id", "member_id"));



ALTER TABLE "public"."task_watchers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete" ON "public"."tasks" FOR DELETE USING ("handoff"."can_delete_task"("id"));



CREATE POLICY "tasks_insert" ON "public"."tasks" FOR INSERT WITH CHECK ("handoff"."can_create_task_with_visibility"("organization_id", "project_id", "visibility_scope"));



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT USING (((( SELECT "handoff"."current_member_id"("tasks"."organization_id") AS "current_member_id") IS NOT NULL) AND "handoff"."has_permission"("organization_id", 'task:view'::"text") AND ("handoff"."is_org_admin_or_owner"("organization_id") OR (COALESCE("visibility_scope", 'PRIVATE_ASSIGNMENT'::"text") = 'ORGANIZATION_VISIBLE'::"text") OR ((COALESCE("visibility_scope", 'PRIVATE_ASSIGNMENT'::"text") = 'PROJECT_SHARED'::"text") AND "handoff"."can_view_project"("project_id")) OR ("handoff"."current_member_id"("organization_id") = "reporter_member_id") OR ("handoff"."current_member_id"("organization_id") = "primary_assignee_member_id") OR (EXISTS ( SELECT 1
   FROM "public"."task_assignees" "ta"
  WHERE (("ta"."task_id" = "tasks"."id") AND ("ta"."organization_member_id" = "handoff"."current_member_id"("tasks"."organization_id")) AND ("ta"."removed_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."task_assignees" "ta"
  WHERE (("ta"."task_id" = "tasks"."id") AND (COALESCE("ta"."assigned_by_member_id", "ta"."assigned_by") = "handoff"."current_member_id"("tasks"."organization_id"))))) OR (EXISTS ( SELECT 1
   FROM "public"."task_visibility_members" "tvm"
  WHERE (("tvm"."task_id" = "tasks"."id") AND ("tvm"."member_id" = "handoff"."current_member_id"("tasks"."organization_id")) AND ("tvm"."revoked_at" IS NULL)))) OR "handoff"."is_project_responsible_manager"("project_id") OR ("handoff"."has_permission"("organization_id", 'task:view_team_assignments'::"text") AND "handoff"."manages_task_assignee"("id")))));



CREATE POLICY "tasks_update" ON "public"."tasks" FOR UPDATE USING ("handoff"."can_edit_task"("id")) WITH CHECK (("handoff"."can_edit_task"("id") AND "handoff"."can_set_task_visibility"("id", "visibility_scope")));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_delete" ON "public"."team_members" FOR DELETE USING ("handoff"."has_permission"("handoff"."team_org"("team_id"), 'team:manage_members'::"text"));



CREATE POLICY "team_members_insert" ON "public"."team_members" FOR INSERT WITH CHECK ("handoff"."has_permission"("handoff"."team_org"("team_id"), 'team:manage_members'::"text"));



CREATE POLICY "team_members_select" ON "public"."team_members" FOR SELECT USING ("handoff"."is_org_member"("handoff"."team_org"("team_id")));



CREATE POLICY "team_members_update" ON "public"."team_members" FOR UPDATE USING ("handoff"."has_permission"("handoff"."team_org"("team_id"), 'team:manage_members'::"text")) WITH CHECK ("handoff"."has_permission"("handoff"."team_org"("team_id"), 'team:manage_members'::"text"));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete" ON "public"."teams" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'team:update'::"text"));



CREATE POLICY "teams_insert" ON "public"."teams" FOR INSERT WITH CHECK ((("handoff"."has_permission"("organization_id", 'team:create'::"text") AND ("team_type" = 'ORGANIZATION_TEAM'::"text")) OR ("handoff"."has_permission"("organization_id", 'team:create_project_team'::"text") AND ("team_type" = 'PROJECT_TEAM'::"text"))));



CREATE POLICY "teams_select" ON "public"."teams" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "teams_update" ON "public"."teams" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'team:update'::"text")) WITH CHECK ("handoff"."has_permission"("organization_id", 'team:update'::"text"));



ALTER TABLE "public"."test_cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_cases_delete" ON "public"."test_cases" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."test_plans" "tp"
  WHERE (("tp"."id" = "test_cases"."test_plan_id") AND "handoff"."can_view_project"("tp"."project_id")))));



CREATE POLICY "test_cases_insert" ON "public"."test_cases" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_plans" "tp"
  WHERE (("tp"."id" = "test_cases"."test_plan_id") AND "handoff"."can_view_project"("tp"."project_id")))));



CREATE POLICY "test_cases_select" ON "public"."test_cases" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."test_plans" "tp"
  WHERE (("tp"."id" = "test_cases"."test_plan_id") AND "handoff"."can_view_project"("tp"."project_id")))));



CREATE POLICY "test_cases_update" ON "public"."test_cases" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."test_plans" "tp"
  WHERE (("tp"."id" = "test_cases"."test_plan_id") AND "handoff"."can_view_project"("tp"."project_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_plans" "tp"
  WHERE (("tp"."id" = "test_cases"."test_plan_id") AND "handoff"."can_view_project"("tp"."project_id")))));



ALTER TABLE "public"."test_plan_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_plan_assignments_manage" ON "public"."test_plan_assignments" USING ("handoff"."can_view_project"(( SELECT "test_plans"."project_id"
   FROM "public"."test_plans"
  WHERE ("test_plans"."id" = "test_plan_assignments"."test_plan_id"))));



CREATE POLICY "test_plan_assignments_select" ON "public"."test_plan_assignments" FOR SELECT USING ("handoff"."can_view_project"(( SELECT "test_plans"."project_id"
   FROM "public"."test_plans"
  WHERE ("test_plans"."id" = "test_plan_assignments"."test_plan_id"))));



ALTER TABLE "public"."test_plan_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_plan_tasks_manage" ON "public"."test_plan_tasks" USING ("handoff"."can_view_project"(( SELECT "test_plans"."project_id"
   FROM "public"."test_plans"
  WHERE ("test_plans"."id" = "test_plan_tasks"."test_plan_id"))));



CREATE POLICY "test_plan_tasks_select" ON "public"."test_plan_tasks" FOR SELECT USING ("handoff"."can_view_project"(( SELECT "test_plans"."project_id"
   FROM "public"."test_plans"
  WHERE ("test_plans"."id" = "test_plan_tasks"."test_plan_id"))));



ALTER TABLE "public"."test_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_plans_delete" ON "public"."test_plans" FOR DELETE USING (("handoff"."can_view_project"("project_id") AND "handoff"."has_permission"("organization_id", 'task:update'::"text")));



CREATE POLICY "test_plans_insert" ON "public"."test_plans" FOR INSERT WITH CHECK ("handoff"."can_view_project"("project_id"));



CREATE POLICY "test_plans_select" ON "public"."test_plans" FOR SELECT USING ("handoff"."can_view_project"("project_id"));



CREATE POLICY "test_plans_update" ON "public"."test_plans" FOR UPDATE USING (("handoff"."can_view_project"("project_id") AND "handoff"."has_permission"("organization_id", 'task:update'::"text"))) WITH CHECK ("handoff"."can_view_project"("project_id"));



CREATE POLICY "test_results_delete" ON "public"."test_run_results" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."test_runs" "tr"
  WHERE (("tr"."id" = "test_run_results"."test_run_id") AND "handoff"."has_permission"("tr"."organization_id", 'task:update'::"text")))));



CREATE POLICY "test_results_insert" ON "public"."test_run_results" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_runs" "tr"
  WHERE (("tr"."id" = "test_run_results"."test_run_id") AND "handoff"."is_org_member"("tr"."organization_id")))));



CREATE POLICY "test_results_select" ON "public"."test_run_results" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."test_runs" "tr"
  WHERE (("tr"."id" = "test_run_results"."test_run_id") AND "handoff"."is_org_member"("tr"."organization_id")))));



CREATE POLICY "test_results_update" ON "public"."test_run_results" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."test_runs" "tr"
  WHERE (("tr"."id" = "test_run_results"."test_run_id") AND "handoff"."has_permission"("tr"."organization_id", 'task:update'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_runs" "tr"
  WHERE (("tr"."id" = "test_run_results"."test_run_id") AND "handoff"."is_org_member"("tr"."organization_id")))));



ALTER TABLE "public"."test_run_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_runs_delete" ON "public"."test_runs" FOR DELETE USING ("handoff"."has_permission"("organization_id", 'task:update'::"text"));



CREATE POLICY "test_runs_insert" ON "public"."test_runs" FOR INSERT WITH CHECK ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "test_runs_select" ON "public"."test_runs" FOR SELECT USING ("handoff"."is_org_member"("organization_id"));



CREATE POLICY "test_runs_update" ON "public"."test_runs" FOR UPDATE USING ("handoff"."has_permission"("organization_id", 'task:update'::"text")) WITH CHECK ("handoff"."is_org_member"("organization_id"));



ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_entries_delete" ON "public"."time_entries" FOR DELETE USING ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "time_entries_insert" ON "public"."time_entries" FOR INSERT WITH CHECK ("handoff"."can_edit_task"("task_id"));



CREATE POLICY "time_entries_select" ON "public"."time_entries" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "time_entries_update" ON "public"."time_entries" FOR UPDATE USING ("handoff"."can_edit_task"("task_id")) WITH CHECK ("handoff"."can_edit_task"("task_id"));



ALTER TABLE "public"."user_legal_acceptances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watchers_delete" ON "public"."task_watchers" FOR DELETE USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "watchers_insert" ON "public"."task_watchers" FOR INSERT WITH CHECK ("handoff"."can_view_task"("task_id"));



CREATE POLICY "watchers_select" ON "public"."task_watchers" FOR SELECT USING ("handoff"."can_view_task"("task_id"));



CREATE POLICY "watchers_update" ON "public"."task_watchers" FOR UPDATE USING ("handoff"."can_view_task"("task_id")) WITH CHECK ("handoff"."can_view_task"("task_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."approval_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."deployments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."incident_timeline_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."incidents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."project_deadlines";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."release_approvals";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."releases";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."report_exports";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_activity";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_assignees";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_visibility_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_invite"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token_hash" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_epic_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_epic_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_epic_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_project_deadline_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_project_deadline_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_project_deadline_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_project_member_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_project_member_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_project_member_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_project_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_project_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_project_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_sprint_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_sprint_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_sprint_tenant"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_task_assignee_tenant"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_task_assignee_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_task_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_task_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_task_tenant"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_task_visibility_member_tenant"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_task_visibility_member_tenant"() TO "service_role";



GRANT ALL ON TABLE "public"."bugs" TO "anon";
GRANT ALL ON TABLE "public"."bugs" TO "authenticated";
GRANT ALL ON TABLE "public"."bugs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_bug"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_bug"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_bug"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notification"("p_org" "uuid", "p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notification"("p_org" "uuid", "p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_notification"("p_org" "uuid", "p_recipient" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_metadata" "jsonb") TO "authenticated";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_organization"("p_user_id" "uuid", "p_name" "text", "p_slug" "text", "p_industry" "text", "p_company_size" "text", "p_timezone" "text", "p_description" "text", "p_job_family" "text", "p_job_title" "text", "p_professional_specialization" "text", "p_manager_type" "text", "p_job_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_organization"("p_user_id" "uuid", "p_name" "text", "p_slug" "text", "p_industry" "text", "p_company_size" "text", "p_timezone" "text", "p_description" "text", "p_job_family" "text", "p_job_title" "text", "p_professional_specialization" "text", "p_manager_type" "text", "p_job_description" "text") TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_project"("p_org" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_project"("p_org" "uuid", "p_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_project"("p_org" "uuid", "p_payload" "jsonb") TO "authenticated";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_project_team"("p_project_id" "uuid", "p_team_name" "text", "p_team_code" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_project_team"("p_project_id" "uuid", "p_team_name" "text", "p_team_code" "text", "p_description" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_project_team"("p_project_id" "uuid", "p_team_name" "text", "p_team_code" "text", "p_description" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_student_solo_workspace"("p_user_id" "uuid", "p_name" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_student_solo_workspace"("p_user_id" "uuid", "p_name" "text", "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_student_team"("p_user_id" "uuid", "p_name" "text", "p_event_name" "text", "p_short_description" "text", "p_expected_team_size" integer, "p_max_team_size" integer, "p_primary_team_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_student_team"("p_user_id" "uuid", "p_name" "text", "p_event_name" "text", "p_short_description" "text", "p_expected_team_size" integer, "p_max_team_size" integer, "p_primary_team_role" "text") TO "service_role";



GRANT ALL ON TABLE "public"."test_plans" TO "anon";
GRANT ALL ON TABLE "public"."test_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."test_plans" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_test_plan"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_test_plan"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_test_plan"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_active_sessions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_sessions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_invite"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_invite"("p_token_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_invite"("p_token_hash" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_join_code_status"("p_org" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_join_code_status"("p_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_join_code_status"("p_org" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."member_permissions"("p_member" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."member_permissions"("p_member" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."member_permissions"("p_member" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."preview_join_code"("p_raw_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_join_code"("p_raw_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."user_legal_acceptances" TO "anon";
GRANT ALL ON TABLE "public"."user_legal_acceptances" TO "authenticated";
GRANT ALL ON TABLE "public"."user_legal_acceptances" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_legal_acceptance"("p_terms_document_id" "uuid", "p_privacy_document_id" "uuid", "p_cookies_document_id" "uuid", "p_acceptance_source" "text", "p_request_id" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_legal_acceptance"("p_terms_document_id" "uuid", "p_privacy_document_id" "uuid", "p_cookies_document_id" "uuid", "p_acceptance_source" "text", "p_request_id" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_legal_acceptance"("p_terms_document_id" "uuid", "p_privacy_document_id" "uuid", "p_cookies_document_id" "uuid", "p_acceptance_source" "text", "p_request_id" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_student_team_join_code"("p_user_id" "uuid", "p_raw_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_student_team_join_code"("p_user_id" "uuid", "p_raw_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_can_deploy"("p_release" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_can_deploy"("p_release" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."release_can_deploy"("p_release" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."revoke_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_session"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_session"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rotate_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rotate_join_code"("p_org" "uuid", "p_caller_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."security_reviews" TO "anon";
GRANT ALL ON TABLE "public"."security_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."security_reviews" TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_security_review"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_security_review"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_security_review"("p_organization_id" "uuid", "p_project_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_task_assignee_access_fields"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_task_assignee_access_fields"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfer_team_leadership"("p_org" "uuid", "p_from_user_id" "uuid", "p_to_member_id" "uuid", "p_demote_to" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_team_leadership"("p_org" "uuid", "p_from_user_id" "uuid", "p_to_member_id" "uuid", "p_demote_to" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."write_audit_log"("p_org" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_before" "jsonb", "p_after" "jsonb", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."write_audit_log"("p_org" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_project_id" "uuid", "p_before" "jsonb", "p_after" "jsonb", "p_metadata" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."ai_requests" TO "anon";
GRANT ALL ON TABLE "public"."ai_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_requests" TO "service_role";



GRANT ALL ON TABLE "public"."ai_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_settings" TO "service_role";



GRANT ALL ON TABLE "public"."ai_sources" TO "anon";
GRANT ALL ON TABLE "public"."ai_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_sources" TO "service_role";



GRANT ALL ON TABLE "public"."approval_requests" TO "anon";
GRANT ALL ON TABLE "public"."approval_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_requests" TO "service_role";



GRANT ALL ON TABLE "public"."approvals" TO "anon";
GRANT ALL ON TABLE "public"."approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."approvals" TO "service_role";



GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bug_activity" TO "anon";
GRANT ALL ON TABLE "public"."bug_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."bug_activity" TO "service_role";



GRANT ALL ON TABLE "public"."bug_assignees" TO "anon";
GRANT ALL ON TABLE "public"."bug_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."bug_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."bug_attachments" TO "anon";
GRANT ALL ON TABLE "public"."bug_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."bug_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."ci_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ci_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ci_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."ci_pipelines" TO "anon";
GRANT ALL ON TABLE "public"."ci_pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."ci_pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."comment_mentions" TO "anon";
GRANT ALL ON TABLE "public"."comment_mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_mentions" TO "service_role";



GRANT ALL ON TABLE "public"."commits" TO "anon";
GRANT ALL ON TABLE "public"."commits" TO "authenticated";
GRANT ALL ON TABLE "public"."commits" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_controls" TO "anon";
GRANT ALL ON TABLE "public"."compliance_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_controls" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_evidence" TO "anon";
GRANT ALL ON TABLE "public"."compliance_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."demo_sessions" TO "anon";
GRANT ALL ON TABLE "public"."demo_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."deployment_logs" TO "anon";
GRANT ALL ON TABLE "public"."deployment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."deployment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."deployments" TO "anon";
GRANT ALL ON TABLE "public"."deployments" TO "authenticated";
GRANT ALL ON TABLE "public"."deployments" TO "service_role";



GRANT ALL ON TABLE "public"."document_comments" TO "anon";
GRANT ALL ON TABLE "public"."document_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."document_comments" TO "service_role";



GRANT ALL ON TABLE "public"."document_links" TO "anon";
GRANT ALL ON TABLE "public"."document_links" TO "authenticated";
GRANT ALL ON TABLE "public"."document_links" TO "service_role";



GRANT ALL ON TABLE "public"."document_versions" TO "anon";
GRANT ALL ON TABLE "public"."document_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."document_versions" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."employee_availability" TO "anon";
GRANT ALL ON TABLE "public"."employee_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_availability" TO "service_role";



GRANT ALL ON TABLE "public"."employee_skills" TO "anon";
GRANT ALL ON TABLE "public"."employee_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_skills" TO "service_role";



GRANT ALL ON TABLE "public"."environments" TO "anon";
GRANT ALL ON TABLE "public"."environments" TO "authenticated";
GRANT ALL ON TABLE "public"."environments" TO "service_role";



GRANT ALL ON TABLE "public"."epics" TO "anon";
GRANT ALL ON TABLE "public"."epics" TO "authenticated";
GRANT ALL ON TABLE "public"."epics" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."import_rows" TO "anon";
GRANT ALL ON TABLE "public"."import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."incident_followups" TO "anon";
GRANT ALL ON TABLE "public"."incident_followups" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_followups" TO "service_role";



GRANT ALL ON TABLE "public"."incident_participants" TO "anon";
GRANT ALL ON TABLE "public"."incident_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_participants" TO "service_role";



GRANT ALL ON TABLE "public"."incident_timeline_events" TO "anon";
GRANT ALL ON TABLE "public"."incident_timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_timeline_events" TO "service_role";



GRANT ALL ON TABLE "public"."incidents" TO "anon";
GRANT ALL ON TABLE "public"."incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."incidents" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("organization_id") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("provider") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("display_name") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("config") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."integrations" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."integrations" TO "authenticated";



GRANT ALL ON TABLE "public"."leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."legal_documents" TO "anon";
GRANT ALL ON TABLE "public"."legal_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_documents" TO "service_role";



GRANT ALL ON TABLE "public"."member_roles" TO "anon";
GRANT ALL ON TABLE "public"."member_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."member_roles" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."org_task_counters" TO "anon";
GRANT ALL ON TABLE "public"."org_task_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."org_task_counters" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invite_roles" TO "anon";
GRANT ALL ON TABLE "public"."organization_invite_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invite_roles" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invites" TO "anon";
GRANT ALL ON TABLE "public"."organization_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invites" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."portfolios" TO "anon";
GRANT ALL ON TABLE "public"."portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolios" TO "service_role";



GRANT ALL ON TABLE "public"."postmortems" TO "anon";
GRANT ALL ON TABLE "public"."postmortems" TO "authenticated";
GRANT ALL ON TABLE "public"."postmortems" TO "service_role";



GRANT ALL ON TABLE "public"."presence_sessions" TO "anon";
GRANT ALL ON TABLE "public"."presence_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."presence_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON TABLE "public"."project_activity" TO "anon";
GRANT ALL ON TABLE "public"."project_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."project_activity" TO "service_role";



GRANT ALL ON TABLE "public"."project_deadlines" TO "anon";
GRANT ALL ON TABLE "public"."project_deadlines" TO "authenticated";
GRANT ALL ON TABLE "public"."project_deadlines" TO "service_role";



GRANT ALL ON TABLE "public"."project_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."project_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."project_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."project_members" TO "anon";
GRANT ALL ON TABLE "public"."project_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_members" TO "service_role";



GRANT ALL ON TABLE "public"."project_risks" TO "anon";
GRANT ALL ON TABLE "public"."project_risks" TO "authenticated";
GRANT ALL ON TABLE "public"."project_risks" TO "service_role";



GRANT ALL ON TABLE "public"."project_teams" TO "anon";
GRANT ALL ON TABLE "public"."project_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."project_teams" TO "service_role";



GRANT ALL ON TABLE "public"."pull_requests" TO "anon";
GRANT ALL ON TABLE "public"."pull_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."pull_requests" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."release_approvals" TO "anon";
GRANT ALL ON TABLE "public"."release_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."release_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."releases" TO "anon";
GRANT ALL ON TABLE "public"."releases" TO "authenticated";
GRANT ALL ON TABLE "public"."releases" TO "service_role";



GRANT ALL ON TABLE "public"."report_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."report_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."report_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."report_exports" TO "anon";
GRANT ALL ON TABLE "public"."report_exports" TO "authenticated";
GRANT ALL ON TABLE "public"."report_exports" TO "service_role";



GRANT ALL ON TABLE "public"."report_runs" TO "anon";
GRANT ALL ON TABLE "public"."report_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."report_runs" TO "service_role";



GRANT ALL ON TABLE "public"."report_schedules" TO "anon";
GRANT ALL ON TABLE "public"."report_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."report_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."repositories" TO "anon";
GRANT ALL ON TABLE "public"."repositories" TO "authenticated";
GRANT ALL ON TABLE "public"."repositories" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."saved_views" TO "anon";
GRANT ALL ON TABLE "public"."saved_views" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_views" TO "service_role";



GRANT ALL ON TABLE "public"."security_findings" TO "anon";
GRANT ALL ON TABLE "public"."security_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."security_findings" TO "service_role";



GRANT ALL ON TABLE "public"."security_review_assignees" TO "anon";
GRANT ALL ON TABLE "public"."security_review_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."security_review_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."security_review_checks" TO "anon";
GRANT ALL ON TABLE "public"."security_review_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."security_review_checks" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."sprints" TO "anon";
GRANT ALL ON TABLE "public"."sprints" TO "authenticated";
GRANT ALL ON TABLE "public"."sprints" TO "service_role";



GRANT ALL ON TABLE "public"."student_team_join_codes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_team_member_labels" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_team_member_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."student_team_member_labels" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."student_team_settings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."student_team_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."student_team_settings" TO "service_role";



GRANT ALL ON TABLE "public"."task_activity" TO "anon";
GRANT ALL ON TABLE "public"."task_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."task_activity" TO "service_role";



GRANT ALL ON TABLE "public"."task_assignees" TO "anon";
GRANT ALL ON TABLE "public"."task_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."task_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."task_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."task_checklists" TO "anon";
GRANT ALL ON TABLE "public"."task_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."task_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."task_comments" TO "anon";
GRANT ALL ON TABLE "public"."task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."task_label_links" TO "anon";
GRANT ALL ON TABLE "public"."task_label_links" TO "authenticated";
GRANT ALL ON TABLE "public"."task_label_links" TO "service_role";



GRANT ALL ON TABLE "public"."task_labels" TO "anon";
GRANT ALL ON TABLE "public"."task_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."task_labels" TO "service_role";



GRANT ALL ON TABLE "public"."task_visibility_members" TO "anon";
GRANT ALL ON TABLE "public"."task_visibility_members" TO "authenticated";
GRANT ALL ON TABLE "public"."task_visibility_members" TO "service_role";



GRANT ALL ON TABLE "public"."task_watchers" TO "anon";
GRANT ALL ON TABLE "public"."task_watchers" TO "authenticated";
GRANT ALL ON TABLE "public"."task_watchers" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."test_cases" TO "anon";
GRANT ALL ON TABLE "public"."test_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."test_cases" TO "service_role";



GRANT ALL ON TABLE "public"."test_plan_assignments" TO "anon";
GRANT ALL ON TABLE "public"."test_plan_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."test_plan_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."test_plan_tasks" TO "anon";
GRANT ALL ON TABLE "public"."test_plan_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."test_plan_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."test_run_results" TO "anon";
GRANT ALL ON TABLE "public"."test_run_results" TO "authenticated";
GRANT ALL ON TABLE "public"."test_run_results" TO "service_role";



GRANT ALL ON TABLE "public"."test_runs" TO "anon";
GRANT ALL ON TABLE "public"."test_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."test_runs" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































