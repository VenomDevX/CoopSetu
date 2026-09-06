'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * Makes the server's native-app determination available to client components.
 *
 * Seeded from `getIsNative()` in app/layout.tsx rather than detected in the
 * browser, so server and client agree on the very first paint — no hydration
 * mismatch and no flash of the web layout before a client-side check resolves.
 *
 * The value is fixed for the lifetime of the document (a WebView cannot stop
 * being a WebView), so consumers can treat it as a constant.
 */
const NativeContext = createContext(false);

export function NativeProvider({
  isNative,
  children,
}: {
  isNative: boolean;
  children: React.ReactNode;
}) {
  useStaleNativeConfigWarning(isNative);
  return <NativeContext.Provider value={isNative}>{children}</NativeContext.Provider>;
}

/**
 * Development-only guard for the one way native detection fails *silently*.
 *
 * The UA sentinel is applied by `android.appendUserAgent` in
 * capacitor.config.ts, but the WebView reads it from
 * android/app/src/main/assets/capacitor.config.json — a file `npx cap sync`
 * generates and android/.gitignore (line 99) deliberately excludes, so every
 * developer has their own copy. A checkout whose copy predates the sentinel
 * (commit e947650) therefore keeps sending an unmarked UA: `getIsNative()`
 * returns false and the app renders the *web* layout, with no error anywhere.
 * Pulling does not fix it and neither does rebuilding the APK — only
 * `npx cap sync android` regenerates the file.
 *
 * `window.Capacitor` is injected by the native bridge itself, so it is true
 * regardless of the UA. Disagreeing with the server is exactly the stale-config
 * signature, and the only way to catch it from inside the app.
 */
function useStaleNativeConfigWarning(isNative: boolean) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || isNative) return;
    const bridge = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!bridge?.isNativePlatform?.()) return;
    console.warn(
      '[CoopSetu] Running inside the Capacitor app, but the server did not detect it, ' +
        'so you are seeing the WEB layout instead of the mobile app UI. Your ' +
        'android/app/src/main/assets/capacitor.config.json is missing the ' +
        '`appendUserAgent` sentinel. Fix: run `npm run android:sync`, then rebuild.',
    );
  }, [isNative]);
}

/** True when rendering inside the Capacitor Android app. */
export function useIsNative(): boolean {
  return useContext(NativeContext);
}
