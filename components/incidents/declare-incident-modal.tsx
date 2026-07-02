'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function DeclareIncidentModal({ onClose, onSuccess }: Props) {
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

    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title') as string,
      severity: formData.get('severity') as string,
      project_id: formData.get('project_id') as string,
      customer_impact: formData.get('customer_impact') as string,
    };

    if (!payload.project_id) {
        delete (payload as any).project_id;
    }

    try {
      const res = await fetch('/api/v1/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to declare incident');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      title={<span className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-4 h-4" /> Declare Incident</span>}
      onClose={onClose}
      className="max-w-md sm:h-auto h-auto"
      bodyClassName="p-4 space-y-4"
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 font-mono">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Incident Title *
            </label>
            <Input 
              name="title" 
              required 
              placeholder="e.g. API Latency Spike in EU Region" 
              className="font-mono text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Severity *
            </label>
            <select 
              name="severity" 
              required
              className="w-full h-10 px-3 py-2 bg-background border border-input text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              defaultValue="SEV3"
            >
              <option value="SEV1">SEV1 - Critical (Entire system down)</option>
              <option value="SEV2">SEV2 - High (Major functionality broken)</option>
              <option value="SEV3">SEV3 - Medium (Partial degradation)</option>
              <option value="SEV4">SEV4 - Low (Minor issue)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Affected Project (Optional)
            </label>
            <select 
              name="project_id" 
              className="w-full h-10 px-3 py-2 bg-background border border-input text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              disabled={loadingProjects}
            >
              <option value="">-- Global / Multiple Projects --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Customer Impact
            </label>
            <textarea 
              name="customer_impact"
              placeholder="Describe how customers are affected..."
              className="w-full h-24 px-3 py-2 bg-background border border-input text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Declare Incident
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
