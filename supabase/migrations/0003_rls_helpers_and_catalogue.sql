-- ============================================================================
-- Handoff — 0003 RLS helper functions, auth trigger, role/permission catalogue
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions used inside RLS policies.
-- SECURITY DEFINER so they bypass RLS on the tables they read (prevents the
-- infinite-recursion problem of policies that reference their own table).
-- ----------------------------------------------------------------------------

-- Returns the organization_member.id for the current user in a given org.
create or replace function handoff.current_member_id(p_org uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.organization_members m
  where m.organization_id = p_org
    and m.user_id = auth.uid()
    and m.is_active
  limit 1;
$$;

-- Is the current user an active member of the org?
create or replace function handoff.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.is_active
  );
$$;

-- Does the current user hold a given permission in the org?
-- ORG_ADMIN / SUPER_ADMIN implicitly hold every permission.
create or replace function handoff.has_permission(p_org uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
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
        r.code in ('SUPER_ADMIN','ORG_ADMIN')
        or rp.permission_code = p_perm
      )
  );
$$;

-- Does the current user hold any of the given role codes in the org?
create or replace function handoff.has_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.member_roles mr on mr.organization_member_id = m.id
    join public.roles r on r.id = mr.role_id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.is_active
      and r.code = any(p_roles)
  );
$$;

-- ----------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user is created.
-- ----------------------------------------------------------------------------
create or replace function handoff.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handoff.handle_new_user();

-- ----------------------------------------------------------------------------
-- Permission catalogue
-- ----------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('organization:view','View organization'),
  ('organization:manage','Manage organization settings'),
  ('member:view','View members'),
  ('member:invite','Invite members'),
  ('member:manage','Manage members'),
  ('team:view','View teams'),
  ('team:create','Create teams'),
  ('team:update','Update teams'),
  ('team:manage_members','Manage team members'),
  ('project:view','View projects'),
  ('project:create','Create projects'),
  ('project:update','Update projects'),
  ('project:archive','Archive projects'),
  ('project:manage_members','Manage project members'),
  ('task:view','View tasks'),
  ('task:create','Create tasks'),
  ('task:update','Update tasks'),
  ('task:assign','Assign tasks'),
  ('task:delete','Delete tasks'),
  ('task:bulk_update','Bulk update tasks'),
  ('sprint:view','View sprints'),
  ('sprint:create','Create sprints'),
  ('sprint:update','Update sprints'),
  ('sprint:start','Start sprints'),
  ('sprint:complete','Complete sprints'),
  ('comment:create','Create comments'),
  ('comment:update_own','Update own comments'),
  ('comment:delete_own','Delete own comments'),
  ('document:view','View documents'),
  ('document:create','Create documents'),
  ('document:update','Update documents'),
  ('document:approve','Approve documents'),
  ('approval:view','View approvals'),
  ('approval:create','Create approvals'),
  ('approval:decide','Decide approvals'),
  ('release:view','View releases'),
  ('release:create','Create releases'),
  ('release:approve','Approve releases'),
  ('release:deploy','Deploy releases'),
  ('security:view','View security'),
  ('security:review','Perform security review'),
  ('security:approve','Approve security'),
  ('audit:view','View audit logs'),
  ('analytics:view','View analytics'),
  ('ai:use','Use AI features'),
  ('integration:view','View integrations'),
  ('integration:manage','Manage integrations')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- System roles
-- ----------------------------------------------------------------------------
insert into public.roles (organization_id, code, name, is_system, description) values
  (null,'SUPER_ADMIN','Super Admin',true,'Full platform access'),
  (null,'ORG_ADMIN','Organization Admin',true,'Full organization access'),
  (null,'CEO','CEO',true,'Executive'),
  (null,'CTO','CTO',true,'Executive'),
  (null,'PROJECT_MANAGER','Project Manager',true,'Manages projects and work'),
  (null,'ENGINEERING_MANAGER','Engineering Manager',true,'Manages engineering teams'),
  (null,'TEAM_LEAD','Team Lead',true,'Leads a team'),
  (null,'DEVELOPER','Developer',true,'Engineer'),
  (null,'QA_ENGINEER','QA Engineer',true,'Quality assurance'),
  (null,'DEVOPS_ENGINEER','DevOps Engineer',true,'DevOps'),
  (null,'SECURITY_ENGINEER','Security Engineer',true,'Security'),
  (null,'COMPLIANCE_REVIEWER','Compliance Reviewer',true,'Compliance'),
  (null,'AUDITOR','Auditor',true,'Read-only audit access'),
  (null,'CLIENT_VIEWER','Client Viewer',true,'External read-only viewer')
