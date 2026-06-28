-- Handoff — 0026 Rate Limiting

create table if not exists public.rate_limits (
  ip text primary key,
  count int not null default 1,
  expires_at timestamptz not null
);

alter table public.rate_limits enable row level security;
-- No public policies. Only accessible via service_role or security definer RPC.

create or replace function handoff.check_rate_limit(p_ip text, p_max_attempts int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public, handoff
as $$
declare
  v_count int;
  v_expires_at timestamptz;
begin
  -- Delete expired records for this IP before checking
  delete from public.rate_limits where ip = p_ip and expires_at <= now();

  insert into public.rate_limits (ip, count, expires_at)
  values (p_ip, 1, now() + (p_window_seconds || ' seconds')::interval)
  on conflict (ip) do update
  set count = rate_limits.count + 1
  returning count, expires_at into v_count, v_expires_at;

  if v_count > p_max_attempts then
    return false;
  end if;

  return true;
end;
$$;
