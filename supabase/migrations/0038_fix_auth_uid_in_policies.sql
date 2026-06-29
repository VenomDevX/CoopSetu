-- ============================================================================
-- Handoff — 0038 Fix auth.uid() in RLS policies
-- Wrap bare auth.uid() calls in (SELECT auth.uid()) so Postgres evaluates
-- the session value once per query instead of once per row.
-- ============================================================================

-- profiles
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_members me
      JOIN public.organization_members them
        ON them.organization_id = me.organization_id
      WHERE me.user_id = (SELECT auth.uid()) AND me.is_active
        AND them.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- organizations
DROP POLICY IF EXISTS organizations_insert ON public.organizations;
CREATE POLICY organizations_insert ON public.organizations
  FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

-- permissions & role_permissions (from 0004)
DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- saved_views (from 0009)
DROP POLICY IF EXISTS saved_views_select ON public.saved_views;
CREATE POLICY saved_views_select ON public.saved_views FOR SELECT
  USING (handoff.is_org_member(organization_id) AND (is_shared OR EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.id = owner_member_id AND m.user_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS saved_views_manage ON public.saved_views;
CREATE POLICY saved_views_manage ON public.saved_views FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.id = owner_member_id AND m.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.id = owner_member_id AND m.user_id = (SELECT auth.uid())));
