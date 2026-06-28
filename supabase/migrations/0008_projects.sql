-- ============================================================================
-- Handoff — 0008 Portfolios, Programs, Projects, Milestones, Risks
-- ============================================================================

create table if not exists public.portfolios (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  description       text,
  owner_member_id   uuid references public.organization_members(id) on delete set null,
  status            text not null default 'ACTIVE',
  health            text not null default 'ON_TRACK' check (health in ('ON_TRACK','AT_RISK','OFF_TRACK')),
  target_start_date date,
  target_end_date   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select handoff.attach_updated_at('public.portfolios');
create index if not exists portfolios_org_idx on public.portfolios(organization_id);

create table if not exists public.programs (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  portfolio_id       uuid references public.portfolios(id) on delete set null,
  name               text not null,
  description        text,
  program_manager_id uuid references public.organization_members(id) on delete set null,
  status             text not null default 'ACTIVE',
  health             text not null default 'ON_TRACK' check (health in ('ON_TRACK','AT_RISK','OFF_TRACK')),
  target_start_date  date,
  target_end_date    date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
select handoff.attach_updated_at('public.programs');
create index if not exists programs_org_idx on public.programs(organization_id);

create table if not exists public.projects (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations(id) on delete cascade,
  portfolio_id               uuid references public.portfolios(id) on delete set null,
  program_id                 uuid references public.programs(id) on delete set null,
  name                       text not null,
  code                       text not null,
  description                text,
  business_objective         text,
  scope                      text,
  owner_member_id            uuid references public.organization_members(id) on delete set null,
  project_manager_member_id  uuid references public.organization_members(id) on delete set null,
  status                     text not null default 'ACTIVE'
    check (status in ('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED')),
  health                     text not null default 'ON_TRACK' check (health in ('ON_TRACK','AT_RISK','OFF_TRACK')),
  priority                   text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  security_classification    text not null default 'INTERNAL'
    check (security_classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  start_date                 date,
  target_end_date            date,
  actual_end_date            date,
  budget_amount              numeric,
  effort_estimate_hours      numeric,
  archived_at                timestamptz,
  archived_by                uuid references public.organization_members(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (organization_id, code)
);
select handoff.attach_updated_at('public.projects');
create index if not exists projects_org_idx on public.projects(organization_id);
create index if not exists projects_status_idx on public.projects(organization_id, status);

create table if not exists public.project_members (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  project_role           text,
  can_view               boolean not null default true,
  can_comment            boolean not null default true,
  can_edit               boolean not null default false,
  can_manage             boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (project_id, organization_member_id)
);
select handoff.attach_updated_at('public.project_members');
create index if not exists project_members_project_idx on public.project_members(project_id);
create index if not exists project_members_member_idx on public.project_members(organization_member_id);

create table if not exists public.project_teams (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  team_id            uuid not null references public.teams(id) on delete cascade,
  allocation_percent numeric not null default 100,
  unique (project_id, team_id)
);

create table if not exists public.milestones (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  due_date        date,
  status          text not null default 'PLANNED'
    check (status in ('PLANNED','IN_PROGRESS','COMPLETED','MISSED')),
  owner_member_id uuid references public.organization_members(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.milestones');
create index if not exists milestones_project_idx on public.milestones(project_id);

create table if not exists public.project_risks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  risk_level      text not null default 'MEDIUM' check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  probability     text not null default 'MEDIUM' check (probability in ('LOW','MEDIUM','HIGH')),
  impact          text not null default 'MEDIUM' check (impact in ('LOW','MEDIUM','HIGH')),
  status          text not null default 'OPEN' check (status in ('OPEN','MITIGATING','CLOSED','ACCEPTED')),
  owner_member_id uuid references public.organization_members(id) on delete set null,
  mitigation_plan text,
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.project_risks');
create index if not exists project_risks_project_idx on public.project_risks(project_id);

create table if not exists public.project_dependencies (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  depends_on_project_id uuid not null references public.projects(id) on delete cascade,
  dependency_type       text not null default 'BLOCKS',
  notes                 text,
  status                text not null default 'OPEN',
  created_at            timestamptz not null default now(),
  check (project_id <> depends_on_project_id)
);

create table if not exists public.project_activity (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  actor_member_id uuid references public.organization_members(id) on delete set null,
  activity_type   text not null,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists project_activity_project_idx on public.project_activity(project_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Project access helper functions (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
create or replace function handoff.project_org(p_project uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.projects where id = p_project;
$$;

-- A user can view a project if: they have org-wide project:view AND are an
-- explicit project member OR hold a broad role (admin/PM/exec/auditor). Client
-- viewers must be explicit project members.
create or replace function handoff.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with p as (select organization_id from public.projects where id = p_project)
  select exists (select 1 from p)
    and handoff.is_org_member((select organization_id from p))
    and (
      handoff.has_role((select organization_id from p),
        array['SUPER_ADMIN','ORG_ADMIN','CEO','CTO','PROJECT_MANAGER',
              'ENGINEERING_MANAGER','AUDITOR','COMPLIANCE_REVIEWER'])
      or exists (
        select 1 from public.project_members pm
        join public.organization_members m on m.id = pm.organization_member_id
        where pm.project_id = p_project and m.user_id = auth.uid()
          and m.is_active and pm.can_view
      )
    );
$$;

create or replace function handoff.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members pm
    join public.organization_members m on m.id = pm.organization_member_id
    where pm.project_id = p_project and m.user_id = auth.uid() and m.is_active
  );
$$;

create or replace function handoff.can_manage_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with p as (select organization_id from public.projects where id = p_project)
  select exists (select 1 from p)
    and (
      handoff.has_role((select organization_id from p),
        array['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','ENGINEERING_MANAGER'])
      or exists (
        select 1 from public.project_members pm
        join public.organization_members m on m.id = pm.organization_member_id
        where pm.project_id = p_project and m.user_id = auth.uid()
          and m.is_active and pm.can_manage
      )
    );
$$;

-- ---------------------------------------------------------------- RLS --------
alter table public.portfolios           enable row level security;
alter table public.programs             enable row level security;
alter table public.projects             enable row level security;
alter table public.project_members      enable row level security;
alter table public.project_teams        enable row level security;
alter table public.milestones           enable row level security;
alter table public.project_risks        enable row level security;
alter table public.project_dependencies enable row level security;
alter table public.project_activity     enable row level security;

create policy portfolios_select on public.portfolios
  for select using (handoff.is_org_member(organization_id));
create policy portfolios_manage on public.portfolios
  for all using (handoff.has_permission(organization_id,'project:create'))
  with check (handoff.has_permission(organization_id,'project:create'));

create policy programs_select on public.programs
  for select using (handoff.is_org_member(organization_id));
create policy programs_manage on public.programs
  for all using (handoff.has_permission(organization_id,'project:create'))
  with check (handoff.has_permission(organization_id,'project:create'));

create policy projects_select on public.projects
  for select using (handoff.can_view_project(id));
create policy projects_insert on public.projects
  for insert with check (handoff.has_permission(organization_id,'project:create'));
create policy projects_update on public.projects
  for update using (handoff.can_manage_project(id))
  with check (handoff.can_manage_project(id));

create policy project_members_select on public.project_members
  for select using (handoff.can_view_project(project_id));
create policy project_members_manage on public.project_members
  for all using (handoff.can_manage_project(project_id))
  with check (handoff.can_manage_project(project_id));

create policy project_teams_select on public.project_teams
  for select using (handoff.can_view_project(project_id));
create policy project_teams_manage on public.project_teams
  for all using (handoff.can_manage_project(project_id))
  with check (handoff.can_manage_project(project_id));

create policy milestones_select on public.milestones
  for select using (handoff.can_view_project(project_id));
create policy milestones_manage on public.milestones
  for all using (handoff.can_manage_project(project_id))
  with check (handoff.can_manage_project(project_id));

create policy risks_select on public.project_risks
  for select using (handoff.can_view_project(project_id));
create policy risks_manage on public.project_risks
  for all using (handoff.can_manage_project(project_id))
  with check (handoff.can_manage_project(project_id));

create policy deps_select on public.project_dependencies
  for select using (handoff.can_view_project(project_id));
create policy deps_manage on public.project_dependencies
  for all using (handoff.can_manage_project(project_id))
  with check (handoff.can_manage_project(project_id));

create policy activity_select on public.project_activity
  for select using (handoff.can_view_project(project_id));
create policy activity_insert on public.project_activity
  for insert with check (handoff.can_view_project(project_id));
