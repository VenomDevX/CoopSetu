-- ============================================================================
-- 0085 — institution-scoped access
--
-- 0084 added the NCCT tree and told members which institute they belong to.
-- This makes that a real boundary: an ICM Lucknow admin must not see RICM
-- Bengaluru's trainees.
--
-- Every policy here is AS RESTRICTIVE, which is the whole trick. Postgres ORs
-- permissive policies together, so adding an ordinary policy would *widen*
-- access — the opposite of what is wanted. Restrictive policies are ANDed with
-- whatever 0080 already granted, so this can only ever narrow.
--
-- Backwards compatibility is exact: coopsetu.can_access_institution() returns
-- true whenever the member has no institution_id (national scope) or the row
-- has no institution_id. Every pre-existing member and every demo workspace
-- row is in one of those two states, so nothing that worked before stops
-- working. Only members explicitly pinned to an institute get narrowed.
--
-- Note service_role and the postgres superuser bypass RLS entirely, so the
-- seed and the admin client are unaffected.
-- ============================================================================

-- ---------------------------------------------------------------- institutions
-- Self-referential: the row's own id is the thing being scoped. An institute
-- admin sees their own institute and everything beneath it; the NCCT director
-- (institution_id IS NULL) sees the whole tree.
DROP POLICY IF EXISTS institutions_institution_scope ON public.institutions;
CREATE POLICY institutions_institution_scope ON public.institutions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (coopsetu.can_access_institution(organization_id, id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, id));

-- ------------------------------------------------------------------ programmes
DROP POLICY IF EXISTS programmes_institution_scope ON public.programmes;
CREATE POLICY programmes_institution_scope ON public.programmes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

-- -------------------------------------------------------------------- trainers
DROP POLICY IF EXISTS trainers_institution_scope ON public.trainers;
CREATE POLICY trainers_institution_scope ON public.trainers
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (coopsetu.can_access_institution(organization_id, institution_id))
  WITH CHECK (coopsetu.can_access_institution(organization_id, institution_id));

-- -------------------------------------------------------------------- trainees
-- A trainee reading their own row is handled by 0080's self-ownership policy,
-- which is permissive and still ORs in. This restricts *staff* access: a
-- trainee's own institution_id must be inside the viewer's subtree.
DROP POLICY IF EXISTS trainees_institution_scope ON public.trainees;
CREATE POLICY trainees_institution_scope ON public.trainees
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    coopsetu.can_access_institution(organization_id, institution_id)
    -- A trainee always reaches their own record regardless of institute, so a
    -- mis-seeded institution_id can never lock someone out of their own data.
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    coopsetu.can_access_institution(organization_id, institution_id)
    OR user_id = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------- batches
-- batches carry no institution_id; they reach one through programmes. The
-- subquery is why institutions_parent_idx and the programmes FK index matter.
DROP POLICY IF EXISTS batches_institution_scope ON public.batches;
CREATE POLICY batches_institution_scope ON public.batches
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    coopsetu.can_access_institution(
      organization_id,
      (SELECT p.institution_id FROM public.programmes p WHERE p.id = programme_id)
    )
  )
  WITH CHECK (
    coopsetu.can_access_institution(
      organization_id,
      (SELECT p.institution_id FROM public.programmes p WHERE p.id = programme_id)
    )
  );
