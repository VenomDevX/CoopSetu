-- ============================================================================
-- Handoff — 0069 Student team RLS, join-code security, and workspace RPCs
-- ============================================================================
-- RLS for the 3 new tables + SECURITY DEFINER RPCs for every student
-- workspace mutation, following the exact calling convention established in
-- 0064 (create_organization): callers are trusted Next.js API routes using
-- the service-role admin client, passing the acting user's id explicitly
-- (auth.uid() is always NULL on service-role connections).
--
-- Join codes are hashed with a plain SHA-256 of the normalized code (no
-- separate HMAC secret to provision/rotate in ops) — acceptable because the
-- code itself is the high-entropy secret (8 chars from a 32-symbol alphabet,
-- ~40 bits), the same trust model used for hashing API keys/session tokens.
-- Combined with rate-limited redemption endpoints (enforced in the API
-- layer), brute force is impractical.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: student_team_settings
-- ----------------------------------------------------------------------------
alter table public.student_team_settings enable row level security;

create policy student_team_settings_select on public.student_team_settings
  for select using (handoff.is_org_member(organization_id));

create policy student_team_settings_update on public.student_team_settings
  for update using (handoff.has_permission(organization_id, 'student_team:manage_settings'))
  with check (handoff.has_permission(organization_id, 'student_team:manage_settings'));

revoke insert, delete on public.student_team_settings from authenticated, anon;

