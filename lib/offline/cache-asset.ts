/**
 * Bridges the app to the service worker's (public/sw.js) explicit asset
 * cache — used when a trainee downloads a course module for offline
 * viewing (app/dashboard/courses/page.tsx). Never throws: a failed cache
 * attempt (no SW support, the asset's host doesn't send CORS headers, the
 * SW hasn't activated yet, etc.) resolves false so the calling flow can
 * still save the module's text content and proceed, rather than crash the
 * whole download action over a single unreachable asset.
 */
export async function cacheAssetForOffline(url: string, timeoutMs = 15000): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;

  let controller: ServiceWorker | null;
  try {
    const reg = await navigator.serviceWorker.ready;
    controller = navigator.serviceWorker.controller ?? reg.active;
    if (!controller) return false;
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'CACHE_URL_DONE' && data.url === url) {
        settled = true;
        navigator.serviceWorker.removeEventListener('message', onMessage);
        resolve(!!data.ok);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    controller!.postMessage({ type: 'CACHE_URL', url });

    setTimeout(() => {
      if (!settled) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
        resolve(false);
      }
    }, timeoutMs);
  });
}

export function uncacheOfflineAsset(url: string): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: 'UNCACHE_URL', url });
}
