-- ============================================================================
-- CoopSetu — 0080 Training-domain RLS write policies
-- ============================================================================
-- Migration 0071 enabled RLS on every cooperative-training table but only ever
-- wrote SELECT policies for 9 of them (institutions, programmes, trainers,
-- trainees, batches, courses, certificates, employers, jobs) and NO policies
-- at all for the other 11 (attendance_sessions, attendance_records,
-- enrollments, assessments, assessment_questions, assessment_results,
-- course_modules, course_progress, trainee_skills, job_skills,
-- job_applications).
--
-- RLS-enabled-with-zero-policies is Postgres's default-deny: every write
-- (INSERT/UPDATE/DELETE) on all 20 tables was silently rejected for every
-- authenticated user including admins — confirmed empirically, an
-- INSTITUTE_ADMIN inserting into `trainees` gets
-- "new row violates row-level security policy" — and every read on the 11
-- zero-policy tables silently returned zero rows for everyone. None of this
-- surfaced as an app-level bug report because the app-layer code is correct;
-- the schema simply never got the policies migration 0071's own table
-- comments implied it would.
--
-- This migration adds them, following the two conventions already
-- established elsewhere in this codebase:
--   * SELECT policies scoped by organization membership via
--     coopsetu.is_org_member(), matching the org_members_view_* naming and
--     shape already used for the 9 tables that have one (0071).
--   * Staff write policies scoped by fine-grained permission codes via
--     coopsetu.has_permission(org, 'x:manage'), matching 0007's
--     departments/teams/skills pattern. has_permission() already grants
--     SUPER_ADMIN/ORG_ADMIN/ORG_OWNER every permission code automatically, so
--     only INSTITUTE_ADMIN/TRAINER need explicit grants below — ADMIN-tier
--     roles need nothing added.
--   * Self-ownership writes (a trainee managing their own enrollment,
--     attendance, skills, progress, applications; an employer managing their
--     own company/job listings) are scoped directly by
--     `user_id = (select auth.uid())` through the owning row, matching 0007's
--     `emp_skills_manage` pattern (`m.user_id = auth.uid() or has_permission(...)`)
--     rather than a new permission code — these are inherently personal
--     resources, not organization-administered ones.
--
-- Column note: every table below has organization_id reachable from a single
-- FK hop except job_skills/course_modules/assessment_questions, which resolve
-- it through their parent (job/course/assessment) — same join style 0071
-- already used for `certificates` (trainee_id -> trainees.organization_id)
-- and `jobs` (employer_id -> employers.organization_id).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. New permission codes, granted to INSTITUTE_ADMIN and TRAINER. ADMIN-tier
--    roles (SUPER_ADMIN/ORG_ADMIN/ORG_OWNER) get every permission code
--    automatically via coopsetu.has_permission()'s built-in bypass, so they
--    are intentionally not granted here. EMPLOYER needs none of these — every
--    employer-side write below is ownership-scoped instead.
-- ---------------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('institution:manage', 'Create, update, and deactivate training institutions'),
  ('programme:manage',   'Create, update, and manage training programmes'),
  ('trainer:manage',     'Register, update, and manage trainers'),
  ('trainee:manage',     'Register, update, and manage trainees'),
  ('batch:manage',       'Create, update, and manage training batches'),
  ('course:manage',      'Create, update, and manage courses and course modules'),
  ('assessment:manage',  'Create, update, and grade assessments'),
  ('attendance:manage',  'Create attendance sessions and mark/edit attendance records'),
  ('certificate:manage', 'Issue and revoke certificates')
on conflict (code) do nothing;

do $$
declare
  r record;
begin
  for r in select id from public.roles where code = 'INSTITUTE_ADMIN' and organization_id is null loop
    insert into public.role_permissions (role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'institution:manage', 'programme:manage', 'trainer:manage', 'trainee:manage',
      'batch:manage', 'course:manage', 'assessment:manage', 'attendance:manage', 'certificate:manage'
    )
    on conflict do nothing;
  end loop;

  for r in select id from public.roles where code = 'TRAINER' and organization_id is null loop
    insert into public.role_permissions (role_id, permission_code)
    select r.id, code from public.permissions
    where code in (
      'batch:manage', 'trainee:manage', 'course:manage',
      'assessment:manage', 'attendance:manage', 'certificate:manage'
    )
    on conflict do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. institutions / programmes / trainers — SELECT already exists (0071);
--    add staff-only write.
-- ---------------------------------------------------------------------------
create policy institutions_manage on public.institutions
  for all using (coopsetu.has_permission(organization_id, 'institution:manage'))
  with check (coopsetu.has_permission(organization_id, 'institution:manage'));

create policy programmes_manage on public.programmes
  for all using (coopsetu.has_permission(organization_id, 'programme:manage'))
  with check (coopsetu.has_permission(organization_id, 'programme:manage'));

