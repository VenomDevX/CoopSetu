import {
  EntityDetailLayout, EntityForbidden, EntityNotFound, type BadgeTone, type TimelineItem,
} from '@/components/dashboard/entity-detail-layout';
import { loadDetail, resolveMemberNames, linkProject, linkRelease, linkTask } from '@/lib/dashboard/load-detail';

const INBOX = { href: '/dashboard/inbox', label: 'Inbox' };

interface ApprovalRequest {
  id: string; organization_id: string; project_id: string | null; task_id: string | null; release_id: string | null;
  approval_type: string; requested_by_member_id: string | null; status: string; required_role: string | null;
  due_date: string | null; created_at: string; updated_at: string;
}

const statusTone = (s: string): BadgeTone =>
  s === 'APPROVED' ? 'green' : s === 'REJECTED' ? 'red' : s === 'CANCELLED' ? 'gray' : 'orange';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

export default async function ApprovalDetailPage({ params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await params;
  const res = await loadDetail<ApprovalRequest>({
    table: 'approval_requests', id: approvalId, permission: 'approval:view',
    select: 'id, organization_id, project_id, task_id, release_id, approval_type, requested_by_member_id, status, required_role, due_date, created_at, updated_at',
  });
  if (res.state === 'forbidden') return <EntityForbidden backHref={INBOX.href} backLabel={`Back to ${INBOX.label}`} />;
  if (res.state === 'notfound') return <EntityNotFound backHref={INBOX.href} backLabel={`Back to ${INBOX.label}`} />;

  const a = res.data;
  const { supabase } = res;
  const [names, project, task, release] = await Promise.all([
    resolveMemberNames(supabase, [a.requested_by_member_id]),
    linkProject(supabase, a.project_id),
    linkTask(supabase, a.task_id),
    linkRelease(supabase, a.release_id),
  ]);
  const requester = a.requested_by_member_id ? names[a.requested_by_member_id] ?? 'Unknown member' : '—';
  const typeLabel = a.approval_type.replace(/_/g, ' ');

  const timeline: TimelineItem[] = [
    { label: 'Requested', at: a.created_at, detail: requester !== '—' ? `By ${requester}` : null },
    ...(a.updated_at && a.updated_at !== a.created_at ? [{ label: a.status === 'PENDING' ? 'Last updated' : `Marked ${a.status.toLowerCase()}`, at: a.updated_at }] : []),
  ];

  return (
    <EntityDetailLayout
      breadcrumb={INBOX}
      recordLabel="APPROVAL REQUEST"
      title={`${typeLabel} approval`}
      badges={[{ label: a.status.replace(/_/g, ' '), tone: statusTone(a.status) }]}
      fields={[
        { label: 'Approval type', value: typeLabel },
        { label: 'Status', value: a.status.replace(/_/g, ' ') },
        { label: 'Required role', value: a.required_role ?? '—' },
        { label: 'Requested by', value: requester },
        { label: 'Due date', value: fmtDate(a.due_date) },
        ...(project ? [{ label: 'Project', value: project.label, href: project.href }] : []),
        ...(task ? [{ label: 'Linked task', value: task.label, href: task.href }] : []),
        ...(release ? [{ label: 'Release', value: release.label, href: release.href }] : []),
      ]}
      timeline={timeline}
    />
  );
}
