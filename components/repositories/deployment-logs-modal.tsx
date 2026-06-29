'use client';

import { X, TerminalSquare, AlertCircle, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fmtRel = (iso?: string | null) => {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

interface Deployment {
  id: string;
  release_id: string;
  version: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  logs_summary: string | null;
}

interface Props {
  deployments: Deployment[];
  onClose: () => void;
}

export function DeploymentLogsModal({ deployments, onClose }: Props) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DEPLOYED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'FAILED': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'ROLLED_BACK': return <RotateCcw className="w-4 h-4 text-muted-foreground" />;
      default: return <Clock className="w-4 h-4 text-accent" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover flex-shrink-0">
          <h2 className="text-sm font-mono uppercase tracking-widest font-bold flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-primary" />
            Deployment Logs
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-none hover:bg-background">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {deployments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-mono text-xs uppercase">
              No deployments found.
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map((dep) => (
                <div key={dep.id} className="border border-border bg-surface-hover overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between p-3 border-b border-border bg-background">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(dep.status)}
                      <span className="font-mono text-xs font-bold uppercase tracking-widest">
                        {dep.version || 'UNKNOWN VERSION'}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {fmtRel(dep.started_at)}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${
                      dep.status === 'DEPLOYED' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' :
                      dep.status === 'FAILED' ? 'border-destructive/20 text-destructive bg-destructive/5' :
                      dep.status === 'ROLLED_BACK' ? 'border-border text-muted-foreground bg-background' :
                      'border-accent/20 text-accent bg-accent/5'
                    }`}>
                      {dep.status}
                    </span>
                  </div>
                  <div className="p-3 bg-black text-emerald-400 font-mono text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {dep.logs_summary || 'No logs available.'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end bg-background flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
