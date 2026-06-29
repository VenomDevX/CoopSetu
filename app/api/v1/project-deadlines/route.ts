import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireAnyPermission, requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createProjectDeadlineSchema } from '@/lib/validation/group-a-actions';
import { createProjectDeadline, listProjectDeadlines } from '@/services/deadline.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:view');
    return ok(await listProjectDeadlines(supabase, m.organizationId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requireAnyPermission(m, ['deadline:create', 'project:update']);
    const body = createProjectDeadlineSchema.parse(await req.json());
    return ok(
      await createProjectDeadline(supabase, m.organizationId, m.memberId, body),
      undefined,
      201,
    );
  });
}
