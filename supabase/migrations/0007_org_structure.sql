-- ============================================================================
-- Handoff — 0007 Departments, Teams, Skills, Employee data
-- ============================================================================

create table if not exists public.departments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  code            text,
  head_member_id  uuid references public.organization_members(id) on delete set null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);
select handoff.attach_updated_at('public.departments');
create index if not exists departments_org_idx on public.departments(organization_id);

-- org members get their FK to departments now that the table exists
alter table public.organization_members
  drop constraint if exists organization_members_department_fk;
alter table public.organization_members
  add constraint organization_members_department_fk
  foreign key (department_id) references public.departments(id) on delete set null;

create table if not exists public.teams (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  department_id           uuid references public.departments(id) on delete set null,
  name                    text not null,
  code                    text,
  description             text,
  team_lead_member_id     uuid references public.organization_members(id) on delete set null,
  capacity_hours_per_week numeric not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (organization_id, name)
);
select handoff.attach_updated_at('public.teams');
create index if not exists teams_org_idx on public.teams(organization_id);

create table if not exists public.team_members (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references public.teams(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  role_in_team           text,
  allocation_percent     numeric not null default 100 check (allocation_percent between 0 and 100),
  joined_at              timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (team_id, organization_member_id)
);
select handoff.attach_updated_at('public.team_members');
create index if not exists team_members_team_idx on public.team_members(team_id);
create index if not exists team_members_member_idx on public.team_members(organization_member_id);

create table if not exists public.skills (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name            text not null,
  category        text,
  created_at      timestamptz not null default now()
);
create index if not exists skills_org_idx on public.skills(organization_id);

create table if not exists public.employee_skills (
  id                     uuid primary key default gen_random_uuid(),
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  skill_id               uuid not null references public.skills(id) on delete cascade,
  proficiency_level      int not null default 1 check (proficiency_level between 1 and 5),
  verified_at            timestamptz,
  unique (organization_member_id, skill_id)
);

create table if not exists public.employee_availability (
  id                     uuid primary key default gen_random_uuid(),
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  date                   date not null,
  available_hours        numeric not null default 8,
  reason                 text,
  unique (organization_member_id, date)
);

create table if not exists public.leave_requests (
  id                     uuid primary key default gen_random_uuid(),
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  start_date             date not null,
  end_date               date not null,
  leave_type             text not null default 'PTO',
  status                 text not null default 'PENDING'
                           check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  approved_by            uuid references public.organization_members(id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
select handoff.attach_updated_at('public.leave_requests');

-- helper: resolve organization_id from a team
create or replace function handoff.team_org(p_team uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.teams where id = p_team;
$$;

-- ---------------------------------------------------------------- RLS --------
alter table public.departments           enable row level security;
alter table public.teams                 enable row level security;
alter table public.team_members          enable row level security;
alter table public.skills                enable row level security;
alter table public.employee_skills       enable row level security;
alter table public.employee_availability enable row level security;
alter table public.leave_requests        enable row level security;

create policy departments_select on public.departments
  for select using (handoff.is_org_member(organization_id));
create policy departments_manage on public.departments
  for all using (handoff.has_permission(organization_id,'team:create'))
  with check (handoff.has_permission(organization_id,'team:create'));

create policy teams_select on public.teams
  for select using (handoff.is_org_member(organization_id));
create policy teams_insert on public.teams
  for insert with check (handoff.has_permission(organization_id,'team:create'));
create policy teams_update on public.teams
  for update using (handoff.has_permission(organization_id,'team:update'))
  with check (handoff.has_permission(organization_id,'team:update'));
create policy teams_delete on public.teams
  for delete using (handoff.has_permission(organization_id,'team:update'));

create policy team_members_select on public.team_members
  for select using (handoff.is_org_member(handoff.team_org(team_id)));
create policy team_members_manage on public.team_members
  for all using (handoff.has_permission(handoff.team_org(team_id),'team:manage_members'))
  with check (handoff.has_permission(handoff.team_org(team_id),'team:manage_members'));

create policy skills_select on public.skills
  for select using (organization_id is null or handoff.is_org_member(organization_id));
create policy skills_manage on public.skills
  for all using (organization_id is not null and handoff.has_permission(organization_id,'member:manage'))
  with check (organization_id is not null and handoff.has_permission(organization_id,'member:manage'));

-- employee skills/availability/leave: visible to org members; self or member:manage can write
create policy emp_skills_select on public.employee_skills
  for select using (exists (select 1 from public.organization_members m
    where m.id = employee_skills.organization_member_id and handoff.is_org_member(m.organization_id)));
create policy emp_skills_manage on public.employee_skills
  for all using (exists (select 1 from public.organization_members m
    where m.id = employee_skills.organization_member_id
      and (m.user_id = auth.uid() or handoff.has_permission(m.organization_id,'member:manage'))))
  with check (exists (select 1 from public.organization_members m
    where m.id = employee_skills.organization_member_id
      and (m.user_id = auth.uid() or handoff.has_permission(m.organization_id,'member:manage'))));

create policy emp_avail_select on public.employee_availability
  for select using (exists (select 1 from public.organization_members m
    where m.id = employee_availability.organization_member_id and handoff.is_org_member(m.organization_id)));
create policy emp_avail_manage on public.employee_availability
  for all using (exists (select 1 from public.organization_members m
    where m.id = employee_availability.organization_member_id
      and (m.user_id = auth.uid() or handoff.has_permission(m.organization_id,'member:manage'))))
  with check (exists (select 1 from public.organization_members m
    where m.id = employee_availability.organization_member_id
      and (m.user_id = auth.uid() or handoff.has_permission(m.organization_id,'member:manage'))));

create policy leave_select on public.leave_requests
  for select using (exists (select 1 from public.organization_members m
    where m.id = leave_requests.organization_member_id and handoff.is_org_member(m.organization_id)));
create policy leave_manage on public.leave_requests
  for all using (exists (select 1 from public.organization_members m
    where m.id = leave_requests.organization_member_id
      and (m.user_id = auth.uid() or handoff.has_permission(m.organization_id,'member:manage'))))
  with check (exists (select 1 from public.organization_members m
    where m.id = leave_requests.organization_member_id
      and (m.user_id = auth.uid() or handoff.has_permission(m.organization_id,'member:manage'))));
