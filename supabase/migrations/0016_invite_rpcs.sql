-- ============================================================================
-- Handoff — 0016 Invite acceptance RPCs (SECURITY DEFINER)
-- A pending invitee is not yet an org member, so RLS would block reading the
-- invite or inserting membership. These definer functions handle it safely.
-- ============================================================================

-- View limited invite details by token (for the accept page).
create or replace function public.get_invite(p_token text)
returns table (
  organization_id uuid,
  organization_name text,
  email text,
  role_code text,
  status text,
  is_expired boolean
)
language sql stable security definer set search_path = public
as $$
  select i.organization_id, o.name, i.email, i.role_code, i.status,
         (i.expires_at < now()) as is_expired
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;
grant execute on function public.get_invite(text) to authenticated, anon;

-- Accept an invite for the currently authenticated user.
-- Validates token, status, expiry, and (when the invite email is set) that it
-- matches the caller's email. Creates membership + role; marks invite accepted.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_inv    public.organization_invites;
  v_member uuid;
  v_role   uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_inv from public.organization_invites where token = p_token;
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

  -- ensure profile exists
  insert into public.profiles (id, email) values (v_uid, v_email)
  on conflict (id) do nothing;

  -- membership (idempotent)
  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_inv.organization_id, v_uid, 'ACTIVE', true)
  on conflict (organization_id, user_id) do update set is_active = true
  returning id into v_member;
  if v_member is null then
    select id into v_member from public.organization_members
     where organization_id = v_inv.organization_id and user_id = v_uid;
  end if;

  -- role (system role by code; never silently grant if missing)
  select id into v_role from public.roles
   where code = v_inv.role_code and (organization_id is null or organization_id = v_inv.organization_id)
   order by organization_id nulls last limit 1;
  if v_role is not null then
    insert into public.member_roles (organization_member_id, role_id)
    values (v_member, v_role) on conflict do nothing;
  end if;

  update public.organization_invites
     set status = 'ACCEPTED', accepted_at = now() where id = v_inv.id;

  return v_inv.organization_id;
end;
$$;
grant execute on function public.accept_invite(text) to authenticated;
