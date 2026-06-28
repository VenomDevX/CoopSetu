import { redirect } from 'next/navigation';
import { EntityForbidden, EntityNotFound } from '@/components/dashboard/entity-detail-layout';
import { loadDetail } from '@/lib/dashboard/load-detail';

const TASKS = { href: '/dashboard/tasks', label: 'Tasks' };

/**
 * Stable, shareable direct URL for a task (used by AI citations, notifications,
 * audit links, and browser history). The rich task surface is the existing board
 * drawer, so once access is verified this redirects to the deep-link primitive
 * (`?task=`). Access is still gated here: 403/404 are rendered without exposing
 * the record, and cross-org ids resolve to 404.
 */
export default async function TaskDetailRedirect({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const res = await loadDetail<{ id: string }>({ table: 'tasks', id: taskId, permission: 'task:view', select: 'id' });
  if (res.state === 'forbidden') return <EntityForbidden backHref={TASKS.href} backLabel={`Back to ${TASKS.label}`} />;
  if (res.state === 'notfound') return <EntityNotFound backHref={TASKS.href} backLabel={`Back to ${TASKS.label}`} />;
  redirect(`/dashboard/tasks?task=${res.data.id}`);
}
