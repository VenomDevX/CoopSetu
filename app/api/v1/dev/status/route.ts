import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';

/**
 * Local developer status endpoint. Dev-only, and only for org owners/admins.
 * Reports connection health + the caller's effective access + seed counts.
 */
export async function GET() {
  return handle(async () => {
    if (process.env.NODE_ENV === 'production') throw Errors.notFound();

    const { user, supabase } = await requireUser();
    const m = await requireOrganization();

    const isAdmin = m.roles.some((r) => ['SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN'].includes(r));
    if (!isAdmin) throw Errors.forbidden('Developer status is restricted to organization owners/admins.');

    // --- connection checks ---
    const checks: Record<string, 'connected' | 'failed'> = {
      auth: user ? 'connected' : 'failed',
      database: 'failed',
      storage: 'failed',
    };

    const { error: dbErr } = await supabase.from('organizations').select('id').limit(1);
    checks.database = dbErr ? 'failed' : 'connected';

    try {
      const { error: stErr } = await supabase.storage.listBuckets();
      checks.storage = stErr ? 'failed' : 'connected';
    } catch {
      checks.storage = 'failed';
    }

    // --- seed counts (org-scoped via RLS) ---
    async function count(table: string) {
      const { count } = await supabase
        .from(table).select('id', { count: 'exact', head: true })
        .eq('organization_id', m.organizationId);
      return count ?? 0;
    }
    const [projects, tasks, members, teams] = await Promise.all([
      count('projects'), count('tasks'),
      supabase.from('organization_members').select('id', { count: 'exact', head: true })
        .eq('organization_id', m.organizationId).then((r) => r.count ?? 0),
      count('teams'),
    ]);

    const { data: org } = await supabase
      .from('organizations').select('name, slug').eq('id', m.organizationId).maybeSingle();

    return ok({
      checks,
      env: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        aiMode: process.env.HANDOFF_AI_MODE ?? 'mock',
        nodeEnv: process.env.NODE_ENV,
      },
      user: { id: user.id, email: user.email },
      organization: { id: m.organizationId, name: org?.name, slug: org?.slug },
      member: { id: m.memberId, roles: m.roles, permissions: m.permissions },
      seed: { members, teams, projects, tasks },
    });
  });
}
