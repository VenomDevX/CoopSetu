-- ============================================================================
-- Handoff — 0022 FK from organization_members.user_id → profiles.id
-- Enables PostgREST to embed the member's profile. Both columns reference
-- auth.users(id) and every member has a profile (created by the signup trigger
-- / accept_invite), so this FK is satisfiable.
-- ============================================================================

alter table public.organization_members
  drop constraint if exists org_members_profile_fk;

alter table public.organization_members
  add constraint org_members_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;
