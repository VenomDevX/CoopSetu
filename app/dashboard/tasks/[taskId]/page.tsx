import { redirect } from 'next/navigation';
import { EntityForbidden } from '@/components/dashboard/entity-detail-layout';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { hasPermission } from '@/lib/auth/require-organization';
import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership, 'task:view')) {
    return <EntityForbidden backHref={TASKS.href} backLabel={`Back to ${TASKS.label}`} />;
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  if (error || !data) {
    return <EntityForbidden backHref={TASKS.href} backLabel={`Back to ${TASKS.label}`} />;
  }

  redirect(`/dashboard/tasks?task=${data.id}`);
}
