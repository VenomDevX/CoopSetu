import {
  EntityDetailLayout, EntityForbidden, EntityNotFound, type BadgeTone, type TimelineItem,
} from '@/components/dashboard/entity-detail-layout';
import { loadDetail, resolveMemberNames, linkProject, linkRelease, linkTask } from '@/lib/dashboard/load-detail';

const QA = { href: '/dashboard/qa-security', label: 'QA & Security' };

interface Bug {
  id: string; organization_id: string; project_id: string | null; task_id: string | null; release_id: string | null;
  title: string; description: string | null; severity: string; priority: string; status: string;
  environment: string | null; reporter_member_id: string | null; assignee_member_id: string | null;
  steps_to_reproduce: string | null; expected_result: string | null; actual_result: string | null;
  root_cause: string | null; created_at: string; updated_at: string;
}

const severityTone = (s: string): BadgeTone =>
  s === 'CRITICAL' ? 'red' : s === 'HIGH' ? 'orange' : 'gray';
const statusTone = (s: string): BadgeTone =>
  s === 'OPEN' ? 'red' : s === 'IN_PROGRESS' ? 'orange' : s === 'RESOLVED' || s === 'CLOSED' ? 'green' : 'gray';

export default async function BugDetailPage({ params }: { params: Promise<{ bugId: string }> }) {
  const { bugId } = await params;
  const res = await loadDetail<Bug>({
    table: 'bugs', id: bugId, permission: 'qa:view',
    select: 'id, organization_id, project_id, task_id, release_id, title, description, severity, priority, status, environment, reporter_member_id, assignee_member_id, steps_to_reproduce, expected_result, actual_result, root_cause, created_at, updated_at',
  });
  if (res.state === 'forbidden') return <EntityForbidden backHref={QA.href} backLabel={`Back to ${QA.label}`} />;
  if (res.state === 'notfound') return <EntityNotFound backHref={QA.href} backLabel={`Back to ${QA.label}`} />;

  const bug = res.data;
  const { supabase } = res;
  const [names, project, task, release] = await Promise.all([
    resolveMemberNames(supabase, [bug.reporter_member_id, bug.assignee_member_id]),
    linkProject(supabase, bug.project_id),
    linkTask(supabase, bug.task_id),
    linkRelease(supabase, bug.release_id),
  ]);
  const name = (id: string | null) => (id ? names[id] ?? 'Unknown member' : 'Unassigned');

  const timeline: TimelineItem[] = [
    { label: 'Reported', at: bug.created_at, detail: name(bug.reporter_member_id) !== 'Unassigned' ? `By ${name(bug.reporter_member_id)}` : null },
    ...(bug.updated_at && bug.updated_at !== bug.created_at ? [{ label: 'Last updated', at: bug.updated_at }] : []),
  ];

  return (
    <EntityDetailLayout
      breadcrumb={QA}
      recordLabel={`BUG · ${bug.severity}`}
      title={bug.title}
      badges={[{ label: bug.severity, tone: severityTone(bug.severity) }, { label: bug.status.replace(/_/g, ' '), tone: statusTone(bug.status) }, { label: `${bug.priority} priority`, tone: 'gray' }]}
      fields={[
        { label: 'Status', value: bug.status.replace(/_/g, ' ') },
        { label: 'Severity', value: bug.severity },
        { label: 'Priority', value: bug.priority },
        { label: 'Environment', value: bug.environment ?? '—' },
        { label: 'Reporter', value: name(bug.reporter_member_id) },
        { label: 'Assignee', value: name(bug.assignee_member_id) },
        ...(project ? [{ label: 'Project', value: project.label, href: project.href }] : []),
        ...(task ? [{ label: 'Linked task', value: task.label, href: task.href }] : []),
        ...(release ? [{ label: 'Release', value: release.label, href: release.href }] : []),
      ]}
      sections={[
        { label: 'Description', body: bug.description },
        { label: 'Steps to reproduce', body: bug.steps_to_reproduce },
        { label: 'Expected result', body: bug.expected_result },
        { label: 'Actual result', body: bug.actual_result },
        { label: 'Root cause', body: bug.root_cause },
      ]}
      timeline={timeline}
    />
  );
}
