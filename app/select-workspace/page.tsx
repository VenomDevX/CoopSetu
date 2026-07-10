'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { setActiveWorkspace } from '@/app/actions/workspace';

export default function SelectWorkspacePage() {
  return (
    <Suspense>
      <SelectWorkspaceInner />
    </Suspense>
  );
}

function SelectWorkspaceInner() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspaces() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          job_title,
          organizations(name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        setError('Failed to load workspaces.');
      } else {
        setWorkspaces(data || []);
      }
      setLoading(false);
    }
    loadWorkspaces();
  }, [router]);

  async function selectWorkspace(orgId: string) {
    await setActiveWorkspace(orgId);
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground selection:bg-foreground selection:text-background font-sans p-6 sm:p-12 items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center gap-3 justify-center mb-12">
          <Logo width={32} height={32} />
          <span className="uppercase tracking-widest text-base font-bold">HANDOFF</span>
        </div>

        <div className="text-center space-y-2 mb-12">
          <h1 className="text-3xl font-semibold tracking-tight">Select Workspace</h1>
          <p className="text-sm text-muted-foreground">Choose an organization to continue.</p>
        </div>

        {error && <div className="text-red-500 font-mono text-center text-sm">{error}</div>}

        {loading ? (
          <div className="text-muted-foreground font-mono text-center text-sm">Loading workspaces...</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <button
                key={ws.organization_id}
                onClick={() => selectWorkspace(ws.organization_id)}
                className="flex flex-col items-start p-6 border border-border rounded bg-surface hover:bg-surface-hover hover:border-foreground transition-all group text-left"
              >
                <h3 className="font-medium text-lg mb-1">{ws.organizations?.name || 'Unknown Company'}</h3>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-4">
                  {ws.job_title || 'Member'}
                </p>
                <div className="mt-auto pt-4 border-t border-border w-full flex justify-between items-center text-xs font-mono">
                  <span>Open Workspace</span>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
