-- ============================================================================
-- Handoff — 0011 QA, Bugs, Security, Compliance, Approvals, Releases, Deploys
-- ============================================================================

-- ----------------------------------------------------------------- releases --
create table if not exists public.environments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  environment_type text not null default 'DEVELOPMENT'
    check (environment_type in ('DEVELOPMENT','TESTING','STAGING','UAT','PRODUCTION')),
  description      text,
  is_production    boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.releases (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations(id) on delete cascade,
  project_id                  uuid not null references public.projects(id) on delete cascade,
  name                        text not null,
  version                     text not null,
  description                 text,
  status                      text not null default 'DRAFT'
    check (status in ('DRAFT','DEVELOPMENT_COMPLETE','CODE_REVIEW_COMPLETE','QA_PENDING','QA_APPROVED',
      'SECURITY_PENDING','SECURITY_APPROVED','COMPLIANCE_PENDING','COMPLIANCE_APPROVED',
      'RELEASE_MANAGER_PENDING','APPROVED_FOR_DEPLOYMENT','DEPLOYING','DEPLOYED','ROLLED_BACK','BLOCKED')),
  release_manager_member_id   uuid references public.organization_members(id) on delete set null,
  planned_release_at          timestamptz,
  released_at                 timestamptz,
  requires_compliance_approval boolean not null default false,
  rollback_plan               text,
  release_notes               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
select handoff.attach_updated_at('public.releases');
create index if not exists releases_project_idx on public.releases(project_id);

create table if not exists public.release_approvals (
  id                  uuid primary key default gen_random_uuid(),
  release_id          uuid not null references public.releases(id) on delete cascade,
  approval_type       text not null check (approval_type in ('QA','SECURITY','COMPLIANCE','RELEASE_MANAGER')),
  required_role       text,
  status              text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_at        timestamptz not null default now(),
  decided_at          timestamptz,
  approved_by_member_id uuid references public.organization_members(id) on delete set null,
  comment             text,
  unique (release_id, approval_type)
);

create table if not exists public.deployments (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  project_id               uuid not null references public.projects(id) on delete cascade,
  release_id               uuid not null references public.releases(id) on delete cascade,
  environment_id           uuid references public.environments(id) on delete set null,
  version                  text,
  status                   text not null default 'PENDING'
    check (status in ('PENDING','DEPLOYING','DEPLOYED','FAILED','ROLLED_BACK')),
  triggered_by_member_id   uuid references public.organization_members(id) on delete set null,
  started_at               timestamptz not null default now(),
  completed_at             timestamptz,
  rollback_of_deployment_id uuid references public.deployments(id) on delete set null,
  logs_summary             text
);
create index if not exists deployments_release_idx on public.deployments(release_id);

-- ----------------------------------------------------------- approvals (gen) --
create table if not exists public.approval_requests (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  project_id          uuid references public.projects(id) on delete cascade,
  task_id             uuid references public.tasks(id) on delete cascade,
  release_id          uuid references public.releases(id) on delete cascade,
  approval_type       text not null,
  requested_by_member_id uuid references public.organization_members(id) on delete set null,
  status              text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  required_role       text,
  due_date            date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
select handoff.attach_updated_at('public.approval_requests');
create index if not exists approval_requests_org_idx on public.approval_requests(organization_id, status);

create table if not exists public.approvals (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  approver_member_id  uuid references public.organization_members(id) on delete set null,
  decision            text not null check (decision in ('APPROVED','REJECTED')),
  comment             text,
  decided_at          timestamptz not null default now()
);

-- ------------------------------------------------------------------- QA -------
create table if not exists public.test_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  release_id      uuid references public.releases(id) on delete set null,
  title           text not null,
  description     text,
  owner_member_id uuid references public.organization_members(id) on delete set null,
  status          text not null default 'DRAFT',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.test_plans');

create table if not exists public.test_cases (
  id             uuid primary key default gen_random_uuid(),
  test_plan_id   uuid not null references public.test_plans(id) on delete cascade,
  title          text not null,
  description    text,
  preconditions  text,
  steps          jsonb not null default '[]'::jsonb,
  expected_result text,
  priority       text not null default 'MEDIUM',
  linked_task_id uuid references public.tasks(id) on delete set null
);

create table if not exists public.test_runs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  test_plan_id        uuid not null references public.test_plans(id) on delete cascade,
  executed_by_member_id uuid references public.organization_members(id) on delete set null,
  environment_id      uuid references public.environments(id) on delete set null,
  status              text not null default 'IN_PROGRESS',
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create table if not exists public.test_run_results (
  id                   uuid primary key default gen_random_uuid(),
  test_run_id          uuid not null references public.test_runs(id) on delete cascade,
  test_case_id         uuid not null references public.test_cases(id) on delete cascade,
  status               text not null default 'PENDING' check (status in ('PENDING','PASSED','FAILED','BLOCKED','SKIPPED')),
  actual_result        text,
  executed_by_member_id uuid references public.organization_members(id) on delete set null
);

create table if not exists public.bugs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  project_id          uuid not null references public.projects(id) on delete cascade,
  task_id             uuid references public.tasks(id) on delete set null,
  release_id          uuid references public.releases(id) on delete set null,
  title               text not null,
  description         text,
  severity            text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  priority            text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  status              text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED','WONT_FIX')),
  environment         text,
  reporter_member_id  uuid references public.organization_members(id) on delete set null,
  assignee_member_id  uuid references public.organization_members(id) on delete set null,
  steps_to_reproduce  text,
  expected_result     text,
  actual_result       text,
  root_cause          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
select handoff.attach_updated_at('public.bugs');
create index if not exists bugs_project_idx on public.bugs(project_id, status);

-- ------------------------------------------------------------- security ------
create table if not exists public.security_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  release_id      uuid references public.releases(id) on delete set null,
  title           text not null,
  status          text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','APPROVED','REJECTED')),
  risk_score      int,
  reviewer_member_id uuid references public.organization_members(id) on delete set null,
  due_date        date,
  summary         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.security_reviews');

create table if not exists public.security_review_checks (
  id                 uuid primary key default gen_random_uuid(),
  security_review_id uuid not null references public.security_reviews(id) on delete cascade,
  check_name         text not null,
  status             text not null default 'PENDING' check (status in ('PENDING','PASSED','FAILED','NA')),
  notes              text,
  reviewed_by        uuid references public.organization_members(id) on delete set null,
  reviewed_at        timestamptz
);

create table if not exists public.security_findings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  security_review_id  uuid references public.security_reviews(id) on delete cascade,
  project_id          uuid not null references public.projects(id) on delete cascade,
  title               text not null,
  description         text,
  severity            text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  status              text not null default 'OPEN' check (status in ('OPEN','MITIGATING','RESOLVED','ACCEPTED')),
  owner_member_id     uuid references public.organization_members(id) on delete set null,
  remediation_task_id uuid references public.tasks(id) on delete set null,
  due_date            date,
  created_at          timestamptz not null default now()
);
create index if not exists security_findings_project_idx on public.security_findings(project_id, status);

-- ----------------------------------------------------------- compliance ------
create table if not exists public.compliance_controls (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  framework_name  text,
  description     text,
  owner_member_id uuid references public.organization_members(id) on delete set null,
  status          text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','IN_PROGRESS','COMPLIANT','NON_COMPLIANT')),
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.compliance_controls');

create table if not exists public.compliance_evidence (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  compliance_control_id uuid not null references public.compliance_controls(id) on delete cascade,
  attachment_id         uuid references public.attachments(id) on delete set null,
  document_id           uuid,
  description           text,
  submitted_by_member_id uuid references public.organization_members(id) on delete set null,
  status                text not null default 'SUBMITTED',
  reviewed_by_member_id uuid references public.organization_members(id) on delete set null,
  created_at            timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Release gating: is a release allowed to deploy?
-- All required approvals (QA, SECURITY, RELEASE_MANAGER, + COMPLIANCE if
-- required) must be APPROVED. SECURITY DEFINER so it can read approvals safely.
-- ----------------------------------------------------------------------------
create or replace function public.release_can_deploy(p_release uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with r as (select requires_compliance_approval from public.releases where id = p_release),
  required as (
    select unnest(
      case when (select requires_compliance_approval from r)
        then array['QA','SECURITY','COMPLIANCE','RELEASE_MANAGER']
        else array['QA','SECURITY','RELEASE_MANAGER']
      end) as t
  )
  select exists (select 1 from r) and not exists (
    select 1 from required req
    where not exists (
      select 1 from public.release_approvals ra
      where ra.release_id = p_release and ra.approval_type = req.t and ra.status = 'APPROVED'
    )
  );
$$;
grant execute on function public.release_can_deploy(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS --------
do $$
declare t text;
begin
  foreach t in array array[
    'environments','releases','release_approvals','deployments','approval_requests','approvals',
    'test_plans','test_cases','test_runs','test_run_results','bugs',
    'security_reviews','security_review_checks','security_findings',
    'compliance_controls','compliance_evidence'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Org-scoped tables: view if org member, manage by permission.
create policy environments_select on public.environments for select using (handoff.is_org_member(organization_id));
create policy environments_manage on public.environments for all
  using (handoff.has_permission(organization_id,'integration:manage'))
  with check (handoff.has_permission(organization_id,'integration:manage'));

create policy releases_select on public.releases for select using (handoff.can_view_project(project_id));
create policy releases_insert on public.releases for insert with check (handoff.has_permission(organization_id,'release:create'));
create policy releases_update on public.releases for update
  using (handoff.has_permission(organization_id,'release:create') or handoff.has_permission(organization_id,'release:approve'))
  with check (handoff.is_org_member(organization_id));

create policy rel_appr_select on public.release_approvals for select
  using (exists (select 1 from public.releases r where r.id = release_id and handoff.can_view_project(r.project_id)));
create policy rel_appr_manage on public.release_approvals for all
  using (exists (select 1 from public.releases r where r.id = release_id and handoff.is_org_member(r.organization_id)))
  with check (exists (select 1 from public.releases r where r.id = release_id and handoff.is_org_member(r.organization_id)));

create policy deployments_select on public.deployments for select using (handoff.can_view_project(project_id));
create policy deployments_manage on public.deployments for all
  using (handoff.has_permission(organization_id,'release:deploy'))
  with check (handoff.has_permission(organization_id,'release:deploy'));

create policy appr_req_select on public.approval_requests for select using (handoff.is_org_member(organization_id));
create policy appr_req_manage on public.approval_requests for all
  using (handoff.has_permission(organization_id,'approval:create') or handoff.has_permission(organization_id,'approval:decide'))
  with check (handoff.is_org_member(organization_id));

create policy approvals_select on public.approvals for select using (handoff.is_org_member(organization_id));
create policy approvals_insert on public.approvals for insert
  with check (handoff.has_permission(organization_id,'approval:decide'));

-- Project-scoped governance tables
create policy test_plans_select on public.test_plans for select using (handoff.can_view_project(project_id));
create policy test_plans_manage on public.test_plans for all
  using (handoff.can_view_project(project_id) and handoff.has_permission(organization_id,'task:update'))
  with check (handoff.can_view_project(project_id));

create policy test_cases_select on public.test_cases for select
  using (exists (select 1 from public.test_plans tp where tp.id = test_plan_id and handoff.can_view_project(tp.project_id)));
create policy test_cases_manage on public.test_cases for all
  using (exists (select 1 from public.test_plans tp where tp.id = test_plan_id and handoff.can_view_project(tp.project_id)))
  with check (exists (select 1 from public.test_plans tp where tp.id = test_plan_id and handoff.can_view_project(tp.project_id)));

create policy test_runs_select on public.test_runs for select using (handoff.is_org_member(organization_id));
create policy test_runs_manage on public.test_runs for all
  using (handoff.has_permission(organization_id,'task:update')) with check (handoff.is_org_member(organization_id));

create policy test_results_select on public.test_run_results for select
  using (exists (select 1 from public.test_runs tr where tr.id = test_run_id and handoff.is_org_member(tr.organization_id)));
create policy test_results_manage on public.test_run_results for all
  using (exists (select 1 from public.test_runs tr where tr.id = test_run_id and handoff.has_permission(tr.organization_id,'task:update')))
  with check (exists (select 1 from public.test_runs tr where tr.id = test_run_id and handoff.is_org_member(tr.organization_id)));

create policy bugs_select on public.bugs for select using (handoff.can_view_project(project_id));
create policy bugs_manage on public.bugs for all
  using (handoff.can_view_project(project_id)) with check (handoff.can_view_project(project_id));

create policy sec_reviews_select on public.security_reviews for select using (handoff.can_view_project(project_id));
create policy sec_reviews_manage on public.security_reviews for all
  using (handoff.has_permission(organization_id,'security:review'))
  with check (handoff.has_permission(organization_id,'security:review'));

create policy sec_checks_select on public.security_review_checks for select
  using (exists (select 1 from public.security_reviews sr where sr.id = security_review_id and handoff.can_view_project(sr.project_id)));
create policy sec_checks_manage on public.security_review_checks for all
  using (exists (select 1 from public.security_reviews sr where sr.id = security_review_id and handoff.has_permission(sr.organization_id,'security:review')))
  with check (exists (select 1 from public.security_reviews sr where sr.id = security_review_id and handoff.has_permission(sr.organization_id,'security:review')));

create policy sec_findings_select on public.security_findings for select using (handoff.can_view_project(project_id));
create policy sec_findings_manage on public.security_findings for all
  using (handoff.has_permission(organization_id,'security:review'))
  with check (handoff.has_permission(organization_id,'security:review'));

create policy compliance_select on public.compliance_controls for select using (handoff.is_org_member(organization_id));
create policy compliance_manage on public.compliance_controls for all
  using (handoff.has_permission(organization_id,'document:approve') or handoff.has_role(organization_id, array['COMPLIANCE_REVIEWER','ORG_ADMIN','SUPER_ADMIN']))
  with check (handoff.is_org_member(organization_id));

create policy compliance_ev_select on public.compliance_evidence for select using (handoff.is_org_member(organization_id));
create policy compliance_ev_manage on public.compliance_evidence for all
  using (handoff.is_org_member(organization_id)) with check (handoff.is_org_member(organization_id));

alter publication supabase_realtime add table public.releases;
alter publication supabase_realtime add table public.release_approvals;
alter publication supabase_realtime add table public.deployments;
alter publication supabase_realtime add table public.approval_requests;
