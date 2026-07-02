import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission, hasPermission } from '@/lib/auth/require-organization';
import { globalSearch } from '@/services/search.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    // Same baseline gate the qa/route.ts list endpoint uses — any member who
    // can see work items can search across them.
    requirePermission(m, 'task:view');

    const q = new URL(req.url).searchParams.get('q') ?? '';
    const hits = await globalSearch(supabase, m.organizationId, q, {
      includeDocuments: hasPermission(m, 'document:view'),
    });
    return ok(hits);
  });
}
