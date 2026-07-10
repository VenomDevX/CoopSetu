import {
  EntityDetailLayout, EntityForbidden, EntityNotFound, type BadgeTone, type TimelineItem,
} from '@/components/dashboard/entity-detail-layout';
import { loadDetail, resolveMemberNames, linkProject, linkRelease } from '@/lib/dashboard/load-detail';
import { AskAiButton } from '@/components/ai/ask-ai-button';

const LIST = { href: '/dashboard/incidents', label: 'Incidents' };

interface TimelineEvent { actor_member_id: string | null; event_type: string; message: string; occurred_at: string }
interface Incident {
  id: string; organization_id: string; project_id: string | null; release_id: string | null;
  title: string; severity: string; status: string; incident_commander_member_id: string | null;
  affected_services: unknown; customer_impact: string | null; started_at: string; resolved_at: string | null;
  summary: string | null; root_cause: string | null; created_at: string; updated_at: string;
  incident_timeline_events: TimelineEvent[] | null;
}

const severityTone = (s: string): BadgeTone => (s === 'SEV1' ? 'red' : s === 'SEV2' ? 'orange' : 'gray');
const statusTone = (s: string): BadgeTone => (s === 'RESOLVED' ? 'green' : s === 'OPEN' ? 'red' : 'orange');

export default async function IncidentDetailPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  // Incidents require organization membership only (matches the incidents API).
  const res = await loadDetail<Incident>({
    table: 'incidents', id: incidentId,
    select: 'id, organization_id, project_id, release_id, title, severity, status, incident_commander_member_id, affected_services, customer_impact, started_at, resolved_at, summary, root_cause, created_at, updated_at, incident_timeline_events(actor_member_id, event_type, message, occurred_at)',
  });
  if (res.state === 'forbidden') return <EntityForbidden backHref={LIST.href} backLabel={`Back to ${LIST.label}`} />;
  if (res.state === 'notfound') return <EntityNotFound backHref={LIST.href} backLabel={`Back to ${LIST.label}`} />;

  const inc = res.data;
  const { supabase } = res;
  const events = [...(inc.incident_timeline_events ?? [])].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const [names, project, release] = await Promise.all([
    resolveMemberNames(supabase, [inc.incident_commander_member_id, ...events.map((e) => e.actor_member_id)]),
    linkProject(supabase, inc.project_id),
    linkRelease(supabase, inc.release_id),
  ]);
  const commander = inc.incident_commander_member_id ? names[inc.incident_commander_member_id] ?? 'Unknown member' : 'Unassigned';
  const services = Array.isArray(inc.affected_services) ? (inc.affected_services as string[]).join(', ') : '';

  // Real timeline from incident events; fall back to lifecycle timestamps.
  const timeline: TimelineItem[] = events.length > 0
    ? events.map((e) => ({
        label: e.event_type.replace(/_/g, ' '),
        at: e.occurred_at,
        detail: e.actor_member_id && names[e.actor_member_id] ? `${names[e.actor_member_id]}: ${e.message}` : e.message,
      }))
    : [
        { label: 'Started', at: inc.started_at },
        ...(inc.resolved_at ? [{ label: 'Resolved', at: inc.resolved_at }] : []),
      ];

  return (
    <EntityDetailLayout
      breadcrumb={LIST}
      recordLabel={`INCIDENT · ${inc.severity}`}
      title={inc.title}
      badges={[{ label: inc.severity, tone: severityTone(inc.severity) }, { label: inc.status.replace(/_/g, ' '), tone: statusTone(inc.status) }]}
      actions={<AskAiButton intent="summarize-incident" incidentId={incidentId} title="Incident Summary" />}
      fields={[
        { label: 'Status', value: inc.status.replace(/_/g, ' ') },
        { label: 'Severity', value: inc.severity },
        { label: 'Incident commander', value: commander },
        { label: 'Affected services', value: services || '—' },
        { label: 'Started', value: new Date(inc.started_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) },
        { label: 'Resolved', value: inc.resolved_at ? new Date(inc.resolved_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
        ...(project ? [{ label: 'Project', value: project.label, href: project.href }] : []),
        ...(release ? [{ label: 'Release', value: release.label, href: release.href }] : []),
      ]}
      sections={[
        { label: 'Customer impact', body: inc.customer_impact },
        { label: 'Summary', body: inc.summary },
        { label: 'Root cause', body: inc.root_cause },
      ]}
      timeline={timeline}
    />
  );
}
