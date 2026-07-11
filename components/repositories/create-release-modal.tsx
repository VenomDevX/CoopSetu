'use client';

import { useState, useEffect } from 'react';
import { Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateReleaseModal({ onClose, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    fetch('/api/v1/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || []);
        setLoadingProjects(false);
      })
      .catch(() => {
        setLoadingProjects(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const data = {
      project_id: fd.get('project_id') as string,
      name: fd.get('name') as string,
      version: fd.get('version') as string,
      description: fd.get('description') as string || undefined,
      requires_compliance_approval: fd.get('requires_compliance_approval') === 'on',
      rollback_plan: fd.get('rollback_plan') as string || undefined,
      planned_release_at: fd.get('planned_release_at') ? new Date(fd.get('planned_release_at') as string).toISOString() : undefined,
    };

    try {
      const res = await fetch('/api/v1/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to create release.');
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
      title={<><Rocket className="w-4 h-4 text-primary" /> Create Release</>}
      onClose={onClose}
      className="max-w-lg"
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
                Project *
              </label>
              <Select name="project_id" required disabled={loadingProjects}>
                <SelectTrigger className="w-full h-9 px-3 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:border-foreground">
                  <SelectValue placeholder={loadingProjects ? 'Loading projects...' : 'Select Project...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{loadingProjects ? 'Loading projects...' : 'Select Project...'}</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Release Name *
                </label>
                <Input
                  name="name"
                  required
                  placeholder="e.g., Summer Launch"
                  className="font-mono text-xs rounded h-9"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Version *
                </label>
                <Input
                  name="version"
                  required
                  placeholder="e.g., v1.4.0"
                  className="font-mono text-xs rounded h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full p-3 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:border-foreground resize-none"
                placeholder="Brief description of this release..."
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Planned Release Date
              </label>
              <Input
                name="planned_release_at"
                type="datetime-local"
                className="font-mono text-xs rounded h-9"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Rollback Plan
              </label>
              <textarea
                name="rollback_plan"
                rows={2}
                className="w-full p-3 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:border-foreground resize-none"
                placeholder="Steps to rollback if deployment fails..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2 group w-fit">
              <Checkbox
                name="requires_compliance_approval"
                id="requires_compliance_approval"
              />
              <label htmlFor="requires_compliance_approval" className="text-xs font-mono uppercase tracking-widest text-foreground cursor-pointer">
                Requires Compliance Approval
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Release'}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
