import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createDepartmentSchema } from '@/lib/validation/team';
import { listDepartments, createDepartment } from '@/services/team.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'team:view');
    return ok(await listDepartments(supabase, m.organizationId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'team:create');
    const body = createDepartmentSchema.parse(await req.json());
    return ok(await createDepartment(supabase, m.organizationId, body), undefined, 201);
  });
}
