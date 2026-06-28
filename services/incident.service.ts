import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function listIncidents(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('incidents').select('*')
    .eq('organization_id', orgId).order('started_at', { ascending: false });
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function getIncident(supabase: SupabaseClient, incidentId: string) {
  const { data, error } = await supabase.from('incidents')
    .select('*, incident_timeline_events(*), incident_participants(*), postmortems(*), incident_followups(*)')
    .eq('id', incidentId).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Incident not found.');
  return data;
}

export async function createIncident(
  supabase: SupabaseClient, orgId: string, memberId: string,
  input: { title: string; severity?: string; project_id?: string; customer_impact?: string },
) {
  const { data, error } = await supabase.from('incidents').insert({
    ...input, organization_id: orgId, incident_commander_member_id: memberId, status: 'OPEN',
  }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await supabase.from('incident_timeline_events').insert({
    incident_id: data.id, actor_member_id: memberId, event_type: 'DECLARED', message: 'Incident declared.',
  });
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'incident.created', resourceType: 'incident',
    resourceId: data.id, projectId: input.project_id ?? null,
  });
  return data;
}

export async function updateIncident(
  supabase: SupabaseClient, orgId: string, incidentId: string,
  input: Record<string, unknown>,
) {
  if (input.status === 'RESOLVED') input.resolved_at = new Date().toISOString();
  const { data, error } = await supabase.from('incidents').update(input).eq('id', incidentId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'incident.updated', resourceType: 'incident',
    resourceId: incidentId, projectId: data.project_id, newValue: input,
  });
  return data;
}

export async function addTimelineEvent(
  supabase: SupabaseClient, incidentId: string, memberId: string, message: string, eventType?: string,
) {
  const { data, error } = await supabase.from('incident_timeline_events')
    .insert({ incident_id: incidentId, actor_member_id: memberId, message, event_type: eventType ?? 'UPDATE' })
    .select('*').single();
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function upsertPostmortem(
  supabase: SupabaseClient, incidentId: string, memberId: string, fields: Record<string, unknown>,
) {
  const { data, error } = await supabase.from('postmortems')
    .upsert({ incident_id: incidentId, author_member_id: memberId, ...fields }, { onConflict: 'incident_id' })
    .select('*').single();
  if (error) throw Errors.internal(error.message);
  return data;
}
