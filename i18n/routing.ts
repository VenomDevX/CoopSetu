/**
 * Locale configuration for Phase 9 (i18n infrastructure). Deliberately NOT
 * next-intl's routing middleware (`defineRouting` + locale-prefixed URLs,
 * e.g. /hi/dashboard) — this app has ~150 existing routes and hundreds of
 * plain `next/link`/`next/navigation` references (dashboard pages, e2e
 * tests, the RLS-aware root middleware) that assume unprefixed paths.
 * Routing-based i18n would require migrating every one of those to
 * next-intl's locale-aware Link/useRouter to avoid dropping the active
 * locale on navigation — a huge, invasive change for "introduce i18n
 * infra, zero behavior change".
 *
 * Instead: locale is resolved from a plain cookie (see i18n/request.ts),
 * with no routing-layer involvement at all — middleware.ts (already flagged
 * as this plan's highest-regression-risk file, handling auth, CSP nonces,
 * rate limiting and bot protection) is untouched by this phase.
 */

export const locales = ['en', 'hi'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeCookieName = 'NEXT_LOCALE';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
