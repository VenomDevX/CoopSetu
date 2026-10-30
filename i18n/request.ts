import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isSupportedLocale, localeCookieName } from './routing';

/**
 * Resolves the request's locale from the NEXT_LOCALE cookie (set by
 * components/layout/language-switcher.tsx), falling back to the default
 * (English) when absent or unrecognized. No routing/middleware
 * involvement — see i18n/routing.ts for why.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
