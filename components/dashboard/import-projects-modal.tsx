'use client';

import { useState } from 'react';
import { X, Upload } from 'lucide-react';

type Mapping = {
  name: string;
  code: string;
  description?: string;
  priority?: string;
  status?: string;
  start_date?: string;
  target_end_date?: string;
};

type ImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
  status: 'VALID' | 'INVALID';
  errors: string[];
  created_resource_id?: string | null;
};

type Preview = {
  importId: string;
  headers: string[];
  mapping: Mapping;
  rows: ImportRow[];
  summary: { valid: number; invalid: number; total: number };
};

type ConfirmResult = {
  summary: { created: number; skipped: number; failed: number; total: number };
  rows: ImportRow[];
};

export function ImportProjectsModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function previewFile() {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    body.set('file', file);
    const res = await fetch('/api/v1/projects/imports/preview', { method: 'POST', body });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Failed to preview CSV.');
      return;
    }
    setPreview(json.data);
    setMapping(json.data.mapping);
  }

  async function confirmImport() {
    if (!preview || !mapping) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/projects/imports/${preview.importId}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mapping),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Failed to import projects.');
      return;
    }
    setResult(json.data);
    onImported();
  }

  const setMap = (key: keyof Mapping, value: string) =>
    setMapping((current) => ({ ...(current ?? {} as Mapping), [key]: value }));
  const labelCls = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block';
  const fieldCls = 'w-full h-9 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors';
  const headers = preview?.headers ?? [];
  const shownRows = result?.rows.slice(0, 20) ?? preview?.rows ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl bg-background sm:border sm:border-border sm:shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import Projects
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className={labelCls}>CSV File</label>
              <input
                data-testid="project-import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                  setError(null);
                }}
                className={fieldCls}
              />
            </div>
            <button
              data-testid="project-import-preview"
              onClick={previewFile}
              disabled={busy}
              className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {busy && !preview ? 'Reading...' : 'Preview'}
            </button>
          </div>

          {preview && mapping && (
            <>
              <div className="border border-border bg-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                  Column Mapping
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    ['name', 'Project Name *'],
                    ['code', 'Project Code *'],
                    ['description', 'Description'],
                    ['priority', 'Priority'],
                    ['status', 'Status'],
                    ['start_date', 'Start Date'],
                    ['target_end_date', 'Target Date'],
                  ] as [keyof Mapping, string][]).map(([key, label]) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <select
                        data-testid={`project-import-map-${key}`}
                        value={mapping[key] ?? ''}
                        onChange={(e) => setMap(key, e.target.value)}
                        className={fieldCls}
                      >
                        <option value="">Not mapped</option>
                        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="border border-border p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Rows</div>
                  <div className="text-xl font-bold">{result?.summary.total ?? preview.summary.total}</div>
                </div>
                <div className="border border-border p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Created / Valid</div>
                  <div className="text-xl font-bold">{result?.summary.created ?? preview.summary.valid}</div>
                </div>
                <div className="border border-border p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Skipped / Invalid</div>
                  <div className="text-xl font-bold">{result?.summary.skipped ?? preview.summary.invalid}</div>
                </div>
              </div>

              <div className="border border-border overflow-hidden">
                <div className="p-3 bg-surface-hover border-b border-border font-mono text-[10px] uppercase tracking-widest">
                  Row Review
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border">
                        <th className="p-2 font-mono text-[10px] uppercase text-muted-foreground">Row</th>
                        <th className="p-2 font-mono text-[10px] uppercase text-muted-foreground">Code</th>
                        <th className="p-2 font-mono text-[10px] uppercase text-muted-foreground">Name</th>
                        <th className="p-2 font-mono text-[10px] uppercase text-muted-foreground">Status</th>
                        <th className="p-2 font-mono text-[10px] uppercase text-muted-foreground">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shownRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="p-2 font-mono">{row.rowNumber}</td>
                          <td className="p-2 font-mono">{row.mapped.code || '-'}</td>
                          <td className="p-2">{row.mapped.name || '-'}</td>
                          <td className="p-2 font-mono">{row.created_resource_id ? 'CREATED' : row.status}</td>
                          <td className="p-2 text-red-500">{row.errors.join(' ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button onClick={onClose} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">
            {result ? 'Close' : 'Cancel'}
          </button>
          {preview && !result && (
            <button
              data-testid="project-import-confirm"
              onClick={confirmImport}
              disabled={busy || !mapping?.name || !mapping?.code}
              className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {busy ? 'Importing...' : 'Confirm Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
