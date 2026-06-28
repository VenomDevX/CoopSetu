-- ============================================================================
-- Handoff — 0025 create_project RPC
-- ============================================================================
-- Bug: creating a project via PostgREST always failed with
--   "new row violates row-level security policy for table projects"
-- even for fully-authorized ORG_ADMIN/ORG_OWNER users.
--
-- Root cause: PostgREST issues `INSERT ... RETURNING projects.*`. The RETURNING
-- rows are re-checked against the SELECT policy `projects_select` →
-- `handoff.can_view_project(id)`, which does `select organization_id from
-- public.projects where id = p_project`. The just-inserted row is not yet
-- visible to that sub-select's snapshot, so `can_view_project` returns false and
-- the whole statement is rejected — despite the INSERT WITH CHECK
-- (`has_permission(org,'project:create')`) passing.
--
-- Fix: insert through a SECURITY DEFINER RPC (same pattern as
-- `create_organization` / `create_project_team`). The function enforces the
-- `project:create` permission itself, then inserts and returns the row without
-- the PostgREST RETURNING→SELECT-policy round-trip.
-- ============================================================================

create or replace function public.create_project(p_org uuid, p_payload jsonb)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_proj public.projects;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not handoff.has_permission(p_org, 'project:create') then
    raise exception 'FORBIDDEN: project:create' using errcode = '42501';
  end if;

  insert into public.projects (
    organization_id, name, code, description, business_objective, scope,
    portfolio_id, program_id, owner_member_id, project_manager_member_id,
    status, priority, security_classification,
    start_date, target_end_date, budget_amount, effort_estimate_hours
  ) values (
    p_org,
    p_payload->>'name',
    p_payload->>'code',
    nullif(p_payload->>'description', ''),
    nullif(p_payload->>'business_objective', ''),
    nullif(p_payload->>'scope', ''),
    (p_payload->>'portfolio_id')::uuid,
    (p_payload->>'program_id')::uuid,
    (p_payload->>'owner_member_id')::uuid,
    (p_payload->>'project_manager_member_id')::uuid,
    coalesce(nullif(p_payload->>'status', ''), 'PLANNING'),
    coalesce(nullif(p_payload->>'priority', ''), 'MEDIUM'),
    coalesce(nullif(p_payload->>'security_classification', ''), 'INTERNAL'),
    (p_payload->>'start_date')::date,
    (p_payload->>'target_end_date')::date,
    (p_payload->>'budget_amount')::numeric,
    (p_payload->>'effort_estimate_hours')::numeric
  )
  returning * into v_proj;

  return v_proj;
end;
$$;

grant execute on function public.create_project(uuid, jsonb) to authenticated;
