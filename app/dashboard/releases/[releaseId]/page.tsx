import {
  EntityDetailLayout, EntityForbidden, EntityNotFound, type BadgeTone, type TimelineItem,
} from '@/components/dashboard/entity-detail-layout';
import { loadDetail, resolveMemberNames, linkProject } from '@/lib/dashboard/load-detail';
import { AskAiButton } from '@/components/ai/ask-ai-button';

const LIST = { href: '/dashboard/releases', label: 'Releases' };

interface Release {
  id: string; organization_id: string; project_id: string | null; name: string; version: string | null;
  description: string | null; status: string; release_manager_member_id: string | null;
  planned_release_at: string | null; released_at: string | null; requires_compliance_approval: boolean;
  rollback_plan: string | null; release_notes: string | null; created_at: string; updated_at: string;
}

const statusTone = (s: string): BadgeTone =>
  s === 'BLOCKED' ? 'red'
    : s === 'DEPLOYED' || s === 'APPROVED_FOR_DEPLOYMENT' ? 'green'
    : s === 'ROLLED_BACK' ? 'gray' : 'orange';

export default async function ReleaseDetailPage({ params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params;
  const res = await loadDetail<Release>({
    table: 'releases', id: releaseId, permission: 'release:view',
    select: 'id, organization_id, project_id, name, version, description, status, release_manager_member_id, planned_release_at, released_at, requires_compliance_approval, rollback_plan, release_notes, created_at, updated_at',
  });
  if (res.state === 'forbidden') return <EntityForbidden backHref={LIST.href} backLabel={`Back to ${LIST.label}`} />;
  if (res.state === 'notfound') return <EntityNotFound backHref={LIST.href} backLabel={`Back to ${LIST.label}`} />;

  const rel = res.data;
  const { supabase } = res;
  const [names, project] = await Promise.all([
    resolveMemberNames(supabase, [rel.release_manager_member_id]),
    linkProject(supabase, rel.project_id),
  ]);
  const manager = rel.release_manager_member_id ? names[rel.release_manager_member_id] ?? 'Unknown member' : 'Unassigned';

  const timeline: TimelineItem[] = [
    { label: 'Created', at: rel.created_at },
    ...(rel.planned_release_at ? [{ label: 'Planned release', at: rel.planned_release_at }] : []),
    ...(rel.released_at ? [{ label: 'Released', at: rel.released_at }] : []),
    ...(rel.updated_at && rel.updated_at !== rel.created_at ? [{ label: 'Last updated', at: rel.updated_at }] : []),
  ];

  return (
    <EntityDetailLayout
      breadcrumb={LIST}
      recordLabel={rel.version ? `RELEASE ${rel.version}` : 'RELEASE'}
      title={rel.name}
      badges={[
        { label: rel.status.replace(/_/g, ' '), tone: statusTone(rel.status) },
        ...(rel.requires_compliance_approval ? [{ label: 'Compliance required', tone: 'orange' as BadgeTone }] : []),
      ]}
      actions={<AskAiButton intent="summarize-release" releaseId={releaseId} permission="release:view" label="Summarize Release" title="Release Summary" />}
      fields={[
        { label: 'Status', value: rel.status.replace(/_/g, ' ') },
        { label: 'Version', value: rel.version ?? '—' },
        { label: 'Release manager', value: manager },
        { label: 'Compliance approval', value: rel.requires_compliance_approval ? 'Required' : 'Not required' },
        ...(project ? [{ label: 'Project', value: project.label, href: project.href }] : []),
      ]}
      sections={[
        { label: 'Description', body: rel.description },
        { label: 'Release notes', body: rel.release_notes },
        { label: 'Rollback plan', body: rel.rollback_plan },
      ]}
      timeline={timeline}
    />
  );
}
