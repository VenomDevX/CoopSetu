-- ============================================================================
-- Handoff — 0004 RLS policies for foundation tables + create_organization RPC
-- ============================================================================

alter table public.profiles             enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.roles                 enable row level security;
alter table public.permissions           enable row level security;
alter table public.role_permissions      enable row level security;
alter table public.member_roles          enable row level security;
alter table public.organization_invites  enable row level security;

-- ---------------------------------------------------------------- profiles ---
create policy profiles_select_self on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members them
        on them.organization_id = me.organization_id
      where me.user_id = auth.uid() and me.is_active
        and them.user_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------- organizations ---
create policy organizations_select on public.organizations
  for select using (handoff.is_org_member(id));
create policy organizations_insert on public.organizations
  for insert with check (created_by = auth.uid());
create policy organizations_update on public.organizations
  for update using (handoff.has_permission(id, 'organization:manage'))
  with check (handoff.has_permission(id, 'organization:manage'));

-- ---------------------------------------------------- organization_members ---
create policy org_members_select on public.organization_members
  for select using (handoff.is_org_member(organization_id));
create policy org_members_insert on public.organization_members
  for insert with check (handoff.has_permission(organization_id, 'member:manage'));
create policy org_members_update on public.organization_members
  for update using (handoff.has_permission(organization_id, 'member:manage'))
  with check (handoff.has_permission(organization_id, 'member:manage'));

-- -------------------------------------------------------------------- roles ---
create policy roles_select on public.roles
  for select using (
    organization_id is null or handoff.is_org_member(organization_id)
  );
create policy roles_manage on public.roles
  for all using (
    organization_id is not null and handoff.has_permission(organization_id, 'member:manage')
  ) with check (
    organization_id is not null and handoff.has_permission(organization_id, 'member:manage')
  );

-- -------------------------------------------------------------- permissions ---
create policy permissions_select on public.permissions
  for select using (auth.role() = 'authenticated');

-- --------------------------------------------------------- role_permissions ---
create policy role_permissions_select on public.role_permissions
  for select using (auth.role() = 'authenticated');

-- ------------------------------------------------------------- member_roles ---
create policy member_roles_select on public.member_roles
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.id = member_roles.organization_member_id
        and handoff.is_org_member(m.organization_id)
    )
  );
create policy member_roles_manage on public.member_roles
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.id = member_roles.organization_member_id
        and handoff.has_permission(m.organization_id, 'member:manage')
    )
  ) with check (
    exists (
      select 1 from public.organization_members m
      where m.id = member_roles.organization_member_id
        and handoff.has_permission(m.organization_id, 'member:manage')
    )
  );

-- ------------------------------------------------------ organization_invites ---
create policy invites_select on public.organization_invites
  for select using (handoff.has_permission(organization_id, 'member:invite'));
create policy invites_manage on public.organization_invites
  for all using (handoff.has_permission(organization_id, 'member:invite'))
  with check (handoff.has_permission(organization_id, 'member:invite'));

-- ============================================================================
-- create_organization: atomically create org + owner member + ORG_ADMIN role.
-- SECURITY DEFINER so the bootstrap rows can be written before the caller has
-- any membership/permissions.
-- ============================================================================
create or replace function public.create_organization(
  p_name text,
  p_slug text default null,
  p_industry text default null,
  p_timezone text default 'UTC'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_org     public.organizations;
  v_member  public.organization_members;
  v_role_id uuid;
  v_slug    text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_slug := coalesce(nullif(p_slug,''),
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,6));

  insert into public.organizations (name, slug, industry, timezone, created_by)
  values (p_name, v_slug, p_industry, coalesce(p_timezone,'UTC'), v_uid)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_org.id, v_uid, 'ACTIVE', true)
  returning * into v_member;

  select id into v_role_id from public.roles where code = 'ORG_ADMIN' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id)
  values (v_member.id, v_role_id);

  return v_org;
end;
$$;

grant execute on function public.create_organization(text,text,text,text) to authenticated;
