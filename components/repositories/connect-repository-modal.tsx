'use client';

import { useState } from 'react';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <Dialog
      title={<><Link2 className="w-4 h-4 text-primary" /> Connect Repository</>}
      onClose={onClose}
      className="max-w-lg sm:h-auto h-auto"
      bodyClassName="p-4 space-y-4"
    >
        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="e.g., handoff-core"
                className="font-mono text-xs rounded-[6px] h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Provider *
                </label>
                <Select name="provider" defaultValue="github" required>
                  <SelectTrigger className="w-full h-9 px-3 bg-background border border-border rounded-[6px] text-xs font-mono uppercase focus:outline-none focus:border-foreground">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="gitlab">GitLab</SelectItem>
                    <SelectItem value="bitbucket">Bitbucket</SelectItem>
                    <SelectItem value="azure_devops">Azure DevOps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Default Branch *
                </label>
                <Input
                  name="default_branch"
                  required
                  defaultValue="main"
                  className="font-mono text-xs rounded-[6px] h-9"
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
                className="font-mono text-xs rounded-[6px] h-9"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 rounded-[6px] text-xs font-mono uppercase tracking-widest"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 rounded-[6px] text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}

