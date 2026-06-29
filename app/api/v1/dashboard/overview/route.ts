import { NextResponse } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { resolveDashboardPersona } from '@/lib/auth/dashboard-persona';
import { getRoleAwareOverview } from '@/services/dashboard.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    
    // 1. Resolve persona
    const persona = resolveDashboardPersona(m.roles);

    // 2. Fetch properly scoped overview
    const data = await getRoleAwareOverview(supabase, {
      orgId: m.organizationId,
      memberId: m.memberId,
      persona
    });

    // 3. Return the payload. We explicitly include the persona so the UI knows which layout to render.
    return ok({ persona, ...data });
  });
}
