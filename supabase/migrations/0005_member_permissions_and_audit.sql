-- ============================================================================
-- Handoff — 0005 member_permissions RPC + audit_logs foundation
-- ============================================================================

-- Flat permission list for a member (admins get all). Used for UI gating.
create or replace function public.member_permissions(p_member uuid)
returns table (permission_code text)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select * from public.organization_members where id = p_member and user_id = auth.uid()
  )
  select distinct p.code
  from m
  cross join public.permissions p
  where exists (
    select 1
    from public.member_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.organization_member_id = m.id
      and r.code in ('SUPER_ADMIN','ORG_ADMIN')
  )
  union
  select distinct rp.permission_code
  from m
  join public.member_roles mr on mr.organization_member_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id;
$$;
grant execute on function public.member_permissions(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- audit_logs (append-only; never editable from the client)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_member_id uuid references public.organization_members(id) on delete set null,
  action          text not null,
  resource_type   text not null,
  resource_id     uuid,
  project_id      uuid,
  old_value       jsonb,
  new_value       jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index if not exists audit_logs_org_idx     on public.audit_logs(organization_id, created_at desc);
create index if not exists audit_logs_project_idx on public.audit_logs(project_id);

alter table public.audit_logs enable row level security;

-- Auditors / admins may read; nobody may update or delete via the API.
create policy audit_logs_select on public.audit_logs
  for select using (handoff.has_permission(organization_id, 'audit:view'));

-- Inserts happen through the SECURITY DEFINER helper below, so no insert policy
-- is granted to ordinary roles.

create or replace function public.write_audit_log(
  p_org uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_project_id uuid default null,
  p_old jsonb default null,
  p_new jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  select id into v_actor from public.organization_members
   where organization_id = p_org and user_id = auth.uid() and is_active limit 1;

  insert into public.audit_logs (
    organization_id, actor_member_id, action, resource_type, resource_id,
    project_id, old_value, new_value, metadata)
  values (
    p_org, v_actor, p_action, p_resource_type, p_resource_id,
    p_project_id, p_old, p_new, coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.write_audit_log(uuid,text,text,uuid,uuid,jsonb,jsonb,jsonb) to authenticated;
