-- Column-level defense-in-depth for integrations.encrypted_secrets.
-- 0058 deferred this, relying only on the API layer never selecting the
-- column. That's true today, but a future `select('*')` on `integrations`
-- would leak ciphertext to any member who can read the row under RLS.
--
-- Postgres note: `authenticated` previously held a table-wide GRANT SELECT,
-- which implicitly covers every column — a column-level REVOKE against that
-- has no effect (it only removes a column-scoped grant, which never existed).
-- The correct fix is to revoke the table-wide SELECT and re-grant it for the
-- explicit column list, omitting encrypted_secrets. UPDATE/INSERT/DELETE
-- privileges (and RLS policies) are untouched, so secret writes still work.
REVOKE SELECT ON public.integrations FROM authenticated;
GRANT SELECT (id, organization_id, provider, display_name, status, config, created_at, updated_at)
  ON public.integrations TO authenticated;
