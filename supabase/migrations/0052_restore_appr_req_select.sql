-- ============================================================================
-- Handoff — 0052 Restore appr_req_select policy
-- ============================================================================
-- Migration 0032 mistakenly dropped the appr_req_select policy, assuming it 
-- was redundant with appr_req_manage. However, appr_req_manage restricts
-- access to managers, while appr_req_select allowed all org members to view
-- approval requests. This restores the intended read visibility.
-- ============================================================================

CREATE POLICY appr_req_select ON public.approval_requests 
  FOR SELECT USING (handoff.is_org_member(organization_id));