-- ----------------------------------------------------------------------------
-- RLS: student_team_member_labels — display-only, but still org-scoped reads;
-- all writes go through the manage_labels RPC (needs to validate the target
-- member is in the caller's own team, easier as an RPC than a policy).
-- ----------------------------------------------------------------------------
alter table public.student_team_member_labels enable row level security;

create policy student_team_labels_select on public.student_team_member_labels
  for select using (
    handoff.is_org_member((
      select organization_id from public.organization_members
      where id = organization_member_id
    ))
  );

revoke insert, update, delete on public.student_team_member_labels from authenticated, anon;

-- ----------------------------------------------------------------------------
-- RLS: student_team_join_codes — fully locked down for authenticated/anon.
-- code_hash must never be reachable via PostgREST row access, so there is no
-- SELECT policy at all; status is read only via the get_join_code_status()
-- SECURITY DEFINER function below (returns only non-secret columns).
-- ----------------------------------------------------------------------------
alter table public.student_team_join_codes enable row level security;
revoke all on public.student_team_join_codes from authenticated, anon;

-- ----------------------------------------------------------------------------
-- Join-code generation helper (human-friendly format: TEAM-XXXX-XXXX, using a
-- 32-symbol alphabet that excludes visually ambiguous characters 0/O/1/I/L).
-- ----------------------------------------------------------------------------
create or replace function handoff.generate_join_code()
returns text
language sql
volatile
as $$
  select 'TEAM-' ||
    (select string_agg(substr(chars, (random() * length(chars))::int + 1, 1), '')
       from (select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' as chars) c, generate_series(1, 4)) ||
    '-' ||
    (select string_agg(substr(chars, (random() * length(chars))::int + 1, 1), '')
       from (select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' as chars) c, generate_series(1, 4));
$$;

create or replace function handoff.hash_join_code(p_raw_code text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(upper(regexp_replace(p_raw_code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
$$;

-- ----------------------------------------------------------------------------
-- get_join_code_status — safe, non-secret join-code metadata for the Team
-- Lead/permitted Co-Lead management UI. Never returns code_hash.
-- ----------------------------------------------------------------------------
create or replace function public.get_join_code_status(p_org uuid)
returns table (
  id uuid, organization_id uuid, created_by uuid, created_at timestamptz,
  expires_at timestamptz, max_uses int, used_count int, is_active boolean,
  revoked_at timestamptz, last_rotated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select jc.id, jc.organization_id, jc.created_by, jc.created_at,
         jc.expires_at, jc.max_uses, jc.used_count, jc.is_active,
         jc.revoked_at, jc.last_rotated_at
  from public.student_team_join_codes jc
  where jc.organization_id = p_org
    and jc.is_active
    and handoff.has_permission(p_org, 'student_team:manage_join_code')
  order by jc.created_at desc
  limit 1;
$$;
grant execute on function public.get_join_code_status(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- create_student_solo_workspace
-- ----------------------------------------------------------------------------
create or replace function public.create_student_solo_workspace(
  p_user_id uuid, p_name text, p_description text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_member_id uuid;
  v_role_id uuid;
  v_slug text;
begin
  if p_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  v_slug := 'student-' || substr(gen_random_uuid()::text, 1, 12);

  insert into public.organizations (name, slug, workspace_type, description, created_by, initial_setup_completed_at)
  values (p_name, v_slug, 'STUDENT_SOLO', p_description, p_user_id, now())
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_org.id, p_user_id, 'ACTIVE', true)
  returning id into v_member_id;

  select id into v_role_id from public.roles where code = 'STUDENT_SOLO_OWNER' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id) values (v_member_id, v_role_id);

  return v_org;
end;
$$;
revoke execute on function public.create_student_solo_workspace from authenticated, public, anon;
grant execute on function public.create_student_solo_workspace to service_role;

-- ----------------------------------------------------------------------------
-- create_student_team — creates the org, settings row, Lead membership, and
-- the first join code in one transaction. Returns the raw code once (never
-- retrievable again after this call — Team Leads must rotate if lost).
-- ----------------------------------------------------------------------------
create or replace function public.create_student_team(
  p_user_id uuid, p_name text, p_event_name text default null,
  p_short_description text default null, p_expected_team_size int default null,
  p_max_team_size int default 10, p_primary_team_role text default null
)
returns table (out_organization_id uuid, out_name text, out_slug text, raw_join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_member_id uuid;
  v_role_id uuid;
  v_slug text;
  v_raw_code text;
begin
  if p_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_max_team_size is null or p_max_team_size <= 0 or p_max_team_size > 50 then
    raise exception 'INVALID_MAX_TEAM_SIZE';
  end if;

  v_slug := 'student-team-' || substr(gen_random_uuid()::text, 1, 12);

  insert into public.organizations (name, slug, workspace_type, created_by, initial_setup_completed_at)
  values (p_name, v_slug, 'STUDENT_TEAM', p_user_id, now())
  returning * into v_org;

  insert into public.student_team_settings (
    organization_id, event_name, short_description, expected_team_size,
    max_team_size, primary_team_role
  ) values (
    v_org.id, p_event_name, p_short_description, p_expected_team_size,
    p_max_team_size, p_primary_team_role
  );

  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_org.id, p_user_id, 'ACTIVE', true)
  returning id into v_member_id;

  select id into v_role_id from public.roles where code = 'STUDENT_TEAM_LEAD' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id) values (v_member_id, v_role_id);

  v_raw_code := handoff.generate_join_code();
  insert into public.student_team_join_codes (organization_id, code_hash, created_by)
  values (v_org.id, handoff.hash_join_code(v_raw_code), v_member_id);

  return query select v_org.id, v_org.name, v_org.slug, v_raw_code::text;
end;
$$;
revoke execute on function public.create_student_team from authenticated, public, anon;
grant execute on function public.create_student_team to service_role;

-- ----------------------------------------------------------------------------
-- rotate_join_code / revoke_join_code — permission-checked inside the
-- function body (defense in depth beyond the route-level check).
-- ----------------------------------------------------------------------------
create or replace function public.rotate_join_code(p_org uuid, p_caller_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_raw_code text;
begin
  select id into v_member_id from public.organization_members
    where organization_id = p_org and user_id = p_caller_user_id and is_active;

  if v_member_id is null or not exists (
    select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    where mr.organization_member_id = v_member_id and rp.permission_code = 'student_team:manage_join_code'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.student_team_join_codes
    set is_active = false, revoked_at = now()
    where organization_id = p_org and is_active;

  v_raw_code := handoff.generate_join_code();
  insert into public.student_team_join_codes (organization_id, code_hash, created_by, last_rotated_at)
  values (p_org, handoff.hash_join_code(v_raw_code), v_member_id, now());

  return v_raw_code;
end;
$$;
revoke execute on function public.rotate_join_code from authenticated, public, anon;
grant execute on function public.rotate_join_code to service_role;

create or replace function public.revoke_join_code(p_org uuid, p_caller_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select id into v_member_id from public.organization_members
    where organization_id = p_org and user_id = p_caller_user_id and is_active;

  if v_member_id is null or not exists (
    select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    where mr.organization_member_id = v_member_id and rp.permission_code = 'student_team:manage_join_code'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.student_team_join_codes
    set is_active = false, revoked_at = now()
    where organization_id = p_org and is_active;
end;
$$;
revoke execute on function public.revoke_join_code from authenticated, public, anon;
grant execute on function public.revoke_join_code to service_role;

-- ----------------------------------------------------------------------------
-- redeem_student_team_join_code — the concurrency-critical redemption path.
-- SELECT ... FOR UPDATE locks the matching join-code row so capacity/
-- used_count checks and the increment happen atomically within one
-- transaction, preventing a race where two concurrent redemptions both pass
-- the capacity check before either increments used_count.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_student_team_join_code(p_user_id uuid, p_raw_code text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_jc record;
  v_org record;
  v_member_count int;
  v_max_size int;
  v_member_id uuid;
  v_role_id uuid;
begin
  if p_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_raw_code is null or length(trim(p_raw_code)) = 0 then raise exception 'INVALID_CODE'; end if;

  v_hash := handoff.hash_join_code(p_raw_code);

  select * into v_jc from public.student_team_join_codes
    where code_hash = v_hash and is_active
    for update;

  if not found then raise exception 'INVALID_CODE'; end if;
  if v_jc.expires_at is not null and v_jc.expires_at < now() then raise exception 'INVALID_CODE'; end if;
  if v_jc.max_uses is not null and v_jc.used_count >= v_jc.max_uses then raise exception 'INVALID_CODE'; end if;

  select * into v_org from public.organizations
    where id = v_jc.organization_id and workspace_type = 'STUDENT_TEAM';
  if not found then raise exception 'INVALID_CODE'; end if;

  select id into v_member_id from public.organization_members
    where organization_id = v_org.id and user_id = p_user_id;

  if v_member_id is not null and exists (
    select 1 from public.organization_members where id = v_member_id and is_active
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  select max_team_size into v_max_size from public.student_team_settings where organization_id = v_org.id;
  select count(*) into v_member_count from public.organization_members
    where organization_id = v_org.id and is_active;
  if v_member_count >= v_max_size then raise exception 'TEAM_FULL'; end if;

  if v_member_id is not null then
    -- rejoining after a prior departure: reactivate the existing row
    update public.organization_members set is_active = true, employment_status = 'ACTIVE'
      where id = v_member_id;
  else
    insert into public.organization_members (organization_id, user_id, employment_status, is_active)
    values (v_org.id, p_user_id, 'ACTIVE', true)
    returning id into v_member_id;
  end if;

  select id into v_role_id from public.roles where code = 'STUDENT_MEMBER' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id)
  values (v_member_id, v_role_id)
  on conflict do nothing;

  update public.student_team_join_codes set used_count = used_count + 1 where id = v_jc.id;

  return v_org;
end;
$$;
revoke execute on function public.redeem_student_team_join_code from authenticated, public, anon;
grant execute on function public.redeem_student_team_join_code to service_role;

-- ----------------------------------------------------------------------------
-- preview_join_code — safe pre-join preview: team name, event name, and
-- available spots only. Never reveals member lists or private data. Returns
-- zero rows for any invalid/expired/revoked/exhausted/wrong-workspace-type
-- code so the API layer can give one generic "invalid code" response.
-- ----------------------------------------------------------------------------
create or replace function public.preview_join_code(p_raw_code text)
returns table (team_name text, event_name text, available_spots int)
language sql
stable
security definer
set search_path = public
as $$
  select o.name, s.event_name,
         greatest(s.max_team_size - (
           select count(*) from public.organization_members m
           where m.organization_id = o.id and m.is_active
         ), 0)
  from public.student_team_join_codes jc
  join public.organizations o on o.id = jc.organization_id and o.workspace_type = 'STUDENT_TEAM'
  join public.student_team_settings s on s.organization_id = o.id
  where jc.code_hash = handoff.hash_join_code(p_raw_code)
    and jc.is_active
    and (jc.expires_at is null or jc.expires_at > now())
    and (jc.max_uses is null or jc.used_count < jc.max_uses);
$$;
revoke execute on function public.preview_join_code from authenticated, public, anon;
grant execute on function public.preview_join_code to service_role;

-- ----------------------------------------------------------------------------
-- transfer_team_leadership — validates the new lead is an active member of
-- the same team before mutating anything.
-- ----------------------------------------------------------------------------
create or replace function public.transfer_team_leadership(
  p_org uuid, p_from_user_id uuid, p_to_member_id uuid, p_demote_to text default 'STUDENT_CO_LEAD'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_member_id uuid;
  v_lead_role_id uuid;
  v_demote_role_id uuid;
begin
  if p_demote_to not in ('STUDENT_CO_LEAD','STUDENT_MEMBER') then
    raise exception 'INVALID_DEMOTE_ROLE';
  end if;

  select id into v_from_member_id from public.organization_members
    where organization_id = p_org and user_id = p_from_user_id and is_active;
  if v_from_member_id is null then raise exception 'FORBIDDEN'; end if;

  if not exists (
    select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
    where mr.organization_member_id = v_from_member_id and r.code = 'STUDENT_TEAM_LEAD'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.organization_members
    where id = p_to_member_id and organization_id = p_org and is_active
  ) then
    raise exception 'INVALID_TARGET_MEMBER';
  end if;

  select id into v_lead_role_id from public.roles where code = 'STUDENT_TEAM_LEAD' and organization_id is null;
  select id into v_demote_role_id from public.roles where code = p_demote_to and organization_id is null;

  delete from public.member_roles where organization_member_id = v_from_member_id and role_id = v_lead_role_id;
  delete from public.member_roles where organization_member_id = p_to_member_id
    and role_id in (select id from public.roles where code in ('STUDENT_CO_LEAD','STUDENT_MEMBER') and organization_id is null);

  insert into public.member_roles (organization_member_id, role_id) values (p_to_member_id, v_lead_role_id);
  insert into public.member_roles (organization_member_id, role_id) values (v_from_member_id, v_demote_role_id)
    on conflict do nothing;
end;
$$;
revoke execute on function public.transfer_team_leadership from authenticated, public, anon;
grant execute on function public.transfer_team_leadership to service_role;