create policy trainers_manage on public.trainers
  for all using (coopsetu.has_permission(organization_id, 'trainer:manage'))
  with check (coopsetu.has_permission(organization_id, 'trainer:manage'));

-- ---------------------------------------------------------------------------
-- 3. trainees — SELECT already exists. Staff write, plus self-registration
--    and self-update (a trainee manages their own row; only staff may delete).
-- ---------------------------------------------------------------------------
create policy trainees_manage on public.trainees
  for all using (coopsetu.has_permission(organization_id, 'trainee:manage'))
  with check (coopsetu.has_permission(organization_id, 'trainee:manage'));

create policy trainees_self_insert on public.trainees
  for insert with check (user_id = (select auth.uid()));

create policy trainees_self_update on public.trainees
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. batches — SELECT already exists; add staff-only write.
-- ---------------------------------------------------------------------------
create policy batches_manage on public.batches
  for all using (coopsetu.has_permission(organization_id, 'batch:manage'))
  with check (coopsetu.has_permission(organization_id, 'batch:manage'));

-- ---------------------------------------------------------------------------
-- 5. enrollments — no policies existed. Org-member SELECT, staff manage
--    (trainee:manage — enrollment is part of the trainee lifecycle), and
--    self-enroll (a trainee creating their own enrollment row).
-- ---------------------------------------------------------------------------
create policy enrollments_select on public.enrollments
  for select using (exists (
    select 1 from public.trainees t
    where t.id = enrollments.trainee_id and coopsetu.is_org_member(t.organization_id)
  ));

create policy enrollments_manage on public.enrollments
  for all using (exists (
    select 1 from public.trainees t
    where t.id = enrollments.trainee_id and coopsetu.has_permission(t.organization_id, 'trainee:manage')
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = enrollments.trainee_id and coopsetu.has_permission(t.organization_id, 'trainee:manage')
  ));

