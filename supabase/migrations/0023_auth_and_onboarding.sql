-- ============================================================================
-- Handoff — 0023 Authentication & Onboarding Extensions
-- ============================================================================

-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS username_normalized text,
  ADD COLUMN IF NOT EXISTS bio text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_normalized_idx 
  ON public.profiles(username_normalized) 
  WHERE username_normalized IS NOT NULL;

-- Make sure existing users don't break, but any new username must be valid
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS valid_username;
ALTER TABLE public.profiles
  ADD CONSTRAINT valid_username CHECK (
    username IS NULL OR (
      length(username) >= 3 AND 
      length(username) <= 30 AND 
      username ~ '^[a-zA-Z0-9\._\-]+$'
    )
  );

-- 2. Extend organization_members
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS job_family text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS job_description text,
  ADD COLUMN IF NOT EXISTS professional_specialization text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS manager_type text;

-- 3. Extend organization_invites
ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS assigned_department_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_team_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_job_family text,
  ADD COLUMN IF NOT EXISTS assigned_job_title text,
  ADD COLUMN IF NOT EXISTS assigned_manager_type text,
  ADD COLUMN IF NOT EXISTS assigned_role_ids jsonb,
  ADD COLUMN IF NOT EXISTS invite_token_hash text;

-- Drop plain text token to adhere to security rule "Invitation tokens must be stored only as hashes"
ALTER TABLE public.organization_invites
  DROP CONSTRAINT IF EXISTS organization_invites_token_key;

ALTER TABLE public.organization_invites
  DROP COLUMN IF EXISTS token;

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_hash_idx
  ON public.organization_invites(invite_token_hash) 
  WHERE invite_token_hash IS NOT NULL;

-- 4. Rewrite RPCs to use invite_token_hash
DROP FUNCTION IF EXISTS public.get_invite(text);
create or replace function public.get_invite(p_token_hash text)
returns table (
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
  assigned_manager_type text,
  assigned_role_ids jsonb
)
language sql stable security definer set search_path = public
as $$
  select i.organization_id, o.name, i.email, i.role_code, i.status,
         (i.expires_at < now()) as is_expired,
         i.assigned_department_id, i.assigned_team_id,
         i.assigned_job_family, i.assigned_job_title,
         i.assigned_manager_type, i.assigned_role_ids
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  where i.invite_token_hash = p_token_hash;
$$;
grant execute on function public.get_invite(text) to authenticated, anon;

DROP FUNCTION IF EXISTS public.accept_invite(text);
create or replace function public.accept_invite(p_token_hash text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_inv    public.organization_invites;
  v_member uuid;
  v_role   uuid;
  v_role_id_str text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_inv from public.organization_invites where invite_token_hash = p_token_hash;
  if v_inv is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if v_inv.status <> 'PENDING' then raise exception 'INVITE_NOT_PENDING'; end if;
  if v_inv.expires_at < now() then
    update public.organization_invites set status = 'EXPIRED' where id = v_inv.id;
    raise exception 'INVITE_EXPIRED';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email,'')) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.profiles (id, email) values (v_uid, v_email)
  on conflict (id) do nothing;

  insert into public.organization_members (
    organization_id, user_id, employment_status, is_active,
    department_id, job_family, job_title, manager_type
  )
  values (
    v_inv.organization_id, v_uid, 'ACTIVE', true,
    v_inv.assigned_department_id, v_inv.assigned_job_family,
    v_inv.assigned_job_title, v_inv.assigned_manager_type
  )
  on conflict (organization_id, user_id) do update set 
    is_active = true,
    department_id = coalesce(v_inv.assigned_department_id, public.organization_members.department_id),
    job_family = coalesce(v_inv.assigned_job_family, public.organization_members.job_family),
    job_title = coalesce(v_inv.assigned_job_title, public.organization_members.job_title),
    manager_type = coalesce(v_inv.assigned_manager_type, public.organization_members.manager_type)
  returning id into v_member;
  
  if v_member is null then
    select id into v_member from public.organization_members
     where organization_id = v_inv.organization_id and user_id = v_uid;
  end if;

  if v_inv.assigned_team_id is not null then
    insert into public.team_members (team_id, organization_member_id)
    values (v_inv.assigned_team_id, v_member) on conflict do nothing;
  end if;

  if v_inv.assigned_role_ids is not null then
    for v_role_id_str in select jsonb_array_elements_text(v_inv.assigned_role_ids) loop
      insert into public.member_roles (organization_member_id, role_id)
      values (v_member, v_role_id_str::uuid) on conflict do nothing;
    end loop;
  else
    select id into v_role from public.roles
     where code = v_inv.role_code and (organization_id is null or organization_id = v_inv.organization_id)
     order by organization_id nulls last limit 1;
    if v_role is not null then
      insert into public.member_roles (organization_member_id, role_id)
      values (v_member, v_role) on conflict do nothing;
    end if;
  end if;

  update public.organization_invites
     set status = 'ACCEPTED', accepted_at = now() where id = v_inv.id;

  return v_inv.organization_id;
end;
$$;
grant execute on function public.accept_invite(text) to authenticated;
