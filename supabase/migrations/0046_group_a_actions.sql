-- ============================================================================
-- Handoff - 0046 Group A action backends
-- ============================================================================
-- Real persistence for calendar deadlines, project CSV imports, and report
-- export audit records. All tenant-sensitive rows carry organization_id and
-- are protected by RLS plus explicit tenant-check triggers.

insert into public.permissions (code, description) values
  ('deadline:create','Create project deadlines'),
  ('project:import','Import projects from CSV'),
  ('task:import','Import tasks from CSV'),
  ('report:export','Export reports')
on conflict (code) do nothing;

do $$
declare r record;
begin
  for r in select id from public.roles where code='ORG_OWNER' and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in ('deadline:create','project:import','task:import','report:export')
    on conflict do nothing;
  end loop;

  for r in select id from public.roles
           where code in ('PROJECT_MANAGER','ENGINEERING_MANAGER','TEAM_LEAD')
             and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    select r.id, code from public.permissions
    where code in ('deadline:create','project:import','report:export')
    on conflict do nothing;
  end loop;

  for r in select id from public.roles where code in ('CEO','CTO','AUDITOR') and organization_id is null loop
    insert into public.role_permissions(role_id, permission_code)
    values (r.id, 'report:export')
    on conflict do nothing;
  end loop;
end $$;

