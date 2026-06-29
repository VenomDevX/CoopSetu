import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { projectImportMappingSchema } from '@/lib/validation/group-a-actions';
import { confirmProjectImport } from '@/services/project-import.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ importId: string }> },
) {
  return handle(async () => {
    const { importId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:import');
    const body = projectImportMappingSchema.parse(await req.json());
    return ok(await confirmProjectImport(supabase, m.organizationId, m.memberId, importId, body));
  });
}
