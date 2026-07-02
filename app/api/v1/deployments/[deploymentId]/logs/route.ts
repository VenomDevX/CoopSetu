import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    const { deploymentId } = await params;

    // Verify deployment belongs to this org (indirectly via project)
    const { data: deployment, error: depErr } = await supabase
      .from('deployments')
      .select('project_id, projects!inner(organization_id)')
      .eq('id', deploymentId)
      .eq('projects.organization_id', m.organizationId)
      .maybeSingle();

    if (depErr) throw Errors.internal(depErr.message);
    if (!deployment) throw Errors.notFound('Deployment not found');

    const { data, error } = await supabase
      .from('deployment_logs')
      .select('id, log_level, message, timestamp')
      .eq('deployment_id', deploymentId)
      .order('timestamp', { ascending: true });

    if (error) throw Errors.internal(error.message);

    return ok(data);
  });
}
