/**
 * Detection for "am I being rendered inside the Capacitor Android app?".
 *
 * The signal is a sentinel appended to the WebView's user-agent by
 * `capacitor.config.ts`'s `android.appendUserAgent`. A UA sentinel is used
 * rather than `@capacitor/core`'s `Capacitor.isNativePlatform()` because that
 * is client-only: `app/dashboard/layout.tsx` and `app/layout.tsx` are server
 * components, so a client-only signal could not branch there at all, and
 * anywhere it could would flash the web layout before swapping.
 *
 * This module deliberately has ZERO imports. It is loaded by three very
 * different runtimes — the Next server, the browser bundle, and the Capacitor
 * CLI (plain Node, when it evaluates capacitor.config.ts) — so anything
 * Next-specific lives in ./server.ts instead.
 */

/**
 * Appended to the stock Android WebView UA. Kept deliberately boring: the UA
 * must still read as Chrome so `middleware.ts`'s bot check (which 403s empty
 * or `curl`/`python-requests` user-agents on /api/v1/*) keeps passing it.
 */
export const NATIVE_UA_SENTINEL = 'CoopSetuApp/';

/**
 * Request header the middleware normalizes the UA sentinel into, so server
 * components don't each re-parse the user-agent. Always stripped from the
 * incoming request before being set — see middleware.ts.
 */
export const NATIVE_HEADER = 'x-coopsetu-native';

/** True when `ua` carries the native-app sentinel. */
export function isNativeUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return ua.includes(NATIVE_UA_SENTINEL);
}
