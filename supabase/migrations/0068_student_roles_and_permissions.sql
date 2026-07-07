-- ============================================================================
-- Handoff — 0068 Student roles + permission catalogue
-- ============================================================================
-- Adds student-scoped permission codes and 4 new system roles. These are
-- granted explicit role_permissions rows (an allow-list), NOT added to the
-- has_permission()/ADMIN_ROLES bypass list — a student role must never gain
-- implicit access to every permission the way SUPER_ADMIN/ORG_ADMIN/ORG_OWNER
-- do, since that would risk bypassing future enterprise-only checks too.
-- ============================================================================

insert into public.permissions (code, description) values
  ('student_team:manage_settings','Manage student team settings'),
  ('student_team:manage_join_code','Generate/rotate/revoke student team join codes'),
  ('student_team:manage_members','Manage student team member authority/removal'),
  ('student_team:assign_authority_role','Assign STUDENT_CO_LEAD/STUDENT_MEMBER roles'),
  ('student_team:manage_labels','Assign functional contribution labels'),
  ('student_team:transfer_leadership','Transfer student team leadership'),
  ('student_team:view','View student team'),
  ('student_workspace:manage_settings','Manage personal student workspace settings'),
  ('student_workspace:delete','Delete personal student workspace')
on conflict (code) do nothing;

insert into public.roles (organization_id, code, name, is_system, description) values
  (null,'STUDENT_TEAM_LEAD','Student Team Lead',true,'Owns and manages a student/hackathon team workspace'),
  (null,'STUDENT_CO_LEAD','Student Co-Lead',true,'Assists managing a student team, scoped by lead-granted permissions'),
  (null,'STUDENT_MEMBER','Student Team Member',true,'Member of a student team with standard collaboration access'),
  (null,'STUDENT_SOLO_OWNER','Student Solo Workspace Owner',true,'Owner of a personal solo student workspace')
on conflict (code) where organization_id is null do nothing;

do $$
declare r record;
begin
  -- STUDENT_TEAM_LEAD: full control of their own team + core collaboration.
  -- Deliberately excludes organization:manage, member:manage, security:*,
  -- audit:view, integration:*, release:*, approval:decide, document:approve
  -- (enterprise-only codes).
  for r in select id from public.roles where code='STUDENT_TEAM_LEAD' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'student_team:manage_settings','student_team:manage_join_code','student_team:manage_members',
      'student_team:assign_authority_role','student_team:manage_labels','student_team:transfer_leadership',
      'student_team:view',
      'organization:view','member:view','team:view','team:create','team:update','team:manage_members',
      'project:view','project:create','project:update','project:manage_members',
      'task:view','task:create','task:update','task:assign','task:delete','task:bulk_update',
      'sprint:view','sprint:create','sprint:update','sprint:start','sprint:complete',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','document:update',
      'analytics:view','ai:use')
    on conflict do nothing;
  end loop;

  -- STUDENT_CO_LEAD: core collaboration only. student_team:manage_members /
  -- assign_authority_role / transfer_leadership are intentionally withheld —
  -- the API layer additionally gates member-management on the per-team
  -- co_lead_can_manage_members toggle (defense in depth beyond role grants).
  for r in select id from public.roles where code='STUDENT_CO_LEAD' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'student_team:view',
      'organization:view','member:view','team:view',
      'project:view','project:create','project:update',
      'task:view','task:create','task:update','task:assign',
      'sprint:view','sprint:create','sprint:update',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create',
      'analytics:view','ai:use')
    on conflict do nothing;
  end loop;

  -- STUDENT_MEMBER: standard collaboration only, no management capability.
  for r in select id from public.roles where code='STUDENT_MEMBER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'student_team:view',
      'project:view','task:view','task:create','task:update',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view')
    on conflict do nothing;
  end loop;

  -- STUDENT_SOLO_OWNER: full control of their own single-person workspace.
  -- No team:*/member:* codes — there is only ever one member.
  for r in select id from public.roles where code='STUDENT_SOLO_OWNER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'student_workspace:manage_settings','student_workspace:delete',
      'organization:view',
      'project:view','project:create','project:update','project:archive',
      'task:view','task:create','task:update','task:assign','task:delete','task:bulk_update',
      'sprint:view','sprint:create','sprint:update','sprint:start','sprint:complete',
      'comment:create','comment:update_own','comment:delete_own',
      'document:view','document:create','document:update',
      'analytics:view','ai:use')
    on conflict do nothing;
  end loop;
end $$;
