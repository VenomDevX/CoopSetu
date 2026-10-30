-- ============================================================================
-- 0084 — NCCT institution hierarchy
--
-- Problem statement 26087 describes a four-level structure:
--
--     NCCT  ->  VAMNICOM  ->  RICMs  ->  ICMs
--
-- 0071 modelled institutions as a flat list inside one organization: no parent
-- link, and `type` was free text with a default and no CHECK. There was also no
-- way to say which institute a member or a trainee belongs to — the only tenant
-- boundary anywhere is `organization_id`, so every INSTITUTE_ADMIN could read
-- and write every other institute's data.
--
-- This migration adds the structure. 0085 adds the RLS that makes it a real
-- boundary; the two are deliberately separate so the tree can be seeded and
-- eyeballed before access rules start depending on it.
-- ============================================================================

-- --------------------------------------------------------------- institutions
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS parent_institution_id UUID
    REFERENCES public.institutions(id) ON DELETE SET NULL;

-- Depth in the tree, kept alongside parent_institution_id rather than derived.
-- A recursive CTE could compute it, but every list query needs it and callers
-- filter on it constantly ("show me all regional institutes"); storing it keeps
-- those queries flat and indexable.
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'INSTITUTE';

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'institutions_level_check'
  ) THEN
    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_level_check
      CHECK (level IN ('NATIONAL', 'APEX', 'REGIONAL', 'INSTITUTE'));
  END IF;
END $$;

-- `type` stays free text on purpose. 0071 shipped it with a default and no
-- constraint, and existing rows (demo workspaces write 'TRAINING_INSTITUTE')
-- would fail a strict CHECK. The vocabulary NCCT/VAMNICOM/RICM/ICM is a
-- convention enforced by the seed and the service layer, not by the database.
COMMENT ON COLUMN public.institutions.type IS
  'NCCT | VAMNICOM | RICM | ICM | TRAINING_INSTITUTE. Convention, not enforced — see 0084.';

COMMENT ON COLUMN public.institutions.parent_institution_id IS
  'Parent in the NCCT tree. NULL only for the national apex row.';

CREATE INDEX IF NOT EXISTS institutions_parent_idx
  ON public.institutions(parent_institution_id);
CREATE INDEX IF NOT EXISTS institutions_level_idx
  ON public.institutions(organization_id, level);

-- ------------------------------------------------------- member <-> institute
-- NULL means national scope: the NCCT director is a member of the organization
-- without belonging to any one institute, and 0085 reads NULL as "sees all".
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS institution_id UUID
    REFERENCES public.institutions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organization_members.institution_id IS
  'Institute this member is scoped to. NULL = national scope (see 0085 RLS).';

CREATE INDEX IF NOT EXISTS organization_members_institution_idx
  ON public.organization_members(institution_id);

-- ------------------------------------------------------ trainee <-> institute
-- 0071 gave trainees no institution link at all; attribution was only possible
-- indirectly through enrollments -> programmes.institution_id, which breaks for
-- a trainee who has been nominated but not yet enrolled — precisely the state
-- the nomination workflow introduces.
ALTER TABLE public.trainees
  ADD COLUMN IF NOT EXISTS institution_id UUID
    REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trainees_institution_idx
  ON public.trainees(institution_id);

-- ------------------------------------------------------------------ helpers
-- Every descendant of an institute, inclusive. Used by 0085 and by the national
-- rollup queries. STABLE so the planner can cache it within a statement.
CREATE OR REPLACE FUNCTION coopsetu.institution_subtree(p_root UUID)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, coopsetu
AS $$
  WITH RECURSIVE tree AS (
    SELECT i.id FROM public.institutions i WHERE i.id = p_root
    UNION ALL
    SELECT c.id
      FROM public.institutions c
      JOIN tree t ON c.parent_institution_id = t.id
  )
  SELECT id FROM tree;
$$;

-- The institute the current user is scoped to, or NULL for national scope.
CREATE OR REPLACE FUNCTION coopsetu.my_institution(p_org UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, coopsetu
AS $$
  SELECT om.institution_id
    FROM public.organization_members om
   WHERE om.organization_id = p_org
     AND om.user_id = (SELECT auth.uid())
     AND om.is_active
   LIMIT 1;
$$;

-- True when the current user may see rows belonging to p_institution.
-- National-scope members (institution_id IS NULL) see everything in the org;
-- everyone else sees their own institute and everything beneath it.
CREATE OR REPLACE FUNCTION coopsetu.can_access_institution(p_org UUID, p_institution UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, coopsetu
AS $$
  SELECT
    CASE
      WHEN coopsetu.my_institution(p_org) IS NULL THEN true
      WHEN p_institution IS NULL THEN true
      ELSE p_institution IN (
        SELECT id FROM coopsetu.institution_subtree(coopsetu.my_institution(p_org))
      )
    END;
$$;

GRANT EXECUTE ON FUNCTION coopsetu.institution_subtree(UUID)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION coopsetu.my_institution(UUID)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION coopsetu.can_access_institution(UUID, UUID) TO authenticated, service_role;
