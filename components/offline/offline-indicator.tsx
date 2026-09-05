'use client';

import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { listPendingSubmissions, listPendingProgress } from '@/lib/offline/db';
import { flushOfflineQueues } from '@/lib/offline/sync';

/**
 * Small header badge: shows when the browser is offline, and — whether
 * online or offline — how many offline actions are still queued (queued
 * assessment submissions + module-progress updates from
 * lib/offline/db.ts). Purely a status readout; the actual queueing and
 * syncing happens in the pages that produce/consume it
 * (app/dashboard/assessments/page.tsx, app/dashboard/courses/page.tsx,
 * lib/offline/sync.ts).
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const [submissions, progress] = await Promise.all([listPendingSubmissions(), listPendingProgress()]);
      setPendingCount(submissions.length + progress.length);
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — nothing to show.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading navigator.onLine (an external browser API), not mirroring render state
    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Pending count can change from other tabs/components; a light poll
    // keeps this badge honest without wiring a cross-component event bus
    // for what's a low-stakes status readout.
    const interval = setInterval(refreshPendingCount, 5000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const handleSyncNow = async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      await flushOfflineQueues();
    } finally {
      setSyncing(false);
      refreshPendingCount();
    }
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <button
      onClick={handleSyncNow}
      disabled={!isOnline || syncing}
      title={isOnline ? 'Sync queued offline actions now' : 'You are offline — actions will sync when reconnected'}
      className={`flex items-center gap-1.5 h-8 px-2.5 rounded border text-[10px] font-mono uppercase tracking-widest transition-colors ${
        isOnline
          ? 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          : 'border-orange-500/40 text-orange-500 bg-orange-500/10'
      }`}
    >
      {syncing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      {isOnline ? `${pendingCount} Queued` : 'Offline'}
    </button>
  );
}
