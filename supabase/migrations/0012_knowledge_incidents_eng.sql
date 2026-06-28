-- ============================================================================
-- Handoff — 0012 Documents, Incidents, Engineering integrations, AI records
-- ============================================================================

-- ------------------------------------------------------------- documents -----
create table if not exists public.documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  project_id          uuid references public.projects(id) on delete cascade,
  title               text not null,
  slug                text,
  document_type       text not null default 'TEAM_NOTE',
  content_markdown    text not null default '',
  classification      text not null default 'INTERNAL'
    check (classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  status              text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','APPROVED','ARCHIVED')),
  owner_member_id     uuid references public.organization_members(id) on delete set null,
  approved_by_member_id uuid references public.organization_members(id) on delete set null,
  approved_at         timestamptz,
  current_version     int not null default 1,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
select handoff.attach_updated_at('public.documents');
create index if not exists documents_org_idx on public.documents(organization_id);

create table if not exists public.document_versions (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.documents(id) on delete cascade,
  version_number    int not null,
  content_markdown  text not null,
  created_by_member_id uuid references public.organization_members(id) on delete set null,
  change_summary    text,
  created_at        timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists public.document_links (
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  primary key (document_id, entity_type, entity_id)
);

create table if not exists public.document_comments (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.documents(id) on delete cascade,
  author_member_id uuid not null references public.organization_members(id) on delete cascade,
  body             text not null,
  parent_comment_id uuid references public.document_comments(id) on delete cascade,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------- incidents -----
create table if not exists public.incidents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  project_id          uuid references public.projects(id) on delete set null,
  release_id          uuid references public.releases(id) on delete set null,
  title               text not null,
  severity            text not null default 'SEV3' check (severity in ('SEV1','SEV2','SEV3','SEV4')),
  status              text not null default 'OPEN' check (status in ('OPEN','INVESTIGATING','IDENTIFIED','MONITORING','RESOLVED')),
  incident_commander_member_id uuid references public.organization_members(id) on delete set null,
  affected_services   jsonb not null default '[]'::jsonb,
  customer_impact     text,
  started_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  summary             text,
  root_cause          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
select handoff.attach_updated_at('public.incidents');
create index if not exists incidents_org_idx on public.incidents(organization_id, status);

create table if not exists public.incident_timeline_events (
  id              uuid primary key default gen_random_uuid(),
  incident_id     uuid not null references public.incidents(id) on delete cascade,
  actor_member_id uuid references public.organization_members(id) on delete set null,
  event_type      text not null default 'UPDATE',
  message         text not null,
  occurred_at     timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb
);
create index if not exists incident_timeline_idx on public.incident_timeline_events(incident_id, occurred_at);

create table if not exists public.incident_participants (
  incident_id            uuid not null references public.incidents(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  role                   text,
  primary key (incident_id, organization_member_id)
);

create table if not exists public.postmortems (
  id              uuid primary key default gen_random_uuid(),
  incident_id     uuid not null references public.incidents(id) on delete cascade unique,
  summary         text,
  detection       text,
  impact          text,
  root_cause      text,
  response        text,
  resolution      text,
  lessons_learned text,
  status          text not null default 'DRAFT',
  author_member_id uuid references public.organization_members(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.postmortems');

create table if not exists public.incident_followups (
  id              uuid primary key default gen_random_uuid(),
  incident_id     uuid not null references public.incidents(id) on delete cascade,
  task_id         uuid references public.tasks(id) on delete set null,
  title           text not null,
  owner_member_id uuid references public.organization_members(id) on delete set null,
  due_date        date,
  status          text not null default 'OPEN'
);

-- ------------------------------------------------ engineering integrations ----
create table if not exists public.integrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider        text not null,
  display_name    text,
  status          text not null default 'MOCK_CONNECTED',
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider)
);
select handoff.attach_updated_at('public.integrations');

create table if not exists public.repositories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id  uuid references public.integrations(id) on delete set null,
  name            text not null,
  provider        text not null default 'github',
  default_branch  text not null default 'main',
  url             text,
  status          text not null default 'ACTIVE',
  created_at      timestamptz not null default now()
);
create index if not exists repositories_org_idx on public.repositories(organization_id);

create table if not exists public.pull_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repository_id   uuid not null references public.repositories(id) on delete cascade,
  external_id     text,
  title           text not null,
  author_member_id uuid references public.organization_members(id) on delete set null,
  status          text not null default 'OPEN' check (status in ('OPEN','MERGED','CLOSED','DRAFT')),
  source_branch   text,
  target_branch   text,
  linked_task_id  uuid references public.tasks(id) on delete set null,
  build_status    text,
  test_status     text,
  risk_level      text,
  opened_at       timestamptz not null default now(),
  merged_at       timestamptz
);
create index if not exists pull_requests_repo_idx on public.pull_requests(repository_id);

create table if not exists public.commits (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repository_id   uuid not null references public.repositories(id) on delete cascade,
  external_hash   text,
  message         text,
  author_member_id uuid references public.organization_members(id) on delete set null,
  branch          text,
  linked_task_id  uuid references public.tasks(id) on delete set null,
  committed_at    timestamptz not null default now()
);

create table if not exists public.ci_pipelines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repository_id   uuid not null references public.repositories(id) on delete cascade,
  external_id     text,
  branch          text,
  status          text not null default 'RUNNING' check (status in ('QUEUED','RUNNING','PASSED','FAILED','CANCELLED')),
  triggered_by_member_id uuid references public.organization_members(id) on delete set null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table if not exists public.ci_jobs (
  id               uuid primary key default gen_random_uuid(),
  pipeline_id      uuid not null references public.ci_pipelines(id) on delete cascade,
  name             text not null,
  status           text not null default 'RUNNING',
  duration_seconds int,
  logs_summary     text
);

-- ------------------------------------------------------------------- AI -------
create table if not exists public.ai_settings (
  organization_id        uuid primary key references public.organizations(id) on delete cascade,
  provider_mode          text not null default 'mock',
  allow_project_data     boolean not null default true,
  allow_document_data    boolean not null default true,
  allow_repository_data  boolean not null default true,
  require_source_citations boolean not null default true,
  log_prompts            boolean not null default true,
  allow_restricted_data  boolean not null default false,
  updated_at             timestamptz not null default now()
);
select handoff.attach_updated_at('public.ai_settings');

create table if not exists public.ai_requests (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  requester_member_id uuid references public.organization_members(id) on delete set null,
  project_id         uuid references public.projects(id) on delete set null,
  task_id            uuid references public.tasks(id) on delete set null,
  request_type       text not null,
  prompt             text not null,
  response           text,
  provider_mode      text not null default 'mock',
  status             text not null default 'COMPLETED',
  created_at         timestamptz not null default now()
);
create index if not exists ai_requests_org_idx on public.ai_requests(organization_id, created_at desc);

create table if not exists public.ai_sources (
  id            uuid primary key default gen_random_uuid(),
  ai_request_id uuid not null references public.ai_requests(id) on delete cascade,
  source_type   text not null,
  source_id     uuid,
  source_title  text
);

-- ---------------------------------------------------------------- RLS --------
do $$
declare t text;
begin
  foreach t in array array[
    'documents','document_versions','document_links','document_comments',
    'incidents','incident_timeline_events','incident_participants','postmortems','incident_followups',
    'integrations','repositories','pull_requests','commits','ci_pipelines','ci_jobs',
    'ai_settings','ai_requests','ai_sources'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- documents: restricted docs need project access; others visible to org members
create policy documents_select on public.documents for select using (
  handoff.is_org_member(organization_id)
  and (classification <> 'RESTRICTED' or project_id is null or handoff.can_view_project(project_id))
);
create policy documents_insert on public.documents for insert
  with check (handoff.has_permission(organization_id,'document:create'));
create policy documents_update on public.documents for update
  using (handoff.has_permission(organization_id,'document:update') or handoff.has_permission(organization_id,'document:approve'))
  with check (handoff.is_org_member(organization_id));

create policy doc_versions_select on public.document_versions for select
  using (exists (select 1 from public.documents d where d.id = document_id and handoff.is_org_member(d.organization_id)));
create policy doc_versions_insert on public.document_versions for insert
  with check (exists (select 1 from public.documents d where d.id = document_id and handoff.has_permission(d.organization_id,'document:update')));

create policy doc_links_all on public.document_links for all
  using (exists (select 1 from public.documents d where d.id = document_id and handoff.is_org_member(d.organization_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and handoff.is_org_member(d.organization_id)));

create policy doc_comments_select on public.document_comments for select
  using (exists (select 1 from public.documents d where d.id = document_id and handoff.is_org_member(d.organization_id)));
create policy doc_comments_insert on public.document_comments for insert
  with check (exists (select 1 from public.documents d
    join public.organization_members m on m.id = author_member_id
    where d.id = document_id and m.user_id = auth.uid() and handoff.is_org_member(d.organization_id)));

-- incidents: org members can view; manage by task:update-ish (incidents broadly visible in ops)
create policy incidents_select on public.incidents for select using (handoff.is_org_member(organization_id));
create policy incidents_manage on public.incidents for all
  using (handoff.is_org_member(organization_id)) with check (handoff.is_org_member(organization_id));

create policy inc_timeline_select on public.incident_timeline_events for select
  using (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)));
create policy inc_timeline_insert on public.incident_timeline_events for insert
  with check (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)));

