-- ============================================================================
-- CoopSetu — 0075 Rename the `handoff` schema to `coopsetu`
-- ============================================================================
-- The project was renamed HANDOFF -> CoopSetu. Migrations 0001-0074 created and
-- referenced a Postgres schema literally named `handoff`, which holds ~34 RLS
-- helper functions (has_permission, is_org_member, can_view_project, ...) that
-- every Row Level Security policy in the database depends on.
--
-- Those earlier migrations are already applied and MUST NOT be edited: editing
-- them would not rename anything in a deployed database, and would desynchronise
-- the repo from every environment. This migration performs the rename as a
-- forward migration instead.
--
-- What Postgres handles automatically, and what it does not:
--   * RLS policies, triggers and column defaults reference functions by OID, so
--     they follow the rename with no action needed.
--   * Function *bodies* are stored as text and are resolved at call time, so any
--     body containing a literal `handoff.` reference would break. Step 2 rewrites
--     them. Same for a pinned `search_path` naming the old schema (step 3).
--
-- SAFETY: take a database backup before applying. This rewrites SECURITY DEFINER
-- functions that enforce tenant isolation. Verify with the checks at the bottom.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Rename the schema (no-op if a previous run already completed).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'handoff')
     and not exists (select 1 from pg_namespace where nspname = 'coopsetu') then
    execute 'alter schema handoff rename to coopsetu';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rewrite every function body that still calls `handoff.<fn>()`.
--    pg_get_functiondef() reproduces the full definition (volatility, SECURITY
--    DEFINER, SET clauses, owner-visible attributes), so replaying it through
--    CREATE OR REPLACE preserves the function's semantics exactly.
-- ---------------------------------------------------------------------------
do $$
declare
  r   record;
  def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'coopsetu')  -- the only schemas this project defines functions in
      and p.prokind = 'f'                    -- plain functions only
      and pg_get_functiondef(p.oid) ~ '\mhandoff\.'
  loop
    def := regexp_replace(pg_get_functiondef(r.oid), '\mhandoff\.', 'coopsetu.', 'g');
    execute def;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Re-pin any function whose search_path still names the old schema
--    (migration 0028 pinned `search_path = public, handoff` on the rate limiter).
--    proconfig is not part of the body, so step 2 does not cover it.
-- ---------------------------------------------------------------------------
do $$
declare
  r         record;
  cfg       text;
  new_path  text;
begin
  for r in
    select p.oid, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'coopsetu')
      and p.proconfig is not null
  loop
    foreach cfg in array r.proconfig loop
      if cfg like 'search_path=%' and cfg ~ '\mhandoff\M' then
        new_path := regexp_replace(split_part(cfg, '=', 2), '\mhandoff\M', 'coopsetu', 'g');
        execute format('alter function %s set search_path = %s', r.oid::regprocedure, new_path);
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Re-create the storage.objects policies under the new brand
--    (from 0019_storage_buckets.sql / 0029_storage_security.sql).
--
--    NOTE: `ALTER POLICY ... RENAME` requires ownership of storage.objects,
--    which belongs to supabase_storage_admin — the migration role (postgres) is
--    not a member and cannot SET ROLE to it. DROP + CREATE POLICY *are* permitted
--    to it, so the policies are rebuilt from the catalogue instead of renamed.
--    Definitions are read back with pg_get_expr, so the expressions are carried
--    over verbatim (already pointing at coopsetu.* after steps 1-2) and stay in
--    sync with whatever 0029 last set — nothing is hardcoded here.
--
--    Policy names are cosmetic: the expressions bind to the helper function by
--    OID and keep working either way. So if an environment does not permit even
--    this, warn and continue rather than failing the whole rename.
-- ---------------------------------------------------------------------------
do $$
declare
  r        record;
  new_name text;
  cmd      text;
  sql      text;
begin
  for r in
    select p.polname,
           p.polcmd,
           p.polpermissive,
           coalesce(
             (select string_agg(quote_ident(ro.rolname), ', ')
              from pg_roles ro where ro.oid = any(p.polroles)),
             'public'
           )                                          as roles,
           pg_get_expr(p.polqual, p.polrelid)         as using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid)    as check_expr
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'          -- schema-qualified: `objects` is not unique
      and c.relname = 'objects'
      and p.polname like 'handoff\_%'
  loop
    new_name := 'coopsetu_' || substring(r.polname from 9);

    cmd := case r.polcmd
             when 'r' then 'select'
             when 'a' then 'insert'
             when 'w' then 'update'
             when 'd' then 'delete'
             else 'all'
           end;

    sql := format('create policy %I on storage.objects as %s for %s to %s',
                  new_name,
                  case when r.polpermissive then 'permissive' else 'restrictive' end,
                  cmd,
                  r.roles);

    if r.using_expr is not null then
      sql := sql || format(' using (%s)', r.using_expr);
    end if;
    if r.check_expr is not null then
      sql := sql || format(' with check (%s)', r.check_expr);
    end if;

    begin
      -- Defensive: the CREATE below is rolled back with this sub-block if the
      -- DROP fails (PL/pgSQL BEGIN..EXCEPTION is a subtransaction), so a
      -- half-applied rename cannot persist. This guard costs nothing and also
      -- covers a new-name policy left behind by any other means.
      execute format('drop policy if exists %I on storage.objects', new_name);
      execute sql;
      execute format('drop policy %I on storage.objects', r.polname);
    exception when insufficient_privilege then
      raise warning 'Could not re-create storage policy % as % (%). '
                    'The old name still works — rename it manually as the table owner.',
                    r.polname, new_name, sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Preserve the access the old schema had.
-- ---------------------------------------------------------------------------
grant usage on schema coopsetu to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Fail loudly if anything still references the old schema.
-- ---------------------------------------------------------------------------
do $$
declare
  leftover int;
begin
  if exists (select 1 from pg_namespace where nspname = 'handoff') then
    raise exception 'Rename incomplete: schema "handoff" still exists';
  end if;

  select count(*) into leftover
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'coopsetu')
    and p.prokind = 'f'
    and pg_get_functiondef(p.oid) ~ '\mhandoff\M';

  if leftover > 0 then
    raise exception 'Rename incomplete: % function(s) still reference "handoff"', leftover;
  end if;
end $$;

commit;
