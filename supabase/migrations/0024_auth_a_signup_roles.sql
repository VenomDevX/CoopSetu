-- ============================================================================
-- Handoff — 0024 Auth A: Database, username, roles, invite security
-- ============================================================================

-- 1. Username constraints
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS username_normalized_lower_trim;
ALTER TABLE public.profiles
  ADD CONSTRAINT username_normalized_lower_trim CHECK (
    username_normalized IS NULL OR (username_normalized = lower(trim(username_normalized)))
  );

-- 2. Organizations fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS description text;

-- 3. Teams fields
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS team_type text not null default 'ORGANIZATION_TEAM'
  CHECK (team_type IN ('ORGANIZATION_TEAM', 'PROJECT_TEAM')),
  ADD COLUMN IF NOT EXISTS created_by_member_id uuid references public.organization_members(id) on delete set null;

-- 4. Organization Invite Roles table
CREATE TABLE IF NOT EXISTS public.organization_invite_roles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invite_id  uuid not null references public.organization_invites(id) on delete cascade,
  role_id    uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (invite_id, role_id)
);
CREATE INDEX IF NOT EXISTS organization_invite_roles_org_idx on public.organization_invite_roles(organization_id);

ALTER TABLE public.organization_invites DROP COLUMN IF EXISTS assigned_role_ids;

-- 5. Redefine get_invite to NOT return assigned_role_ids (using new table)
DROP FUNCTION IF EXISTS public.get_invite(text);
CREATE OR REPLACE FUNCTION public.get_invite(p_token_hash text)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  email text,
  role_code text,
  status text,
  is_expired boolean,
  assigned_department_id uuid,
  assigned_team_id uuid,
  assigned_job_family text,
  assigned_job_title text,
  assigned_manager_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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
GRANT EXECUTE ON FUNCTION public.get_invite(text) TO authenticated, anon;

-- 6. Redefine accept_invite to read from organization_invite_roles
DROP FUNCTION IF EXISTS public.accept_invite(text);
CREATE OR REPLACE FUNCTION public.accept_invite(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- 7. Add team_type to teams RLS
DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams
  FOR INSERT WITH CHECK (
    -- Either they can create unrestricted organization teams...
    (handoff.has_permission(organization_id, 'team:create') AND team_type = 'ORGANIZATION_TEAM') OR
    -- ...or they can create project teams (handled securely via RPC, but let's allow it in RLS if they have perm)
    (handoff.has_permission(organization_id, 'team:create_project_team') AND team_type = 'PROJECT_TEAM')
  );
INSERT INTO public.permissions (code, description) VALUES
  ('team:create_project_team', 'Can create project-scoped teams'),
  ('team:manage_project_team_members', 'Can manage members of project-scoped teams')
ON CONFLICT (code) DO NOTHING;

-- Assign these to the global PROJECT_MANAGER role
INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r, public.permissions p
WHERE r.code = 'PROJECT_MANAGER' AND r.organization_id IS NULL
  AND p.code IN ('team:create_project_team', 'team:manage_project_team_members')
ON CONFLICT DO NOTHING;


-- 8. Update Teams RLS
DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams
  FOR INSERT WITH CHECK (
    (handoff.has_permission(organization_id, 'team:create') AND team_type = 'ORGANIZATION_TEAM') OR
    (handoff.has_permission(organization_id, 'team:create_project_team') AND team_type = 'PROJECT_TEAM')
  );

-- 9. Secure RPC for creating an organization (incorporates new job fields and company fields)
DROP FUNCTION IF EXISTS public.create_organization(text, text, text, text);
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text,
  p_slug text default null,
  p_industry text default null,
  p_company_size text default null,
  p_timezone text default 'UTC',
  p_description text default null,
  p_job_family text default null,
  p_job_title text default null,
  p_professional_specialization text default null,
  p_manager_type text default null,
  p_job_description text default null
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
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
GRANT EXECUTE ON FUNCTION public.create_organization TO authenticated;


-- 10. Secure RPC for creating a project team
CREATE OR REPLACE FUNCTION public.create_project_team(
  p_project_id uuid,
  p_team_name text,
  p_team_code text default null,
  p_description text default null
)
RETURNS public.teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF v_project IS NULL THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;

  v_org_id := v_project.organization_id;

  SELECT id INTO v_member_id FROM public.organization_members WHERE user_id = v_uid AND organization_id = v_org_id AND is_active = true;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'NOT_ORG_MEMBER';
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
GRANT EXECUTE ON FUNCTION public.create_project_team TO authenticated;
