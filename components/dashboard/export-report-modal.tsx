'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';

function filenameFromDisposition(value: string | null, fallback: string) {
  const match = value?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

export function ExportReportModal({
  title,
  endpoint,
  filters,
  onClose,
}: {
  title: string;
  endpoint: string;
  filters: Record<string, string>;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  async function exportReport() {
    setBusy(true);
    setError(null);
    setLastExport(null);
    const params = new URLSearchParams({ ...filters, format });
    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setBusy(false);
      setError(json?.error?.message ?? 'Export failed.');
      return;
    }
    const blob = await res.blob();
    const fileName = filenameFromDisposition(res.headers.get('content-disposition'), `${title.toLowerCase().replace(/\s+/g, '-')}.csv`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBusy(false);
    setLastExport(fileName);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-background sm:border sm:border-border sm:shadow-2xl flex flex-col h-auto max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <Download className="w-4 h-4" /> {title}
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Format</label>
            <div className="grid grid-cols-2 border border-border">
              <button
                data-testid="export-format-csv"
                onClick={() => setFormat('csv')}
                className={`h-9 font-mono text-xs uppercase tracking-widest ${format === 'csv' ? 'bg-foreground text-background' : 'bg-background text-foreground'}`}
              >
                CSV
              </button>
              <button
                data-testid="export-format-pdf"
                onClick={() => setFormat('pdf')}
                className={`h-9 font-mono text-xs uppercase tracking-widest border-l border-border ${format === 'pdf' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground'}`}
              >
                PDF
              </button>
            </div>
            {format === 'pdf' && (
              <p className="mt-2 text-xs text-muted-foreground">
                PDF export is not configured for this report yet. CSV exports are available now.
              </p>
            )}
          </div>

          <div className="border border-border bg-surface p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Current Filters</div>
            <div className="space-y-1 text-xs">
              {Object.entries(filters).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <span className="font-mono uppercase text-muted-foreground">{key}</span>
                  <span className="truncate">{value || 'All'}</span>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>}
          {lastExport && <div className="border border-emerald-500/50 bg-emerald-500/10 text-emerald-500 text-xs px-3 py-2 font-mono">Downloaded {lastExport}</div>}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button onClick={onClose} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">Close</button>
          <button
            data-testid="export-report-confirm"
            onClick={exportReport}
            disabled={busy || format === 'pdf'}
            className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {busy ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
