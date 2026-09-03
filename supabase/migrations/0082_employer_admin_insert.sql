-- ============================================================================
-- CoopSetu — 0082 Admin-registered employer accounts
-- ============================================================================
-- 0080 gave `employers` a self-insert policy (a user registers their own
-- company) plus admin-scoped UPDATE/DELETE, but no admin-scoped INSERT — so
-- an ADMIN/ORG_OWNER using the Employer Directory's "Register Employer" form
-- (app/dashboard/employers/page.tsx) to onboard a company on behalf of an
-- existing user account (the same "paste the user's UUID" pattern already
-- used by the Trainees admin form) was rejected by RLS: neither the
-- self-insert policy (user_id must equal the caller) nor any other policy
-- covered it.
--
-- This is admin-tier only (coopsetu.is_org_admin_or_owner), matching the
-- write scope 0080 already gave employers_self_update/employers_admin_delete
-- — not widened to INSTITUTE_ADMIN, whose role in REQUIREMENT.MD's own
-- definition covers trainees/trainers/batches/attendance, not employer
-- onboarding.
-- ============================================================================

begin;

create policy employers_admin_insert on public.employers
  for insert with check (coopsetu.is_org_admin_or_owner(organization_id));

commit;
