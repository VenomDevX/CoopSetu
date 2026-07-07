-- ============================================================================
-- Handoff — 0073 GitHub sync unique indexes
-- ============================================================================
-- Real GitHub sync (services/integration.service.ts's syncGithubRepository)
-- upserts pull_requests/commits rows keyed on (repository_id, external_id) /
-- (repository_id, external_hash) so re-syncing is idempotent.
--
-- Plain (non-partial) unique indexes, not partial ones: Postgres's
-- `ON CONFLICT (columns)` inference (what PostgREST/supabase-js's `.upsert()`
-- generates) can only match a partial index if the same WHERE predicate is
-- also included in the ON CONFLICT clause — which PostgREST's upsert helper
-- doesn't support. A plain unique index works fine here regardless: standard
-- SQL treats every NULL as distinct from every other NULL, so manually-created
-- rows / older mockSync rows with a NULL external_id/external_hash never
-- conflict with each other or with a real synced row.
-- ============================================================================

create unique index if not exists pull_requests_repo_external_uidx
  on public.pull_requests(repository_id, external_id);

create unique index if not exists commits_repo_external_uidx
  on public.commits(repository_id, external_hash);
