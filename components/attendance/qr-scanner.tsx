'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Scans a trainee's rotating ID QR from a trainer's phone.
 *
 * html5-qrcode has been a dependency with zero importers, so the only way to
 * scan a code was the ESP32 terminal. This gives an institute without hardware
 * the same capability using a phone the trainer already has.
 *
 * The code encodes `coopsetu:<user id>:<totp>`, which is what
 * /api/v1/hardware/scan expects — the same format app/dashboard/id-card renders.
 *
 * Loaded dynamically: html5-qrcode touches `window` and `navigator` at module
 * scope and cannot be imported during SSR.
 */

interface Props {
  onScanned?: (result: { ok: boolean; message: string }) => void;
}

const REGION_ID = 'coopsetu-qr-region';

export function QrScanner({ onScanned }: Props) {
  const scannerRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  // Codes fire many times a second while in frame; without this the same badge
  // would be submitted dozens of times before the first response returns.
  const submittingRef = useRef(false);
  const lastRef = useRef<string>('');

  const stop = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop();
      scannerRef.current?.clear?.();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => () => { void stop(); }, [stop]);

  const submit = useCallback(async (text: string) => {
    if (submittingRef.current || text === lastRef.current) return;
    submittingRef.current = true;
    lastRef.current = text;
    setStatus('working');
    setMessage('Marking attendance…');

    try {
      const res = await fetch('/api/v1/hardware/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanned_text: text }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus('scanning');
        submittingRef.current = false;
        // Let the same badge be retried after a failure — a rotating TOTP means
        // the next attempt carries a different code.
        lastRef.current = '';
        setMessage(json?.error || 'That code was not accepted.');
        onScanned?.({ ok: false, message: json?.error || 'Not accepted' });
        return;
      }

      await stop();
      setStatus('done');
      setMessage(json?.data?.message || 'Attendance marked.');
      onScanned?.({ ok: true, message: json?.data?.message || 'Attendance marked.' });
    } catch (err: any) {
      setStatus('scanning');
      submittingRef.current = false;
      lastRef.current = '';
      setMessage(`Could not reach the server: ${err?.message ?? 'unknown error'}`);
    }
  }, [onScanned, stop]);

  const start = useCallback(async () => {
    setStatus('starting');
    setMessage('Starting camera…');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(REGION_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => { void submit(decoded); },
        // Per-frame decode misses are the normal case, not errors worth showing.
        () => {},
      );

      setStatus('scanning');
      setMessage('Point the camera at a trainee’s ID code.');
    } catch (err: any) {
      setStatus('error');
      setMessage(
        String(err?.message || err).includes('Permission')
          ? 'Camera permission was refused. Allow it in your browser and try again.'
          : `Could not start the scanner: ${err?.message ?? 'unknown error'}`,
      );
    }
  }, [submit]);

  return (
    <div className="border border-border rounded bg-background p-5 space-y-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <ScanLine className="w-3.5 h-3.5" /> Scan trainee ID
      </div>

      {/* html5-qrcode injects its video into this element by id, so it must be
          in the DOM before start() runs — hidden rather than conditional. */}
      <div
        id={REGION_ID}
        className={`rounded overflow-hidden border border-border bg-black ${
          status === 'scanning' || status === 'working' ? 'block' : 'hidden'
        }`}
      />

      {(status === 'idle' || status === 'done' || status === 'error') && (
        <div className="rounded border border-border bg-surface aspect-[4/3] flex items-center justify-center">
          {status === 'done'
            ? <CheckCircle2 className="w-10 h-10 text-green-500" />
            : <ScanLine className="w-10 h-10 text-muted-foreground" />}
        </div>
      )}

      {message && (
        <p className={`text-xs font-mono flex items-start gap-2 ${
          status === 'error' ? 'text-red-500' : status === 'done' ? 'text-green-500' : 'text-muted-foreground'
        }`}>
          {status === 'error' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {message}
        </p>
      )}

      <div className="flex gap-2">
        {status === 'idle' && (
          <Button onClick={start} data-native-tap className="rounded font-mono text-xs uppercase w-full">
            <ScanLine className="w-4 h-4 mr-2" /> Start scanning
          </Button>
        )}
        {(status === 'scanning' || status === 'working') && (
          <Button
            variant="outline"
            onClick={() => { void stop(); setStatus('idle'); setMessage(''); }}
            data-native-tap
            className="rounded font-mono text-xs uppercase w-full"
          >
            {status === 'working' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Stop
          </Button>
        )}
        {(status === 'done' || status === 'error') && (
          <Button
            variant="outline"
            onClick={() => { lastRef.current = ''; submittingRef.current = false; setStatus('idle'); setMessage(''); }}
            data-native-tap
            className="rounded font-mono text-xs uppercase w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Scan another
          </Button>
        )}
      </div>
    </div>
  );
}
