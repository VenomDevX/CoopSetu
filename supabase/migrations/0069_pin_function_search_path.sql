-- ============================================================================
-- Handoff — 0078 Pin search_path on functions flagged as mutable
-- ============================================================================
-- Fixes Supabase advisor: "function_search_path_mutable".
--
-- These functions were created without an explicit `SET search_path`, so they
-- inherit the caller role's mutable search_path — which allows search-path
-- hijacking (an attacker who can create objects in an earlier-resolved schema
-- could shadow an unqualified reference). Pinning a fixed search_path closes
-- this. Bodies are unchanged; all their object references are already
-- schema-qualified, so the pinned paths below are safe.
-- ============================================================================

-- Pure built-in SQL (string_agg/substr/random/generate_series live in pg_catalog).
ALTER FUNCTION handoff.generate_join_code() SET search_path = pg_catalog;

-- Uses fully-qualified extensions.digest(); include extensions for safety.
ALTER FUNCTION handoff.hash_join_code(text) SET search_path = pg_catalog, extensions;

-- Trigger function; references public.projects/sprints/tasks/releases (qualified).
ALTER FUNCTION public.check_project_deadline_tenant() SET search_path = public, pg_catalog;