on conflict (code) where organization_id is null do nothing;

-- ----------------------------------------------------------------------------
-- Role -> permission mapping for system roles
-- ----------------------------------------------------------------------------
-- helper: map a role code to a set of permission codes
do $$
declare
  r record;
begin
  -- PROJECT_MANAGER
  for r in select id from public.roles where code='PROJECT_MANAGER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','team:create','team:update','team:manage_members',
      'project:view','project:create','project:update','project:archive','project:manage_members',
      'task:view','task:create','task:update','task:assign','task:delete','task:bulk_update',
      'sprint:view','sprint:create','sprint:update','sprint:start','sprint:complete',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','document:update',
      'approval:view','approval:create',
      'release:view','release:create',
      'analytics:view','ai:use','integration:view')
    on conflict do nothing;
  end loop;

  -- ENGINEERING_MANAGER / TEAM_LEAD (similar to PM minus archive/release-create heavy)
  for r in select id, code from public.roles where code in ('ENGINEERING_MANAGER','TEAM_LEAD') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','team:update','team:manage_members',
      'project:view','project:update','project:manage_members',
      'task:view','task:create','task:update','task:assign','task:bulk_update',
      'sprint:view','sprint:create','sprint:update','sprint:start','sprint:complete',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','document:update',
      'approval:view','approval:create','release:view','analytics:view','ai:use','integration:view')
    on conflict do nothing;
  end loop;

  -- DEVELOPER / DEVOPS_ENGINEER
  for r in select id, code from public.roles where code in ('DEVELOPER','DEVOPS_ENGINEER') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view',
      'project:view','task:view','task:update',
      'sprint:view','comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','document:update',
      'release:view','approval:view','analytics:view','ai:use','integration:view')
    on conflict do nothing;
  end loop;

  -- QA_ENGINEER
  for r in select id from public.roles where code='QA_ENGINEER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','project:view',
      'task:view','task:update','sprint:view',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','release:view','approval:view','approval:decide',
      'analytics:view','ai:use')
    on conflict do nothing;
  end loop;

  -- SECURITY_ENGINEER
  for r in select id from public.roles where code='SECURITY_ENGINEER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','project:view',
      'task:view','task:update','comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create',
      'security:view','security:review','security:approve',
      'release:view','release:approve','approval:view','approval:decide',
      'analytics:view','ai:use')
    on conflict do nothing;
  end loop;

  -- COMPLIANCE_REVIEWER
  for r in select id from public.roles where code='COMPLIANCE_REVIEWER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','project:view','task:view',
      'document:view','document:create','document:approve',
      'approval:view','approval:decide','release:view','release:approve',
      'security:view','audit:view','analytics:view','ai:use')
    on conflict do nothing;
  end loop;

  -- AUDITOR (read-only + audit)
  for r in select id from public.roles where code='AUDITOR' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','project:view','task:view',
      'sprint:view','document:view','approval:view','release:view','security:view',
      'audit:view','analytics:view')
    on conflict do nothing;
  end loop;

  -- CLIENT_VIEWER (minimal read-only)
  for r in select id from public.roles where code='CLIENT_VIEWER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in ('project:view','task:view','document:view')
    on conflict do nothing;
  end loop;

  -- CEO / CTO (broad view + analytics + approvals, no destructive defaults beyond PM)
  for r in select id from public.roles where code in ('CEO','CTO') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','organization:manage','member:view','member:invite','member:manage',
      'team:view','project:view','project:create','project:update',
      'task:view','sprint:view','document:view','document:approve',
      'approval:view','approval:decide','release:view','release:approve',
      'security:view','audit:view','analytics:view','ai:use','integration:view','integration:manage')
    on conflict do nothing;
  end loop;
end $$;
