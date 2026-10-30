import { cookies } from 'next/headers';
import { defaultLocale, isSupportedLocale, localeCookieName } from '@/i18n/routing';

/**
 * The locale to serve *content* in, as opposed to UI chrome.
 *
 * Reads the same NEXT_LOCALE cookie the interface uses (i18n/request.ts), so a
 * trainee who switches the app to Hindi gets Hindi lessons too rather than a
 * Hindi shell wrapped around English material.
 */
export async function getContentLocale(): Promise<string> {
  try {
    const store = await cookies();
    const value = store.get(localeCookieName)?.value;
    return isSupportedLocale(value) ? value : defaultLocale;
  } catch {
    // A content locale is a display preference, not an access control, so a
    // context without a request cookie store (a route invoked directly in a
    // test, a background job) falls back to the source language rather than
    // failing the whole request.
    return defaultLocale;
  }
}

/**
 * Folds a translation row over its base row.
 *
 * Field-by-field rather than a whole-row swap, and every field falls back
 * independently: a translation with a title but no body still gets a Hindi
 * title and the English text, instead of the module vanishing or the partial
 * translation being discarded. `content_url` falls back to the base asset,
 * because a dubbed file is optional.
 */
export function applyTranslation<T extends Record<string, unknown>>(
  base: T,
  translation: Record<string, unknown> | null | undefined,
  fields: readonly string[],
): T & { translated_locale?: string } {
  if (!translation) return base;

  const merged: Record<string, unknown> = { ...base };
  for (const field of fields) {
    const value = translation[field];
    // null and '' both mean "not translated"; 0 and false are legitimate
    // values elsewhere, so this checks emptiness rather than falsiness.
    if (value !== null && value !== undefined && value !== '') {
      merged[field] = value;
    }
  }
  merged.translated_locale = translation.locale;
  return merged as T & { translated_locale?: string };
}

/** Indexes translation rows by the id of the row they translate. */
export function indexTranslations<T extends Record<string, any>>(
  rows: T[] | null | undefined,
  foreignKey: string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows || []) {
    const key = row[foreignKey];
    if (typeof key === 'string') map.set(key, row);
  }
  return map;
}
