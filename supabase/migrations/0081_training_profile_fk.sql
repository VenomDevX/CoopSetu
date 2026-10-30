-- ============================================================================
-- CoopSetu — 0081 FK from trainees/trainers.user_id → profiles.id
-- ============================================================================
-- Enables PostgREST to embed the trainee/trainer's profile
-- (`profiles:user_id(full_name, email, ...)`), used by 7 services:
-- trainee, trainer, batch, course (AssessmentService.getResults), employer
-- (JobService.getApplications), attendance, certificate (listAll).
--
-- Both `trainees.user_id`/`trainers.user_id` and `profiles.id` already
-- reference `auth.users(id)` independently (0071, 0002) — there is no FK edge
-- between them, so PostgREST's schema-cache graph has no path to resolve the
-- embed, and every one of those queries fails with:
--   "Could not find a relationship between 'trainees' and 'user_id' in the
--    schema cache" (PGRST200)
--
-- This is the exact problem 0022_member_profile_fk.sql already solved for
-- `organization_members` — same reasoning applies here: every `auth.users` row
-- gets a `profiles` row via the signup trigger
-- (0023_auth_and_onboarding.sql's handle_new_user), so `trainees.user_id`/
-- `trainers.user_id` (already FK'd to auth.users) are guaranteed satisfiable
-- against `profiles.id` too.
-- ============================================================================

begin;

-- Pre-flight: verify no orphan user_id (a trainee/trainer row whose user_id
-- has no matching profiles row would make the ALTER TABLE below fail). This
-- should never happen given the signup trigger, but fail loudly and clearly
-- rather than surface Postgres's own constraint-violation error if it does.
do $$
declare
  orphan_trainees int;
  orphan_trainers int;
begin
  select count(*) into orphan_trainees
  from public.trainees t
  left join public.profiles p on p.id = t.user_id
  where p.id is null;

  select count(*) into orphan_trainers
  from public.trainers t
  left join public.profiles p on p.id = t.user_id
  where p.id is null;

  if orphan_trainees > 0 or orphan_trainers > 0 then
    raise exception
      'Cannot add trainees/trainers -> profiles FK: % orphan trainee row(s), % orphan trainer row(s) have a user_id with no matching profiles row. Backfill profiles for these users before re-running this migration.',
      orphan_trainees, orphan_trainers;
  end if;
end $$;

alter table public.trainees
  drop constraint if exists trainees_profile_fk;

alter table public.trainees
  add constraint trainees_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.trainers
  drop constraint if exists trainers_profile_fk;

alter table public.trainers
  add constraint trainers_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;

commit;
