'use client';

import { useState } from 'react';
import { Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface Props {
  reportId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ScheduleReportModal({ reportId, onClose, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const emails = (fd.get('recipients') as string).split(',').map(s => s.trim()).filter(Boolean);

    const data = {
      cron_expression: fd.get('cron_expression') as string,
      recipients: emails,
    };

    try {
      const res = await fetch(`/api/v1/reports/${reportId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to schedule report.');
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
      title={<><Calendar className="w-4 h-4 text-primary" /> Schedule Report Delivery</>}
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
                Cron Expression *
              </label>
              <Input
                name="cron_expression"
                required
                autoFocus
                placeholder="0 9 * * 1 (Every Monday at 9AM)"
                className="w-full h-9 rounded bg-background border-border text-sm font-mono focus-visible:ring-1 focus-visible:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-widest">
                Standard 5-field cron format
              </p>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Recipients (comma separated) *
              </label>
              <Input
                name="recipients"
                required
                placeholder="manager@example.com, team@example.com"
                className="w-full h-9 rounded bg-background border-border text-sm focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting} className="rounded font-mono uppercase tracking-widest text-xs h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded font-mono uppercase tracking-widest text-xs h-9">
              {submitting && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              Save Schedule
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
