import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listRoles, createRole } from '@/services/role.service';

const schema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/, 'Use uppercase letters, numbers, underscores'),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).max(100).default([]),
});

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'member:view');
    return ok(await listRoles(supabase, m.organizationId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'member:manage');
    const body = schema.parse(await req.json());
    return ok(await createRole(supabase, m.organizationId, body), undefined, 201);
  });
}
