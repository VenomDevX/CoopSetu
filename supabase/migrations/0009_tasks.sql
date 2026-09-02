-- ============================================================================
-- Handoff — 0009 Epics, Sprints, Tasks, Boards
-- ============================================================================

create table if not exists public.epics (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  status          text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  priority        text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  owner_member_id uuid references public.organization_members(id) on delete set null,
  start_date      date,
  target_end_date date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.epics');
create index if not exists epics_project_idx on public.epics(project_id);

create table if not exists public.sprints (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  project_id             uuid not null references public.projects(id) on delete cascade,
  team_id                uuid references public.teams(id) on delete set null,
  name                   text not null,
  goal                   text,
  status                 text not null default 'PLANNED'
                           check (status in ('PLANNED','ACTIVE','COMPLETED','CANCELLED')),
  start_date             date,
  end_date               date,
  capacity_hours         numeric not null default 0,
  planned_story_points   numeric not null default 0,
  completed_story_points numeric not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
select handoff.attach_updated_at('public.sprints');
create index if not exists sprints_project_idx on public.sprints(project_id);

-- per-organization task counter
create table if not exists public.org_task_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_number     bigint not null default 0
);

create table if not exists public.tasks (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations(id) on delete cascade,
  project_id                uuid not null references public.projects(id) on delete cascade,
  epic_id                   uuid references public.epics(id) on delete set null,
  sprint_id                 uuid references public.sprints(id) on delete set null,
  task_number               bigint not null,
  task_key                  text not null,
  title                     text not null,
  description               text,
  task_type                 text not null default 'TASK'
    check (task_type in ('TASK','STORY','BUG','IMPROVEMENT','TECHNICAL_DEBT','SECURITY_TASK','INCIDENT_FOLLOW_UP','RESEARCH','SPIKE','COMPLIANCE_TASK')),
  status                    text not null default 'BACKLOG'
    check (status in ('BACKLOG','READY','IN_PROGRESS','BLOCKED','CODE_REVIEW','QA_TESTING','SECURITY_REVIEW','READY_FOR_RELEASE','DONE','CANCELLED')),
  priority                  text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  security_classification   text not null default 'INTERNAL'
    check (security_classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  reporter_member_id        uuid references public.organization_members(id) on delete set null,
  primary_assignee_member_id uuid references public.organization_members(id) on delete set null,
  due_date                  date,
  start_date                date,
  estimated_hours           numeric,
  actual_hours              numeric not null default 0,
  story_points              numeric,
  acceptance_criteria       text,
  is_blocked                boolean not null default false,
  blocker_reason            text,
  position                  numeric not null default 1000,
  archived_at               timestamptz,
  archived_by               uuid references public.organization_members(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, task_number)
);
select handoff.attach_updated_at('public.tasks');
create index if not exists tasks_project_idx  on public.tasks(project_id);
create index if not exists tasks_status_idx   on public.tasks(project_id, status);
create index if not exists tasks_assignee_idx on public.tasks(primary_assignee_member_id);
create index if not exists tasks_sprint_idx   on public.tasks(sprint_id);
create index if not exists tasks_due_idx      on public.tasks(due_date);

-- assign task_number + task_key on insert
create or replace function handoff.assign_task_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_num bigint;
  v_code text;
begin
  insert into public.org_task_counters(organization_id, last_number)
  values (new.organization_id, 1)
  on conflict (organization_id) do update set last_number = org_task_counters.last_number + 1
  returning last_number into v_num;

  new.task_number := v_num;
  select code into v_code from public.projects where id = new.project_id;
  new.task_key := coalesce(v_code,'TASK') || '-' || v_num::text;
  return new;
end;
$$;
drop trigger if exists trg_assign_task_number on public.tasks;
create trigger trg_assign_task_number before insert on public.tasks
  for each row execute function handoff.assign_task_number();

create table if not exists public.task_assignees (
  id                     uuid primary key default gen_random_uuid(),
  task_id                uuid not null references public.tasks(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  assignment_role        text default 'ASSIGNEE',
  assigned_at            timestamptz not null default now(),
  assigned_by            uuid references public.organization_members(id) on delete set null,
  unique (task_id, organization_member_id)
);
create index if not exists task_assignees_task_idx on public.task_assignees(task_id);
create index if not exists task_assignees_member_idx on public.task_assignees(organization_member_id);

create table if not exists public.task_dependencies (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type    text not null default 'BLOCKS',
  notes              text,
  check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);

create table if not exists public.task_labels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  unique (organization_id, name)
);

create table if not exists public.task_label_links (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.task_labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.task_checklists (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  title     text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.task_checklists(id) on delete cascade,
  title        text not null,
  is_completed boolean not null default false,
  completed_by uuid references public.organization_members(id) on delete set null,
  completed_at timestamptz,
  position     numeric not null default 1000
);

create table if not exists public.task_watchers (
  task_id                uuid not null references public.tasks(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  primary key (task_id, organization_member_id)
);

create table if not exists public.task_activity (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  actor_member_id uuid references public.organization_members(id) on delete set null,
  activity_type   text not null,
  old_value       jsonb,
  new_value       jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists task_activity_task_idx on public.task_activity(task_id, created_at desc);

create table if not exists public.time_entries (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  task_id                uuid not null references public.tasks(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  entry_date             date not null default current_date,
  minutes                int not null check (minutes >= 0),
  description            text,
  created_at             timestamptz not null default now()
);

create table if not exists public.saved_views (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_member_id uuid not null references public.organization_members(id) on delete cascade,
  name            text not null,
  entity_type     text not null,
  filters         jsonb not null default '{}'::jsonb,
  sort            jsonb not null default '{}'::jsonb,
  columns         jsonb not null default '[]'::jsonb,
  is_shared       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select handoff.attach_updated_at('public.saved_views');

-- ----------------------------------------------------------------------------
-- Task access helpers
-- ----------------------------------------------------------------------------
create or replace function handoff.task_project(p_task uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.tasks where id = p_task;
$$;

-- Can the current user edit a given task?
-- PM/manager roles or project managers => yes. Developers/QA/etc => only if
-- assigned (primary assignee or in task_assignees) and project member.
create or replace function handoff.can_edit_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with t as (select id, project_id, organization_id, primary_assignee_member_id from public.tasks where id = p_task)
  select exists(select 1 from t)
    and (
      handoff.can_manage_project((select project_id from t))
      or exists (
        select 1 from t
        join public.organization_members m on m.id = t.primary_assignee_member_id
        where m.user_id = auth.uid()
      )
      or exists (
        select 1 from public.task_assignees ta
        join public.organization_members m on m.id = ta.organization_member_id
        where ta.task_id = p_task and m.user_id = auth.uid()
      )
    );
$$;

-- ---------------------------------------------------------------- RLS --------
alter table public.epics                enable row level security;
alter table public.sprints              enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_assignees       enable row level security;
alter table public.task_dependencies    enable row level security;
alter table public.task_labels          enable row level security;
alter table public.task_label_links     enable row level security;
alter table public.task_checklists      enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_watchers        enable row level security;
alter table public.task_activity        enable row level security;
alter table public.time_entries         enable row level security;
alter table public.saved_views          enable row level security;
alter table public.org_task_counters    enable row level security; -- no policies: definer-only

create policy epics_select on public.epics for select using (handoff.can_view_project(project_id));
create policy epics_manage on public.epics for all
  using (handoff.can_manage_project(project_id)) with check (handoff.can_manage_project(project_id));

create policy sprints_select on public.sprints for select using (handoff.can_view_project(project_id));
create policy sprints_manage on public.sprints for all
  using (handoff.can_manage_project(project_id)) with check (handoff.can_manage_project(project_id));

create policy tasks_select on public.tasks for select using (handoff.can_view_project(project_id));
create policy tasks_insert on public.tasks for insert with check (handoff.can_manage_project(project_id));
create policy tasks_update on public.tasks for update
  using (handoff.can_edit_task(id)) with check (handoff.can_edit_task(id));
create policy tasks_delete on public.tasks for delete using (handoff.can_manage_project(project_id));

create policy task_assignees_select on public.task_assignees for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy task_assignees_manage on public.task_assignees for all
  using (handoff.can_manage_project(handoff.task_project(task_id)))
  with check (handoff.can_manage_project(handoff.task_project(task_id)));

create policy task_deps_select on public.task_dependencies for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy task_deps_manage on public.task_dependencies for all
  using (handoff.can_edit_task(task_id)) with check (handoff.can_edit_task(task_id));

create policy task_labels_select on public.task_labels for select using (handoff.is_org_member(organization_id));
create policy task_labels_manage on public.task_labels for all
  using (handoff.has_permission(organization_id,'task:create'))
  with check (handoff.has_permission(organization_id,'task:create'));

create policy task_label_links_select on public.task_label_links for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy task_label_links_manage on public.task_label_links for all
  using (handoff.can_edit_task(task_id)) with check (handoff.can_edit_task(task_id));

create policy checklists_select on public.task_checklists for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy checklists_manage on public.task_checklists for all
  using (handoff.can_edit_task(task_id)) with check (handoff.can_edit_task(task_id));

create policy checklist_items_select on public.task_checklist_items for select
  using (exists (select 1 from public.task_checklists c where c.id = checklist_id
    and handoff.can_view_project(handoff.task_project(c.task_id))));
create policy checklist_items_manage on public.task_checklist_items for all
  using (exists (select 1 from public.task_checklists c where c.id = checklist_id and handoff.can_edit_task(c.task_id)))
  with check (exists (select 1 from public.task_checklists c where c.id = checklist_id and handoff.can_edit_task(c.task_id)));

create policy watchers_select on public.task_watchers for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy watchers_manage on public.task_watchers for all
  using (handoff.can_view_project(handoff.task_project(task_id)))
  with check (handoff.can_view_project(handoff.task_project(task_id)));

create policy task_activity_select on public.task_activity for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy task_activity_insert on public.task_activity for insert
  with check (handoff.can_view_project(handoff.task_project(task_id)));

create policy time_entries_select on public.time_entries for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy time_entries_manage on public.time_entries for all
  using (handoff.can_edit_task(task_id)) with check (handoff.can_edit_task(task_id));

create policy saved_views_select on public.saved_views for select
  using (handoff.is_org_member(organization_id) and (is_shared or exists (
    select 1 from public.organization_members m where m.id = owner_member_id and m.user_id = auth.uid())));
create policy saved_views_manage on public.saved_views for all
  using (exists (select 1 from public.organization_members m where m.id = owner_member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.id = owner_member_id and m.user_id = auth.uid()));
