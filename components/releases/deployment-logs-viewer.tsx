'use client';

import { useState, useEffect } from 'react';
import { Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeploymentLog {
  id: string;
  log_level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

export function DeploymentLogsViewer({ deploymentId }: { deploymentId: string }) {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = () => {
    setLoading(true);
    fetch(`/api/v1/deployments/${deploymentId}/logs`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error.message);
        setLogs(data.data || data || []);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    queueMicrotask(() => fetchLogs());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId]);

  return (
    <div className="border border-border rounded bg-black text-green-400 font-mono text-[11px] overflow-hidden rounded-sm flex flex-col mt-4">
      <div className="flex items-center justify-between p-2 border-b border-white/20 bg-white/5">
        <div className="flex items-center gap-2 text-white/70 font-sans text-xs">
          <Terminal className="w-4 h-4" />
          <span>Deployment Logs</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-white hover:bg-white/20" onClick={fetchLogs} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Refresh
        </Button>
      </div>

      <div className="p-4 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
        {loading && logs.length === 0 && <div className="text-white/50">Loading logs...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
        {!loading && !error && logs.length === 0 && <div className="text-white/50">No logs found for this deployment.</div>}
        
        {logs.map(log => (
          <div key={log.id} className="flex gap-4 hover:bg-white/5">
            <span className="text-white/40 shrink-0 w-32">{new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1)}</span>
            <span className={`shrink-0 w-12 ${log.log_level === 'ERROR' ? 'text-red-400' : log.log_level === 'WARN' ? 'text-yellow-400' : 'text-green-400'}`}>
              [{log.log_level}]
            </span>
            <span className={log.log_level === 'ERROR' ? 'text-red-400' : 'text-white/90'}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
