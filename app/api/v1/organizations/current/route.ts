import { handle, ok } from '@/lib/api/response';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { requireUser } from '@/lib/auth/require-user';
import { updateOrganizationSchema } from '@/lib/validation/organization';
import { getCurrentOrganization, updateOrganization } from '@/services/organization.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const membership = await requireOrganization();
    const org = await getCurrentOrganization(supabase, membership.organizationId);
    return ok({ ...org, membership });
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const membership = await requireOrganization();
    requirePermission(membership, 'organization:manage');
    const body = updateOrganizationSchema.parse(await req.json());
    const org = await updateOrganization(supabase, membership.organizationId, body);
    return ok(org);
  });
}
