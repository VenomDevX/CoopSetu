'use client';

import { useEffect } from 'react';
import { registerOfflineSync } from '@/lib/offline/sync';

/**
 * Registers the offline-module service worker (public/sw.js) and the
 * `online` event listener that flushes queued offline submissions/progress
 * (lib/offline/sync.ts). Mounted once in app/layout.tsx. Renders nothing —
 * this is a side-effect-only component, not UI (see
 * components/offline/offline-indicator.tsx for the visible status badge).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    registerOfflineSync();

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[offline] service worker registration failed', err);
    });
  }, []);

  return null;
}
