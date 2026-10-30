import { describe, it, expect } from 'vitest';
import { NATIVE_UA_SENTINEL, NATIVE_HEADER, isNativeUserAgent } from '@/lib/native/is-native';

// A realistic Android WebView UA with Capacitor's appendUserAgent applied,
// and the same device UA without it.
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const NATIVE_UA = `${ANDROID_WEBVIEW} ${NATIVE_UA_SENTINEL}1`;

describe('native app detection', () => {
  it('recognises the Capacitor WebView UA', () => {
    expect(isNativeUserAgent(NATIVE_UA)).toBe(true);
  });

  it('rejects ordinary browsers, including the same device without the sentinel', () => {
    expect(isNativeUserAgent(ANDROID_WEBVIEW)).toBe(false);
    expect(isNativeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
    expect(isNativeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1')).toBe(false);
    expect(isNativeUserAgent('Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/121.0')).toBe(false);
  });

  it('handles missing/empty user-agents without throwing', () => {
    expect(isNativeUserAgent(null)).toBe(false);
    expect(isNativeUserAgent(undefined)).toBe(false);
    expect(isNativeUserAgent('')).toBe(false);
  });

  it('does not mistake the tools middleware already blocks for the native app', () => {
    // middleware.ts 403s these on /api/v1/* — they must never look native.
    expect(isNativeUserAgent('curl/8.4.0')).toBe(false);
    expect(isNativeUserAgent('python-requests/2.31.0')).toBe(false);
  });

  it('matches the sentinel anywhere in the string, and across version bumps', () => {
    // appendUserAgent puts it at the end today, but nothing guarantees that
    // forever, and the trailing version is expected to change.
    expect(isNativeUserAgent(`${NATIVE_UA_SENTINEL}1 ${ANDROID_WEBVIEW}`)).toBe(true);
    expect(isNativeUserAgent(`${ANDROID_WEBVIEW} ${NATIVE_UA_SENTINEL}2`)).toBe(true);
    expect(isNativeUserAgent(`${ANDROID_WEBVIEW} ${NATIVE_UA_SENTINEL}1.4.2`)).toBe(true);
  });

  it('is case-sensitive, so a lookalike UA cannot pose as the app', () => {
    expect(isNativeUserAgent(`${ANDROID_WEBVIEW} coopsetuapp/1`)).toBe(false);
  });

  it('exposes a sentinel that keeps the UA looking like a browser', () => {
    // Regression guard for the middleware bot check: the sentinel itself must
    // not introduce a substring that middleware.ts rejects, and appending it
    // must leave the Chrome markers intact.
    const lower = NATIVE_UA.toLowerCase();
    expect(lower).not.toContain('curl');
    expect(lower).not.toContain('python-requests');
    expect(NATIVE_UA).toContain('Mozilla/5.0');
    expect(NATIVE_UA).toContain('Chrome/');
  });

  it('names the normalized header explicitly (spoofing guard depends on it)', () => {
    // middleware.ts deletes this header off the incoming request before
    // conditionally setting it, so a client-supplied value can never win.
    // Pinned here because the delete and the read must agree on the name.
    expect(NATIVE_HEADER).toBe('x-coopsetu-native');
  });
});
