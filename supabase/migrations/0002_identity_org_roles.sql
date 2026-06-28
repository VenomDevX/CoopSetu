-- ============================================================================
-- Handoff — 0002 Identity, Organizations, Roles, Permissions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  email        text,
  avatar_path  text,
  job_title    text,
  timezone     text default 'UTC',
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select handoff.attach_updated_at('public.profiles');

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  logo_path         text,
  industry          text,
  timezone          text default 'UTC',
  working_days      int[] default '{1,2,3,4,5}',
  theme_preference  text default 'system',
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select handoff.attach_updated_at('public.organizations');

-- ----------------------------------------------------------------------------
-- roles (system + custom per org)
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade, -- null = system role
  code            text not null,
  name            text not null,
  description     text,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, code)
);
select handoff.attach_updated_at('public.roles');
-- system roles (organization_id is null) must be globally unique by code
create unique index if not exists roles_system_code_uniq
  on public.roles(code) where organization_id is null;

-- ----------------------------------------------------------------------------
-- permissions (global catalogue)
-- ----------------------------------------------------------------------------
create table if not exists public.permissions (
  code        text primary key,
  description text
);

-- ----------------------------------------------------------------------------
-- role_permissions
-- ----------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id         uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

-- ----------------------------------------------------------------------------
-- organization_members
-- ----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  department_id     uuid, -- FK added in later migration to avoid ordering issues
  manager_id        uuid references public.organization_members(id) on delete set null,
  employment_status text not null default 'ACTIVE'
    check (employment_status in ('ACTIVE','INVITED','SUSPENDED','OFFBOARDED')),
  joined_at         timestamptz not null default now(),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, user_id)
);
select handoff.attach_updated_at('public.organization_members');
create index if not exists organization_members_org_idx  on public.organization_members(organization_id);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

-- ----------------------------------------------------------------------------
-- member_roles (a member may hold multiple roles)
-- ----------------------------------------------------------------------------
create table if not exists public.member_roles (
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  role_id                uuid not null references public.roles(id) on delete cascade,
  granted_at             timestamptz not null default now(),
  granted_by             uuid references public.organization_members(id) on delete set null,
  primary key (organization_member_id, role_id)
);

-- ----------------------------------------------------------------------------
-- organization_invites
-- ----------------------------------------------------------------------------
create table if not exists public.organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role_code       text not null,
  invited_by      uuid references public.organization_members(id) on delete set null,
  token           text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status          text not null default 'PENDING'
    check (status in ('PENDING','ACCEPTED','REVOKED','EXPIRED')),
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, email, status)
);
select handoff.attach_updated_at('public.organization_invites');
create index if not exists organization_invites_org_idx on public.organization_invites(organization_id);
