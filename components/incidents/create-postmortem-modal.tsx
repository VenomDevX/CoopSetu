'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Incident {
  id: string;
  title: string;
  status: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePostmortemModal({ onClose, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);

  useEffect(() => {
    fetch('/api/v1/incidents')
      .then(res => res.json())
      .then(data => {
        setIncidents(data.incidents || data || []);
        setLoadingIncidents(false);
      })
      .catch(() => {
        setLoadingIncidents(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const incidentId = formData.get('incident_id') as string;
    
    if (!incidentId) {
      setError('Please select an incident');
      setSubmitting(false);
      return;
    }

    const payload = {
      summary: formData.get('summary') as string,
      detection: formData.get('detection') as string,
      impact: formData.get('impact') as string,
      root_cause: formData.get('root_cause') as string,
      response: formData.get('response') as string,
      resolution: formData.get('resolution') as string,
      lessons_learned: formData.get('lessons_learned') as string,
    };

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/postmortem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create postmortem');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-sans font-bold">Create Postmortem</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 font-mono">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Incident *
            </label>
            <select 
              name="incident_id" 
              required
              className="w-full h-10 px-3 py-2 bg-background border border-input text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              disabled={loadingIncidents}
            >
              <option value="">-- Select Incident --</option>
              {incidents.map(i => (
                <option key={i.id} value={i.id}>
                  {i.title} ({i.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Executive Summary
              </label>
              <textarea 
                name="summary"
                placeholder="High level overview..."
                className="w-full h-24 px-3 py-2 bg-background border border-input text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Impact
              </label>
              <textarea 
                name="impact"
                placeholder="How did this affect customers/systems?"
                className="w-full h-24 px-3 py-2 bg-background border border-input text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Detection
              </label>
              <textarea 
                name="detection"
                placeholder="How was the incident detected?"
                className="w-full h-24 px-3 py-2 bg-background border border-input text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Root Cause
              </label>
              <textarea 
                name="root_cause"
                placeholder="What was the underlying cause?"
                className="w-full h-24 px-3 py-2 bg-background border border-input text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Response & Resolution
              </label>
              <textarea 
                name="resolution"
                placeholder="How was it fixed?"
                className="w-full h-24 px-3 py-2 bg-background border border-input text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Lessons Learned
              </label>
              <textarea 
                name="lessons_learned"
                placeholder="What did we learn to prevent recurrence?"
                className="w-full h-24 px-3 py-2 bg-background border border-input text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-surface">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Postmortem
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
