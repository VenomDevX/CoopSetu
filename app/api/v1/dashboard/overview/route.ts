import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { resolveDashboardPersona } from '@/lib/auth/dashboard-persona';
import { getRoleAwareOverview } from '@/services/dashboard.service';
import { withApiTiming } from '@/lib/observability/api-timing';
import { cache } from '@/lib/cache/cache';
import { createHash } from 'crypto';

export async function GET(req: NextRequest) {
  let requestOrgId: string | null = null;
  let requestMemberId: string | null = null;
  let cacheHit = false;

  return withApiTiming(
    req,
    async () => {
      return handle(async () => {
        const { supabase } = await requireUser();
        const m = await requireOrganization();
        
        requestOrgId = m.organizationId;
        requestMemberId = m.memberId;
        
        // 1. Resolve persona
        const persona = resolveDashboardPersona(m.roles);

        // Compute key components
        const searchStr = req.nextUrl.searchParams.toString();
        const filtersHash = searchStr ? createHash('sha256').update(searchStr).digest('hex').substring(0, 8) : 'none';
        const page = req.nextUrl.searchParams.get('page') || '1';
        const workspaceType = 'default';

        // 2. Fetch versions for org, member access, and broad project scope
        const dashboardOrgVersion = await cache.getCacheVersion(`cache_versions.dashboard_org_${m.organizationId}`);
        const memberAccessVersion = await cache.getCacheVersion(`cache_versions.member_access_${m.organizationId}_${m.memberId}`);
        const projectScopeVersion = await cache.getCacheVersion(`cache_versions.project_scope_${m.organizationId}`); // Fallback broad scope if needed
        
        // Final properly structured cache key
        const cacheKey = `dashboard:overview:v1:org_${m.organizationId}:member_${m.memberId}:dashboardOrgVersion_${dashboardOrgVersion}:memberAccessVersion_${memberAccessVersion}:projectScopeVersion_${projectScopeVersion}:ws_${workspaceType}:filters_${filtersHash}:page_${page}`;

        // 3. Try Cache
        const cachedData = await cache.get<any>(cacheKey);
        if (cachedData) {
          cacheHit = true;
          return ok({ persona, ...cachedData });
        }

        // 4. Fetch properly scoped overview from DB
        const data = await getRoleAwareOverview(supabase, {
          orgId: m.organizationId,
          memberId: m.memberId,
          persona
        });

        // 5. Cache for 30s
        await cache.set(cacheKey, data, 30);

        // 6. Return the payload. We explicitly include the persona so the UI knows which layout to render.
        return ok({ persona, ...data });
      });
    },
    () => ({
      orgId: requestOrgId,
      memberId: requestMemberId,
      cacheStatus: cacheHit ? 'HIT' : 'MISS'
    })
  );
}
