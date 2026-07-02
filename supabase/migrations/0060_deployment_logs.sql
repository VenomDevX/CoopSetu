-- ============================================================================
-- Handoff — 0060 Deployment Logs (Security Phase D)
-- ============================================================================

create table if not exists public.deployment_logs (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.deployments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  log_level text not null check (log_level in ('INFO', 'WARN', 'ERROR')),
  message text not null,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists deployment_logs_deployment_idx on public.deployment_logs(deployment_id);

alter table public.deployment_logs enable row level security;

create policy deployment_logs_select on public.deployment_logs
  for select
  using (handoff.can_view_project(project_id));

create policy deployment_logs_manage on public.deployment_logs
  for all
  using (handoff.can_manage_project(project_id));
