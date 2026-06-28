import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { addProjectMemberSchema } from '@/lib/validation/project';
import { addProjectMember } from '@/services/project.service';

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:manage_members');
    const body = addProjectMemberSchema.parse(await req.json());
    return ok(await addProjectMember(supabase, m.organizationId, projectId, body), undefined, 201);
  });
}
