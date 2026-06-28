import {
  EntityDetailLayout, EntityForbidden, EntityNotFound, type BadgeTone, type TimelineItem,
} from '@/components/dashboard/entity-detail-layout';
import { loadDetail, resolveMemberNames, linkProject, linkRelease } from '@/lib/dashboard/load-detail';

const QA = { href: '/dashboard/qa-security', label: 'QA & Security' };

interface SecurityReview {
  id: string; organization_id: string; project_id: string | null; release_id: string | null;
  title: string; status: string; risk_score: number | null; reviewer_member_id: string | null;
  due_date: string | null; summary: string | null; created_at: string; updated_at: string;
}

const statusTone = (s: string): BadgeTone =>
  s === 'APPROVED' ? 'green' : s === 'REJECTED' ? 'red' : 'orange';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

export default async function SecurityReviewDetailPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const res = await loadDetail<SecurityReview>({
    table: 'security_reviews', id: reviewId, permission: 'security:view',
    select: 'id, organization_id, project_id, release_id, title, status, risk_score, reviewer_member_id, due_date, summary, created_at, updated_at',
  });
  if (res.state === 'forbidden') return <EntityForbidden backHref={QA.href} backLabel={`Back to ${QA.label}`} />;
  if (res.state === 'notfound') return <EntityNotFound backHref={QA.href} backLabel={`Back to ${QA.label}`} />;

  const r = res.data;
  const { supabase } = res;
  const [names, project, release] = await Promise.all([
    resolveMemberNames(supabase, [r.reviewer_member_id]),
    linkProject(supabase, r.project_id),
    linkRelease(supabase, r.release_id),
  ]);
  const reviewer = r.reviewer_member_id ? names[r.reviewer_member_id] ?? 'Unknown member' : 'Unassigned';

  const timeline: TimelineItem[] = [
    { label: 'Opened', at: r.created_at },
    ...(r.updated_at && r.updated_at !== r.created_at ? [{ label: 'Last updated', at: r.updated_at }] : []),
  ];

  return (
    <EntityDetailLayout
      breadcrumb={QA}
      recordLabel="SECURITY REVIEW"
      title={r.title}
      badges={[
        { label: r.status.replace(/_/g, ' '), tone: statusTone(r.status) },
        ...(r.risk_score != null ? [{ label: `Risk ${r.risk_score}`, tone: (r.risk_score >= 7 ? 'red' : r.risk_score >= 4 ? 'orange' : 'gray') as BadgeTone }] : []),
      ]}
      fields={[
        { label: 'Status', value: r.status.replace(/_/g, ' ') },
        { label: 'Risk score', value: r.risk_score != null ? String(r.risk_score) : '—' },
        { label: 'Reviewer', value: reviewer },
        { label: 'Due date', value: fmtDate(r.due_date) },
        ...(project ? [{ label: 'Project', value: project.label, href: project.href }] : []),
        ...(release ? [{ label: 'Release', value: release.label, href: release.href }] : []),
      ]}
      sections={[{ label: 'Summary', body: r.summary }]}
      timeline={timeline}
    />
  );
}
