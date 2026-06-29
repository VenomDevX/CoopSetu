'use client';

import { useState } from 'react';
import { X, Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectRepositoryModal({ onClose, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get('name') as string,
      provider: fd.get('provider') as string,
      default_branch: fd.get('default_branch') as string,
      url: fd.get('url') as string || undefined,
    };

    try {
      const res = await fetch('/api/v1/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to connect repository.');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover">
          <h2 className="text-sm font-mono uppercase tracking-widest font-bold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Connect Repository
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-none hover:bg-background">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-xs font-mono text-destructive border border-destructive/20 bg-destructive/5 uppercase tracking-wide">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Repository Name *
              </label>
              <Input
                name="name"
                required
                placeholder="e.g., devpilot-core"
                className="font-mono text-xs rounded-none h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Provider *
                </label>
                <select
                  name="provider"
                  required
                  defaultValue="github"
                  className="w-full h-9 px-3 bg-background border border-border text-xs font-mono uppercase focus:outline-none focus:border-foreground"
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="bitbucket">Bitbucket</option>
                  <option value="azure_devops">Azure DevOps</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Default Branch *
                </label>
                <Input
                  name="default_branch"
                  required
                  defaultValue="main"
                  className="font-mono text-xs rounded-none h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Repository URL
              </label>
              <Input
                name="url"
                type="url"
                placeholder="https://github.com/org/repo"
                className="font-mono text-xs rounded-none h-9"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
