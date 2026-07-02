import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { notifyMemberByEmail } from '@/lib/notifications/notify';
import { escapeHtml } from '@/lib/email/send-email';

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
  // Defense-in-depth: project_id is a client-supplied UUID; verify it belongs
  // to this org rather than relying solely on the FK existing cross-org.
  if (input.project_id) {
    const { data: project } = await supabase.from('projects').select('id').eq('id', input.project_id).eq('organization_id', orgId).maybeSingle();
    if (!project) throw Errors.validation('Selected project does not belong to this organization.');
  }

  const { data, error } = await supabase.from('incidents').insert({
    ...input, organization_id: orgId, incident_commander_member_id: memberId, status: 'OPEN',
  }).select('*').single();
  if (error) throw Errors.internal(error.message);
  await supabase.from('incident_timeline_events').insert({
    incident_id: data.id, actor_member_id: memberId, event_type: 'DECLARED', message: 'Incident declared.',
  });
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'incident.created', entityType: 'incident',
    entityId: data.id, projectId: input.project_id ?? null,
  });
  notifyMemberByEmail(
    supabase, memberId,
    `Incident declared: ${input.title}`,
    `<p>You declared incident <strong>${escapeHtml(input.title)}</strong>${input.severity ? ` (severity ${escapeHtml(input.severity)})` : ''}. This is a confirmation receipt.</p>`,
  ).then(() => {}, () => {});
  return data;
}

export async function updateIncident(
  supabase: SupabaseClient, orgId: string, incidentId: string,
  input: Record<string, unknown>,
) {
  if (input.status === 'RESOLVED') input.resolved_at = new Date().toISOString();
  const { data, error } = await supabase.from('incidents').update(input).eq('id', incidentId).eq('organization_id', orgId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.forbidden();
  await createAuditLog(supabase, {
    organizationId: orgId, action: 'incident.updated', entityType: 'incident',
    entityId: incidentId, projectId: data.project_id, afterState: input,
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
