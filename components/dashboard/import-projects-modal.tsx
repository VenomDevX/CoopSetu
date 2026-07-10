'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Dialog, dialogLabelCls as labelCls, dialogFieldCls as fieldCls } from '@/components/ui/dialog';

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
  const headers = preview?.headers ?? [];
  const shownRows = result?.rows.slice(0, 20) ?? preview?.rows ?? [];

  return (
    <Dialog
      title={<><Upload className="w-4 h-4" /> Import Projects</>}
      onClose={onClose}
      className="max-w-4xl sm:max-h-[92vh]"
      bodyClassName="space-y-6"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 border border-border rounded font-mono text-xs uppercase tracking-widest">
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
        </>
      }
    >
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
              <div className="border border-border rounded bg-surface p-4">
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
                <div className="border border-border rounded p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Rows</div>
                  <div className="text-xl font-bold">{result?.summary.total ?? preview.summary.total}</div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Created / Valid</div>
                  <div className="text-xl font-bold">{result?.summary.created ?? preview.summary.valid}</div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">Skipped / Invalid</div>
                  <div className="text-xl font-bold">{result?.summary.skipped ?? preview.summary.invalid}</div>
                </div>
              </div>

              <div className="border border-border rounded overflow-hidden">
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
    </Dialog>
  );
}
