'use client';

import { useEffect, useState } from 'react';
import { Github, Lock, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { apiGet, apiSend } from '@/lib/api/client';

interface GithubRepoSummary {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  html_url: string;
  private: boolean;
  updated_at: string;
}

const fmtRel = (iso?: string | null) => {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

export function ImportGithubRepoModal({
  githubIntegration,
  onClose,
  onSuccess,
}: {
  githubIntegration: { id: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!githubIntegration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!githubIntegration) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiGet<{ integration_id: string; repos: GithubRepoSummary[] }>('/api/v1/integrations/github/repos')
      .then((data) => setRepos(data.repos))
      .catch((err) => setError(err.message ?? 'Failed to load GitHub repositories.'))
      .finally(() => setLoading(false));
  }, [githubIntegration]);

  async function handleImport() {
    if (!githubIntegration || selectedId == null || !repos) return;
    const repo = repos.find((r) => r.id === selectedId);
    if (!repo) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/v1/repositories/import', 'POST', {
        integration_id: githubIntegration.id,
        github_repo_id: repo.id,
        full_name: repo.full_name,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? 'Failed to import repository.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={<><Github className="w-4 h-4" /> Import From GitHub</>}
      onClose={onClose}
      className="max-w-2xl sm:max-h-[85vh]"
      bodyClassName="space-y-5"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 border border-border rounded-[6px] font-mono text-xs uppercase tracking-widest">
            Cancel
          </button>
          {githubIntegration && (
            <button
              onClick={handleImport}
              disabled={busy || selectedId == null}
              className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {busy ? 'Importing...' : 'Import'}
            </button>
          )}
        </>
      }
    >
      {!githubIntegration ? (
        <div className="space-y-4 text-center py-6">
          <Github className="w-8 h-8 mx-auto text-muted-foreground" />
          <div className="text-sm text-foreground">Connect your GitHub account to import a repository.</div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll be redirected to GitHub to approve access, then brought back here.
          </p>
          <a
            href="/api/v1/integrations/github/auth"
            className="inline-flex h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest items-center gap-2"
          >
            <Github className="w-3.5 h-3.5" /> Connect GitHub
          </a>
        </div>
      ) : (
        <>
          {loading && (
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground text-center py-8">
              Loading your repositories...
            </div>
          )}
          {!loading && error && (
            <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">
              {error}
            </div>
          )}
          {!loading && !error && repos && (
            <div className="border border-border rounded-[6px] overflow-hidden">
              <div className="p-3 bg-surface-hover border-b border-border font-mono text-[10px] uppercase tracking-widest">
                Select a repository ({repos.length})
              </div>
              <div className="max-h-72 overflow-auto divide-y divide-border">
                {repos.length === 0 && (
                  <div className="p-4 text-xs text-muted-foreground text-center">No repositories found for this account.</div>
                )}
                {repos.map((repo) => (
                  <label
                    key={repo.id}
                    className={`flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-surface-hover transition-colors ${selectedId === repo.id ? 'bg-surface-hover' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="radio"
                        name="github-repo"
                        checked={selectedId === repo.id}
                        onChange={() => setSelectedId(repo.id)}
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {repo.full_name}
                          {repo.private && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          {repo.default_branch} · updated {fmtRel(repo.updated_at)}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

