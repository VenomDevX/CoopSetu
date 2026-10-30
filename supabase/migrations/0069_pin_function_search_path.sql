-- ============================================================================
-- CoopSetu — 0078 Pin search_path on functions flagged as mutable
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



-- Trigger function; references public.projects/sprints/tasks/releases (qualified).
ALTER FUNCTION public.check_project_deadline_tenant() SET search_path = public, pg_catalog;
