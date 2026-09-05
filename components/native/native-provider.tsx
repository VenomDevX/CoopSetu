'use client';

import { createContext, useContext } from 'react';

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
  return <NativeContext.Provider value={isNative}>{children}</NativeContext.Provider>;
}

/** True when rendering inside the Capacitor Android app. */
export function useIsNative(): boolean {
  return useContext(NativeContext);
}