create table if not exists public.project_deadlines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  project_id        uuid not null references public.projects(id) on delete cascade,
  sprint_id         uuid references public.sprints(id) on delete set null,
  task_id           uuid references public.tasks(id) on delete set null,
  release_id        uuid references public.releases(id) on delete set null,
  title             text not null,
  description       text,
  due_date          date not null,
  owner_member_id   uuid references public.organization_members(id) on delete set null,
  status            text not null default 'PLANNED'
    check (status in ('PLANNED','IN_PROGRESS','COMPLETED','MISSED','CANCELLED')),
  created_by_member_id uuid references public.organization_members(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select handoff.attach_updated_at('public.project_deadlines');
create index if not exists project_deadlines_org_date_idx on public.project_deadlines(organization_id, due_date);
create index if not exists project_deadlines_project_idx on public.project_deadlines(project_id, due_date);

create table if not exists public.import_jobs (
  id                   uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  created_by_member_id  uuid not null references public.organization_members(id) on delete cascade,
  import_type           text not null check (import_type in ('PROJECTS','TASKS')),
  file_name             text not null,
  mime_type             text,
  size_bytes            bigint not null default 0,
  status                text not null default 'PREVIEWED'
    check (status in ('PREVIEWED','CONFIRMED','FAILED','CANCELLED')),
  mapping               jsonb not null default '{}'::jsonb,
  summary               jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
select handoff.attach_updated_at('public.import_jobs');
create index if not exists import_jobs_org_idx on public.import_jobs(organization_id, created_at desc);

create table if not exists public.import_rows (
  id                  uuid primary key default gen_random_uuid(),
  import_job_id       uuid not null references public.import_jobs(id) on delete cascade,
  row_number          int not null,
  raw_data            jsonb not null default '{}'::jsonb,
  mapped_data         jsonb not null default '{}'::jsonb,
  status              text not null default 'PENDING'
    check (status in ('PENDING','VALID','INVALID','CREATED','SKIPPED')),
  errors              jsonb not null default '[]'::jsonb,
  created_resource_id uuid,
  created_at          timestamptz not null default now()
);
create index if not exists import_rows_job_idx on public.import_rows(import_job_id, row_number);

create table if not exists public.report_exports (
  id                   uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  actor_member_id       uuid references public.organization_members(id) on delete set null,
  export_type           text not null,
  format                text not null check (format in ('CSV','PDF')),
  filters               jsonb not null default '{}'::jsonb,
  status                text not null default 'COMPLETED'
    check (status in ('PENDING','COMPLETED','FAILED','BLOCKED_BY_INTEGRATION')),
  file_name             text,
  row_count             int not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists report_exports_org_idx on public.report_exports(organization_id, created_at desc);

create or replace function public.check_project_deadline_tenant()
returns trigger language plpgsql as $$
declare
  v_project_org uuid;
  v_sprint_org uuid;
  v_task_org uuid;
  v_release_org uuid;
  v_owner_org uuid;
  v_creator_org uuid;
begin
  select organization_id into v_project_org from public.projects where id = new.project_id;
  if new.organization_id is distinct from v_project_org then
    raise exception 'Cross-tenant deadline project_id' using errcode = '23503';
  end if;

  if new.sprint_id is not null then
    select organization_id into v_sprint_org from public.sprints where id = new.sprint_id;
    if new.organization_id is distinct from v_sprint_org then
      raise exception 'Cross-tenant deadline sprint_id' using errcode = '23503';
    end if;
  end if;

  if new.task_id is not null then
    select organization_id into v_task_org from public.tasks where id = new.task_id;
    if new.organization_id is distinct from v_task_org then
      raise exception 'Cross-tenant deadline task_id' using errcode = '23503';
    end if;
  end if;

  if new.release_id is not null then
    select organization_id into v_release_org from public.releases where id = new.release_id;
    if new.organization_id is distinct from v_release_org then
      raise exception 'Cross-tenant deadline release_id' using errcode = '23503';
    end if;
  end if;

  if new.owner_member_id is not null then
    select organization_id into v_owner_org from public.organization_members where id = new.owner_member_id;
    if new.organization_id is distinct from v_owner_org then
      raise exception 'Cross-tenant deadline owner_member_id' using errcode = '23503';
    end if;
  end if;

  if new.created_by_member_id is not null then
    select organization_id into v_creator_org from public.organization_members where id = new.created_by_member_id;
    if new.organization_id is distinct from v_creator_org then
      raise exception 'Cross-tenant deadline created_by_member_id' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_project_deadline_tenant on public.project_deadlines;
create trigger trg_check_project_deadline_tenant
  before insert or update on public.project_deadlines
  for each row execute function public.check_project_deadline_tenant();

alter table public.project_deadlines enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;
alter table public.report_exports enable row level security;

-- Authenticated users cannot call write_audit_log after the security hardening
-- migrations. Trusted server routes also use the service-role client for bulk
-- imports, export records, and system notifications, so grant only the tables
-- those paths write while browser roles stay controlled by RLS.
grant select on table public.organization_members to service_role;
grant insert, select on table public.audit_logs to service_role;
grant insert, select on table public.projects to service_role;
grant insert, select on table public.notifications to service_role;
grant insert, select on table public.report_exports to service_role;

create policy project_deadlines_select on public.project_deadlines
  for select using (handoff.can_view_project(project_id));
create policy project_deadlines_insert on public.project_deadlines
  for insert with check (
    handoff.can_view_project(project_id)
    and (
      handoff.has_permission(organization_id,'deadline:create')
      or handoff.has_permission(organization_id,'project:update')
    )
    and created_by_member_id = handoff.current_member_id(organization_id)
  );
create policy project_deadlines_update on public.project_deadlines
  for update using (
    handoff.can_view_project(project_id)
    and (
      handoff.has_permission(organization_id,'deadline:create')
      or handoff.has_permission(organization_id,'project:update')
    )
  ) with check (
    handoff.can_view_project(project_id)
    and (
      handoff.has_permission(organization_id,'deadline:create')
      or handoff.has_permission(organization_id,'project:update')
    )
  );

create policy import_jobs_select on public.import_jobs
  for select using (
    created_by_member_id = handoff.current_member_id(organization_id)
    or handoff.has_permission(organization_id,'project:import')
  );
create policy import_jobs_insert on public.import_jobs
  for insert with check (
    created_by_member_id = handoff.current_member_id(organization_id)
    and (
      (import_type = 'PROJECTS' and handoff.has_permission(organization_id,'project:import'))
      or (import_type = 'TASKS' and handoff.has_permission(organization_id,'task:import'))
    )
  );
create policy import_jobs_update on public.import_jobs
  for update using (
    created_by_member_id = handoff.current_member_id(organization_id)
    and (
      (import_type = 'PROJECTS' and handoff.has_permission(organization_id,'project:import'))
      or (import_type = 'TASKS' and handoff.has_permission(organization_id,'task:import'))
    )
  ) with check (
    created_by_member_id = handoff.current_member_id(organization_id)
    and (
      (import_type = 'PROJECTS' and handoff.has_permission(organization_id,'project:import'))
      or (import_type = 'TASKS' and handoff.has_permission(organization_id,'task:import'))
    )
  );

create policy import_rows_select on public.import_rows
  for select using (
    exists (
      select 1 from public.import_jobs j
      where j.id = import_job_id
        and (
          j.created_by_member_id = handoff.current_member_id(j.organization_id)
          or handoff.has_permission(j.organization_id,'project:import')
          or handoff.has_permission(j.organization_id,'task:import')
        )
    )
  );
create policy import_rows_manage on public.import_rows
  for all using (
    exists (
      select 1 from public.import_jobs j
      where j.id = import_job_id
        and j.created_by_member_id = handoff.current_member_id(j.organization_id)
    )
  ) with check (
    exists (
      select 1 from public.import_jobs j
      where j.id = import_job_id
        and j.created_by_member_id = handoff.current_member_id(j.organization_id)
    )
  );

create policy report_exports_select on public.report_exports
  for select using (
    handoff.has_permission(organization_id,'report:export')
    or handoff.has_permission(organization_id,'audit:view')
  );
create policy report_exports_insert on public.report_exports
  for insert with check (
    handoff.has_permission(organization_id,'report:export')
    and actor_member_id = handoff.current_member_id(organization_id)
  );

alter publication supabase_realtime add table public.project_deadlines;
alter publication supabase_realtime add table public.report_exports;
