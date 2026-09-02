-- ============================================================================
-- Handoff — 0049 Public Demo Workspace
-- ============================================================================

-- 1. Add demo tracking to organizations
alter table public.organizations
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

-- 2. Create demo_sessions table
create table if not exists public.demo_sessions (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid not null unique references auth.users(id) on delete cascade,
  organization_id   uuid not null unique references public.organizations(id) on delete cascade,
  demo_member_id    uuid not null unique references public.organization_members(id) on delete cascade,
  active_demo_role  text not null,
  seed_version      text not null,
  expires_at        timestamptz not null,
  last_active_at    timestamptz not null,
  created_at        timestamptz not null default now(),
  ended_at          timestamptz
);

-- 3. Prevent multiple active demo organizations per auth user via partial unique index
create unique index if not exists demo_sessions_active_auth_idx
  on public.demo_sessions(auth_user_id)
  where ended_at is null;

-- 4. Enable RLS
alter table public.demo_sessions enable row level security;

-- 5. RLS Policies for demo_sessions
-- Only the owner (anonymous user) can view their own demo session
create policy demo_sessions_select on public.demo_sessions
  for select using (auth_user_id = auth.uid());

create policy demo_sessions_update on public.demo_sessions
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Insert and Delete are managed by service role (backend APIs) so no policies needed for authenticated users.
