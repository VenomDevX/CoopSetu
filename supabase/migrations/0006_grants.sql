-- ============================================================================
-- Handoff — 0006 Table/function grants for the `authenticated` role.
-- RLS still governs which ROWS are visible; these grants govern table access.
-- anon is intentionally left without DML on business tables.
-- ============================================================================

grant usage on schema public to authenticated, anon;

-- Existing tables
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Future tables created later in the public schema (by the postgres role)
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