create policy inc_part_all on public.incident_participants for all
  using (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)))
  with check (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)));

create policy postmortems_all on public.postmortems for all
  using (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)))
  with check (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)));

create policy inc_followups_all on public.incident_followups for all
  using (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)))
  with check (exists (select 1 from public.incidents i where i.id = incident_id and handoff.is_org_member(i.organization_id)));

-- engineering: view if org member; manage by integration:manage
create policy integrations_select on public.integrations for select using (handoff.is_org_member(organization_id));
create policy integrations_manage on public.integrations for all
  using (handoff.has_permission(organization_id,'integration:manage'))
  with check (handoff.has_permission(organization_id,'integration:manage'));

create policy repos_select on public.repositories for select using (handoff.is_org_member(organization_id));
create policy repos_manage on public.repositories for all
  using (handoff.has_permission(organization_id,'integration:manage'))
  with check (handoff.has_permission(organization_id,'integration:manage'));

create policy prs_select on public.pull_requests for select using (handoff.is_org_member(organization_id));
create policy prs_manage on public.pull_requests for all
  using (handoff.has_permission(organization_id,'integration:manage'))
  with check (handoff.is_org_member(organization_id));

create policy commits_select on public.commits for select using (handoff.is_org_member(organization_id));
create policy commits_manage on public.commits for all
  using (handoff.has_permission(organization_id,'integration:manage'))
  with check (handoff.is_org_member(organization_id));