create policy enrollments_self_insert on public.enrollments
  for insert with check (exists (
    select 1 from public.trainees t
    where t.id = enrollments.trainee_id and t.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 6. courses — SELECT already exists (via programmes); add staff-only write.
-- ---------------------------------------------------------------------------
create policy courses_manage on public.courses
  for all using (exists (
    select 1 from public.programmes p
    where p.id = courses.programme_id and coopsetu.has_permission(p.organization_id, 'course:manage')
  ))
  with check (exists (
    select 1 from public.programmes p
    where p.id = courses.programme_id and coopsetu.has_permission(p.organization_id, 'course:manage')
  ));

-- ---------------------------------------------------------------------------
-- 7. course_modules — no policies existed. Org-member SELECT (via
--    courses -> programmes), staff-only write.
-- ---------------------------------------------------------------------------
create policy course_modules_select on public.course_modules
  for select using (exists (
    select 1 from public.courses c
    join public.programmes p on p.id = c.programme_id
    where c.id = course_modules.course_id and coopsetu.is_org_member(p.organization_id)
  ));

create policy course_modules_manage on public.course_modules
  for all using (exists (
    select 1 from public.courses c
    join public.programmes p on p.id = c.programme_id
    where c.id = course_modules.course_id and coopsetu.has_permission(p.organization_id, 'course:manage')
  ))
  with check (exists (
    select 1 from public.courses c
    join public.programmes p on p.id = c.programme_id
    where c.id = course_modules.course_id and coopsetu.has_permission(p.organization_id, 'course:manage')
  ));

-- ---------------------------------------------------------------------------
-- 8. assessments — no policies existed. Org-member SELECT (via
--    courses -> programmes), staff-only write.
-- ---------------------------------------------------------------------------
create policy assessments_select on public.assessments
  for select using (exists (
    select 1 from public.courses c
    join public.programmes p on p.id = c.programme_id
    where c.id = assessments.course_id and coopsetu.is_org_member(p.organization_id)
  ));

create policy assessments_manage on public.assessments
  for all using (exists (
    select 1 from public.courses c
    join public.programmes p on p.id = c.programme_id
    where c.id = assessments.course_id and coopsetu.has_permission(p.organization_id, 'assessment:manage')
  ))
  with check (exists (
    select 1 from public.courses c
    join public.programmes p on p.id = c.programme_id
    where c.id = assessments.course_id and coopsetu.has_permission(p.organization_id, 'assessment:manage')
  ));

-- ---------------------------------------------------------------------------
-- 9. assessment_questions — no policies existed. Org-member SELECT (via
--    assessments -> courses -> programmes), staff-only write. Question text
--    and correct_answer are staff/exam content, not trainee-writable.
-- ---------------------------------------------------------------------------
create policy assessment_questions_select on public.assessment_questions
  for select using (exists (
    select 1 from public.assessments a
    join public.courses c on c.id = a.course_id
    join public.programmes p on p.id = c.programme_id
    where a.id = assessment_questions.assessment_id and coopsetu.is_org_member(p.organization_id)
  ));

create policy assessment_questions_manage on public.assessment_questions
  for all using (exists (
    select 1 from public.assessments a
    join public.courses c on c.id = a.course_id
    join public.programmes p on p.id = c.programme_id
    where a.id = assessment_questions.assessment_id and coopsetu.has_permission(p.organization_id, 'assessment:manage')
  ))
  with check (exists (
    select 1 from public.assessments a
    join public.courses c on c.id = a.course_id
    join public.programmes p on p.id = c.programme_id
    where a.id = assessment_questions.assessment_id and coopsetu.has_permission(p.organization_id, 'assessment:manage')
  ));

-- ---------------------------------------------------------------------------
-- 10. assessment_results — no policies existed. Org-member SELECT (matching
--     certificates' org-wide visibility convention, not owner-only), a
--     trainee submitting their own attempt, staff grading/managing any
--     result in their org.
-- ---------------------------------------------------------------------------
create policy assessment_results_select on public.assessment_results
  for select using (exists (
    select 1 from public.trainees t
    where t.id = assessment_results.trainee_id and coopsetu.is_org_member(t.organization_id)
  ));

create policy assessment_results_submit on public.assessment_results
  for insert with check (exists (
    select 1 from public.trainees t
    where t.id = assessment_results.trainee_id and t.user_id = (select auth.uid())
  ));

create policy assessment_results_manage on public.assessment_results
  for all using (exists (
    select 1 from public.trainees t
    where t.id = assessment_results.trainee_id and coopsetu.has_permission(t.organization_id, 'assessment:manage')
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = assessment_results.trainee_id and coopsetu.has_permission(t.organization_id, 'assessment:manage')
  ));

-- ---------------------------------------------------------------------------
-- 11. course_progress — no policies existed. Org-member SELECT, a trainee
--     tracking their own progress, staff managing any trainee's progress
--     (course:manage — progress is course-content-adjacent, not a separate
--     permission).
-- ---------------------------------------------------------------------------
create policy course_progress_select on public.course_progress
  for select using (exists (
    select 1 from public.trainees t
    where t.id = course_progress.trainee_id and coopsetu.is_org_member(t.organization_id)
  ));

create policy course_progress_self_manage on public.course_progress
  for all using (exists (
    select 1 from public.trainees t
    where t.id = course_progress.trainee_id and t.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = course_progress.trainee_id and t.user_id = (select auth.uid())
  ));

create policy course_progress_staff_manage on public.course_progress
  for all using (exists (
    select 1 from public.trainees t
    where t.id = course_progress.trainee_id and coopsetu.has_permission(t.organization_id, 'course:manage')
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = course_progress.trainee_id and coopsetu.has_permission(t.organization_id, 'course:manage')
  ));

-- ---------------------------------------------------------------------------
-- 12. attendance_sessions — no policies existed. Org-member SELECT (via
--     batches), staff-only write (trainers create/close sessions; trainees
--     never create a session, only records against one — see below).
-- ---------------------------------------------------------------------------
create policy attendance_sessions_select on public.attendance_sessions
  for select using (exists (
    select 1 from public.batches b
    where b.id = attendance_sessions.batch_id and coopsetu.is_org_member(b.organization_id)
  ));

create policy attendance_sessions_manage on public.attendance_sessions
  for all using (exists (
    select 1 from public.batches b
    where b.id = attendance_sessions.batch_id and coopsetu.has_permission(b.organization_id, 'attendance:manage')
  ))
  with check (exists (
    select 1 from public.batches b
    where b.id = attendance_sessions.batch_id and coopsetu.has_permission(b.organization_id, 'attendance:manage')
  ));

-- ---------------------------------------------------------------------------
-- 13. attendance_records — no policies existed. Org-member SELECT, a trainee
--     self-marking their own record (QR/face/hardware check-in flows already
--     in the app), staff marking/editing any record in their org.
-- ---------------------------------------------------------------------------
create policy attendance_records_select on public.attendance_records
  for select using (exists (
    select 1 from public.trainees t
    where t.id = attendance_records.trainee_id and coopsetu.is_org_member(t.organization_id)
  ));

create policy attendance_records_self_insert on public.attendance_records
  for insert with check (exists (
    select 1 from public.trainees t
    where t.id = attendance_records.trainee_id and t.user_id = (select auth.uid())
  ));

create policy attendance_records_manage on public.attendance_records
  for all using (exists (
    select 1 from public.trainees t
    where t.id = attendance_records.trainee_id and coopsetu.has_permission(t.organization_id, 'attendance:manage')
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = attendance_records.trainee_id and coopsetu.has_permission(t.organization_id, 'attendance:manage')
  ));

-- ---------------------------------------------------------------------------
-- 14. trainee_skills — no policies existed. Org-member SELECT, a trainee
--     self-declaring/updating their own skills, staff verifying/managing any
--     trainee's skills (trainee:manage — skill verification is part of
--     trainee management, not a separate permission).
-- ---------------------------------------------------------------------------
create policy trainee_skills_select on public.trainee_skills
  for select using (exists (
    select 1 from public.trainees t
    where t.id = trainee_skills.trainee_id and coopsetu.is_org_member(t.organization_id)
  ));

create policy trainee_skills_self_manage on public.trainee_skills
  for all using (exists (
    select 1 from public.trainees t
    where t.id = trainee_skills.trainee_id and t.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = trainee_skills.trainee_id and t.user_id = (select auth.uid())
  ));

create policy trainee_skills_staff_manage on public.trainee_skills
  for all using (exists (
    select 1 from public.trainees t
    where t.id = trainee_skills.trainee_id and coopsetu.has_permission(t.organization_id, 'trainee:manage')
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = trainee_skills.trainee_id and coopsetu.has_permission(t.organization_id, 'trainee:manage')
  ));

-- ---------------------------------------------------------------------------
-- 15. certificates — SELECT already exists; add staff-only write (issue,
--     revoke).
-- ---------------------------------------------------------------------------
create policy certificates_manage on public.certificates
  for all using (exists (
    select 1 from public.trainees t
    where t.id = certificates.trainee_id and coopsetu.has_permission(t.organization_id, 'certificate:manage')
  ))
  with check (exists (
    select 1 from public.trainees t
    where t.id = certificates.trainee_id and coopsetu.has_permission(t.organization_id, 'certificate:manage')
  ));

-- ---------------------------------------------------------------------------
-- 16. employers — SELECT already exists. This is a personal company profile,
--     not an organization-administered resource, so writes are
--     ownership-scoped (an EMPLOYER-role user manages only their own
--     company), with no new permission code — admin-tier already bypasses
--     via has_permission() if org staff ever need to moderate a listing
--     (0007's is_org_admin_or_owner precedent).
-- ---------------------------------------------------------------------------
create policy employers_self_insert on public.employers
  for insert with check (user_id = (select auth.uid()));

create policy employers_self_update on public.employers
  for update using (user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(organization_id))
  with check (user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(organization_id));

create policy employers_admin_delete on public.employers
  for delete using (coopsetu.is_org_admin_or_owner(organization_id));

-- ---------------------------------------------------------------------------
-- 17. jobs — SELECT already exists. An employer manages only their own job
--     postings; org admins can moderate any.
-- ---------------------------------------------------------------------------
create policy jobs_manage on public.jobs
  for all using (exists (
    select 1 from public.employers e
    where e.id = jobs.employer_id
      and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
  ))
  with check (exists (
    select 1 from public.employers e
    where e.id = jobs.employer_id
      and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
  ));

-- ---------------------------------------------------------------------------
-- 18. job_skills — no policies existed. Org-member SELECT (via
--     jobs -> employers), same ownership-scoped write as jobs itself.
-- ---------------------------------------------------------------------------
create policy job_skills_select on public.job_skills
  for select using (exists (
    select 1 from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.id = job_skills.job_id and coopsetu.is_org_member(e.organization_id)
  ));

create policy job_skills_manage on public.job_skills
  for all using (exists (
    select 1 from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.id = job_skills.job_id
      and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
  ))
  with check (exists (
    select 1 from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.id = job_skills.job_id
      and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
  ));

-- ---------------------------------------------------------------------------
-- 19. job_applications — no policies existed. A trainee sees and creates only
--     their own applications; the posting employer (or an org admin) sees and
--     manages applications to their own jobs. Neither side can see or touch
--     the other's unrelated applications.
-- ---------------------------------------------------------------------------
create policy job_applications_select on public.job_applications
  for select using (
    exists (
      select 1 from public.trainees t
      where t.id = job_applications.trainee_id and t.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.jobs j
      join public.employers e on e.id = j.employer_id
      where j.id = job_applications.job_id
        and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
    )
  );

create policy job_applications_self_insert on public.job_applications
  for insert with check (exists (
    select 1 from public.trainees t
    where t.id = job_applications.trainee_id and t.user_id = (select auth.uid())
  ));

create policy job_applications_employer_manage on public.job_applications
  for update using (exists (
    select 1 from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.id = job_applications.job_id
      and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
  ))
  with check (exists (
    select 1 from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.id = job_applications.job_id
      and (e.user_id = (select auth.uid()) or coopsetu.is_org_admin_or_owner(e.organization_id))
  ));

commit;
