import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';

export async function listSecurityReviews(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('security_reviews').select('*, security_review_checks(*)')
    .eq('organization_id', orgId).order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listFindings(supabase: SupabaseClient, orgId: string, projectId?: string) {
  let q = supabase.from('security_findings').select('*').eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listComplianceControls(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('compliance_controls').select('*')
    .eq('organization_id', orgId).order('created_at', { ascending: false });
  if (error) throw Errors.internal(error.message);
  return data;
}