create policy pipelines_select on public.ci_pipelines for select using (handoff.is_org_member(organization_id));
create policy pipelines_manage on public.ci_pipelines for all
  using (handoff.has_permission(organization_id,'integration:manage'))
  with check (handoff.is_org_member(organization_id));

create policy ci_jobs_select on public.ci_jobs for select
  using (exists (select 1 from public.ci_pipelines p where p.id = pipeline_id and handoff.is_org_member(p.organization_id)));
create policy ci_jobs_manage on public.ci_jobs for all
  using (exists (select 1 from public.ci_pipelines p where p.id = pipeline_id and handoff.has_permission(p.organization_id,'integration:manage')))
  with check (exists (select 1 from public.ci_pipelines p where p.id = pipeline_id and handoff.is_org_member(p.organization_id)));

-- AI
create policy ai_settings_select on public.ai_settings for select using (handoff.is_org_member(organization_id));
create policy ai_settings_manage on public.ai_settings for all
  using (handoff.has_permission(organization_id,'organization:manage'))
  with check (handoff.has_permission(organization_id,'organization:manage'));

create policy ai_requests_select on public.ai_requests for select
  using (handoff.is_org_member(organization_id) and exists (
    select 1 from public.organization_members m where m.id = requester_member_id and m.user_id = auth.uid()));
create policy ai_requests_insert on public.ai_requests for insert
  with check (handoff.has_permission(organization_id,'ai:use')
    and exists (select 1 from public.organization_members m where m.id = requester_member_id and m.user_id = auth.uid()));

create policy ai_sources_select on public.ai_sources for select
  using (exists (select 1 from public.ai_requests r where r.id = ai_request_id and handoff.is_org_member(r.organization_id)));
create policy ai_sources_insert on public.ai_sources for insert
  with check (exists (select 1 from public.ai_requests r where r.id = ai_request_id and handoff.is_org_member(r.organization_id)));

alter publication supabase_realtime add table public.incidents;
alter publication supabase_realtime add table public.incident_timeline_events;
