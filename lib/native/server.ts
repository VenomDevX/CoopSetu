import { headers } from 'next/headers';
import { NATIVE_HEADER, isNativeUserAgent } from './is-native';

/**
 * Server-side "is this request from the Capacitor Android app?".
 *
 * Header first (middleware.ts normalizes the UA sentinel into it), falling
 * back to parsing the user-agent directly — the middleware matcher excludes
 * `_next/static` and image routes, so the header is not guaranteed on every
 * render path.
 *
 * Kept in its own module so ./is-native.ts stays import-free and therefore
 * loadable by the Capacitor CLI and by unit tests without a Next request
 * context.
 */
export async function getIsNative(): Promise<boolean> {
  const h = await headers();
  if (h.get(NATIVE_HEADER) === '1') return true;
  return isNativeUserAgent(h.get('user-agent'));
}
