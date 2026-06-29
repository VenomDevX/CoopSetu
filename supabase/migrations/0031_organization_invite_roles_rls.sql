-- Enable RLS on organization_invite_roles.
-- This table is managed exclusively through RPCs (create_invite, accept_invite).
-- Direct access is restricted: org admins/owners can read; no direct inserts/updates/deletes.

ALTER TABLE public.organization_invite_roles ENABLE ROW LEVEL SECURITY;

-- Org admins and owners can view invite roles for their organization.
CREATE POLICY "org_admins_can_view_invite_roles"
  ON public.organization_invite_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.member_roles mr ON mr.organization_member_id = om.id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE om.organization_id = organization_invite_roles.organization_id
        AND om.user_id = auth.uid()
        AND r.code IN ('ORG_OWNER', 'ORG_ADMIN')
    )
  );

-- All mutations go through security-definer RPCs, so no direct DML is allowed.
