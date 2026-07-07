-- ============================================================================
-- Handoff — 0067 Student Workspace schema
-- ============================================================================
-- Adds a workspace_type dimension to organizations (ENTERPRISE / STUDENT_SOLO /
-- STUDENT_TEAM) plus supporting tables for student teams: settings, secure
-- join codes (hash-only storage), and functional contribution labels.
-- Reuses the existing organization/membership/role/RLS architecture rather
-- than introducing a parallel tenant model.
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS workspace_type text NOT NULL DEFAULT 'ENTERPRISE'
    CHECK (workspace_type IN ('ENTERPRISE','STUDENT_SOLO','STUDENT_TEAM'));

-- ----------------------------------------------------------------------------
-- student_team_settings — one row per STUDENT_TEAM organization
-- ----------------------------------------------------------------------------
create table if not exists public.student_team_settings (
  organization_id             uuid primary key references public.organizations(id) on delete cascade,
  event_name                  text,
  short_description           text,
  expected_team_size          int check (expected_team_size > 0),
  max_team_size               int not null check (max_team_size > 0 and max_team_size <= 50),
  primary_team_role           text,
  co_lead_can_manage_members  boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
select handoff.attach_updated_at('public.student_team_settings');

-- ----------------------------------------------------------------------------
-- student_team_join_codes — hash-only secure join codes.
-- Only one active code per team at a time; rotation deactivates the old row
-- and inserts a new one (simple audit trail, no in-place code mutation).
-- ----------------------------------------------------------------------------
create table if not exists public.student_team_join_codes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code_hash        text not null,
  created_by       uuid references public.organization_members(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz,
  max_uses         int check (max_uses is null or max_uses > 0),
  used_count       int not null default 0,
  is_active        boolean not null default true,
  revoked_at       timestamptz,
  last_rotated_at  timestamptz
);
create unique index if not exists student_team_join_codes_active_uniq
  on public.student_team_join_codes(organization_id) where is_active;
create index if not exists student_team_join_codes_hash_idx
  on public.student_team_join_codes(code_hash) where is_active;
create index if not exists student_team_join_codes_org_idx
  on public.student_team_join_codes(organization_id);

-- ----------------------------------------------------------------------------
-- student_team_member_labels — functional contribution labels. Display-only
-- metadata; never referenced by RLS/permission checks (label_normalized
-- follows the same normalize-for-uniqueness convention as
-- profiles.username_normalized).
-- ----------------------------------------------------------------------------
create table if not exists public.student_team_member_labels (
  id                       uuid primary key default gen_random_uuid(),
  organization_member_id   uuid not null references public.organization_members(id) on delete cascade,
  label                    text not null check (length(label) between 1 and 60),
  label_normalized         text not null,
  assigned_by              uuid references public.organization_members(id) on delete set null,
  created_at               timestamptz not null default now(),
  unique (organization_member_id, label_normalized)
);
create index if not exists student_team_member_labels_member_idx
  on public.student_team_member_labels(organization_member_id);
