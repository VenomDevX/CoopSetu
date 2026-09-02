-- ============================================================================
-- Handoff — 0001 Foundation: extensions, shared utility functions, triggers
-- ============================================================================

create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- A dedicated schema for internal helper functions used by RLS policies.
create schema if not exists handoff;

-- ----------------------------------------------------------------------------
-- updated_at trigger function (applied per-table by later migrations)
-- ----------------------------------------------------------------------------
create or replace function handoff.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convenience: attach the updated_at trigger to a table.
create or replace function handoff.attach_updated_at(p_table regclass)
returns void
language plpgsql
as $$
declare
  trig_name text := 'set_updated_at_' || replace(p_table::text, '.', '_');
begin
  execute format(
    'drop trigger if exists %I on %s;', trig_name, p_table
  );
  execute format(
    'create trigger %I before update on %s
       for each row execute function handoff.set_updated_at();',
    trig_name, p_table
  );
end;
$$;
