-- ============================================================================
-- Handoff — 0061 Reports and Scheduling (Security Phase E)
-- ============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_member_id uuid not null references public.organization_members(id) on delete cascade,
  name text not null,
  type text not null,
  filters jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  status text not null,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  cron_expression text not null,
  recipients text[] not null default '{}',
  next_run_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.report_schedules(id) on delete cascade,
  status text not null,
  delivered_at timestamptz not null default now()
);

-- RLS
alter table public.reports enable row level security;
alter table public.report_runs enable row level security;
alter table public.report_schedules enable row level security;
alter table public.report_deliveries enable row level security;

-- Policies for reports
create policy reports_select on public.reports
  for select
  using (handoff.has_permission(organization_id, 'report:view'));

create policy reports_manage on public.reports
  for all
  using (handoff.has_permission(organization_id, 'report:create'));

-- We omit explicit policies for runs/schedules/deliveries as they are managed server-side
-- but we can add basic ones for consistency
create policy report_schedules_select on public.report_schedules
  for select
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_schedules.report_id
      and handoff.has_permission(r.organization_id, 'report:view')
    )
  );

create policy report_schedules_manage on public.report_schedules
  for all
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_schedules.report_id
      and handoff.has_permission(r.organization_id, 'report:schedule')
    )
  );
