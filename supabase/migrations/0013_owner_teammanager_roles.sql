-- ============================================================================
-- Handoff — 0013 ORG_OWNER + TEAM_MANAGER roles, qa permissions
-- ============================================================================

-- ---------------------------------------------------------------- perms ------
insert into public.permissions (code, description) values
  ('qa:view','View QA test plans/results'),
  ('qa:update','Create/update QA test plans, runs, bugs')
on conflict (code) do nothing;

-- ---------------------------------------------------------------- roles ------
insert into public.roles (organization_id, code, name, is_system, description) values
  (null,'ORG_OWNER','Organization Owner',true,'Highest authority in a company'),
  (null,'TEAM_MANAGER','Team Manager',true,'Manages assigned teams and their work')
on conflict (code) where organization_id is null do nothing;

-- ----------------------------------------------------------------------------
-- Treat ORG_OWNER as full-access (alongside SUPER_ADMIN / ORG_ADMIN) in the
-- permission helpers.
-- ----------------------------------------------------------------------------
create or replace function handoff.has_permission(p_org uuid, p_perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.member_roles mr on mr.organization_member_id = m.id
    join public.roles r on r.id = mr.role_id
    left join public.role_permissions rp on rp.role_id = r.id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.is_active
      and (
        r.code in ('SUPER_ADMIN','ORG_ADMIN','ORG_OWNER')
        or rp.permission_code = p_perm
      )
  );
$$;

create or replace function public.member_permissions(p_member uuid)
returns table (permission_code text)
language sql stable security definer set search_path = public
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
      and r.code in ('SUPER_ADMIN','ORG_ADMIN','ORG_OWNER')
  )
  union
  select distinct rp.permission_code
  from m
  join public.member_roles mr on mr.organization_member_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id;
$$;
grant execute on function public.member_permissions(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Permission mappings
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  -- ORG_OWNER: every permission (explicit, in addition to admin bypass)
  for r in select id from public.roles where code='ORG_OWNER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    on conflict do nothing;
  end loop;

  -- TEAM_MANAGER: team-scoped management + can assign within team + QA view
  for r in select id from public.roles where code='TEAM_MANAGER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','team:update','team:manage_members',
      'project:view','task:view','task:create','task:update','task:assign','task:bulk_update',
      'sprint:view','sprint:create','sprint:update','sprint:start','sprint:complete',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','document:update',
      'approval:view','release:view','qa:view','analytics:view','ai:use','integration:view')
    on conflict do nothing;
  end loop;

  -- Grant qa:view/qa:update to QA + manager/PM roles
  for r in select id from public.roles where code='QA_ENGINEER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    values (r.id,'qa:view'),(r.id,'qa:update') on conflict do nothing;
  end loop;
  for r in select id from public.roles
           where code in ('PROJECT_MANAGER','ENGINEERING_MANAGER','TEAM_LEAD') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    values (r.id,'qa:view'),(r.id,'qa:update') on conflict do nothing;
  end loop;
  for r in select id from public.roles
           where code in ('DEVELOPER','SECURITY_ENGINEER','AUDITOR','CEO','CTO') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    values (r.id,'qa:view') on conflict do nothing;
  end loop;
end $$;
