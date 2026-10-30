-- ============================================================================
-- Add missing system roles for CoopSetu personas (INSTITUTE_ADMIN, TRAINER, TRAINEE, EMPLOYER)
-- SUPER_ADMIN already exists as a system role.
-- ============================================================================

insert into public.roles (organization_id, code, name, is_system, description) values
  (null,'INSTITUTE_ADMIN','Institute Admin',true,'Manages institute and batches'),
  (null,'TRAINER','Trainer',true,'Instructs batches and marks attendance'),
  (null,'TRAINEE','Trainee',true,'Student attending programs'),
  (null,'EMPLOYER','Employer',true,'External recruiter hiring from programs')
on conflict (code) where organization_id is null do nothing;

-- Optionally, map default permissions for these new roles here if needed.
-- We can map basic view permissions.

do $$
declare
  r record;
begin
  -- INSTITUTE_ADMIN
  for r in select id from public.roles where code='INSTITUTE_ADMIN' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','team:create','team:update','team:manage_members',
      'project:view', 'analytics:view'
    )
    on conflict do nothing;
  end loop;

  -- TRAINER
  for r in select id from public.roles where code='TRAINER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view','team:view','project:view'
    )
    on conflict do nothing;
  end loop;

  -- TRAINEE & EMPLOYER
  for r in select id from public.roles where code in ('TRAINEE', 'EMPLOYER') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'organization:view','member:view'
    )
    on conflict do nothing;
  end loop;

end $$;
