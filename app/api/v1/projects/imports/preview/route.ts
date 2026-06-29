import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { previewProjectImport } from '@/services/project-import.service';

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:import');

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw Errors.validation('CSV file is required.');
    }

    return ok(await previewProjectImport(supabase, m.organizationId, m.memberId, file), undefined, 201);
  });
}
