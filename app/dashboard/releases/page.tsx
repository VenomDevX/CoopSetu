import Link from 'next/link';
import { ChevronRight, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { hasPermission } from '@/lib/auth/require-organization';
import { EntityForbidden } from '@/components/dashboard/entity-detail-layout';
import { ClientReleasesActions } from '@/components/releases/client-releases-actions';

interface ReleaseRow {
  id: string; name: string; version: string | null; status: string; planned_release_at: string | null;
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

const statusClass = (s: string) =>
  s === 'BLOCKED' ? 'border-destructive text-destructive bg-destructive/10'
    : s === 'DEPLOYED' || s === 'APPROVED_FOR_DEPLOYMENT' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
    : s === 'ROLLED_BACK' ? 'border-border text-muted-foreground bg-surface'
    : 'border-orange-500 text-orange-500 bg-orange-500/10';

/**
 * Releases queue — the breadcrumb target for release detail pages. Lists the
 * organization's real releases (RLS + permission scoped); each row links to its
 * stable detail route.
 */
export default async function ReleasesListPage() {
  const supabase = await createClient();
  const m = await getCurrentMembership();
  if (!m || !hasPermission(m, 'release:view')) {
    return <EntityForbidden backHref="/dashboard" backLabel="Back to dashboard" />;
  }
  const { data } = await supabase
    .from('releases')
    .select('id, name, version, status, planned_release_at')
    .eq('organization_id', m.organizationId)
    .order('created_at', { ascending: false });
  const releases = (data ?? []) as ReleaseRow[];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Delivery</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Rocket className="w-5 h-5" /> Releases
          </h1>
          <ClientReleasesActions />
        </div>
      </div>

      <div className="border border-border bg-background">
        {releases.length === 0 ? (
          <div className="p-6 text-xs font-mono text-muted-foreground">No releases in this organization yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {releases.map((r) => (
              <Link key={r.id} href={`/dashboard/releases/${r.id}`} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{r.name} {r.version && <span className="font-mono text-[10px] text-muted-foreground">v{r.version}</span>}</div>
                  <div className="font-mono text-[10px] uppercase text-muted-foreground mt-1">Target: {fmtDate(r.planned_release_at)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${statusClass(r.status)}`}>{r.status.replace(/_/g, ' ')}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
