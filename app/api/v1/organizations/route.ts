import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { createOrganizationSchema } from '@/lib/validation/organization';
import { createOrganization, listMyOrganizations } from '@/services/organization.service';

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireUser();
    const orgs = await listMyOrganizations(supabase, user.id);
    return ok(orgs);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { user, supabase } = await requireUser();
    const body = createOrganizationSchema.parse(await req.json());
    const org = await createOrganization(supabase, user.id, body);
    return ok(org, undefined, 201);
  });
}
