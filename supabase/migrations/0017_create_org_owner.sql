-- ============================================================================
-- Handoff — 0017 New company creator becomes ORG_OWNER (was ORG_ADMIN)
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
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  v_slug := coalesce(nullif(p_slug,''),
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,6));

  insert into public.organizations (name, slug, industry, timezone, created_by)
  values (p_name, v_slug, p_industry, coalesce(p_timezone,'UTC'), v_uid)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, employment_status, is_active)
  values (v_org.id, v_uid, 'ACTIVE', true)
  returning * into v_member;

  select id into v_role_id from public.roles where code = 'ORG_OWNER' and organization_id is null;
  insert into public.member_roles (organization_member_id, role_id)
  values (v_member.id, v_role_id);

  return v_org;
end;
$$;
grant execute on function public.create_organization(text,text,text,text) to authenticated;
