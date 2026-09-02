-- ============================================================================
-- Handoff — 0015 Tighten base employee (DEVELOPER) permissions
-- Spec: employees see personal progress only — not company-wide analytics.
-- Remove analytics:view from DEVELOPER so they get the personal overview.
-- (QA/Security/PM/Manager/Admin keep analytics:view.)
-- ============================================================================

delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.organization_id is null
  and r.code = 'DEVELOPER'
  and rp.permission_code = 'analytics:view';
