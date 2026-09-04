import { describe, it, expect } from 'vitest';
import { locales, defaultLocale, isSupportedLocale, localeCookieName, localeLabels } from '@/i18n/routing';
import en from '@/messages/en.json';
import hi from '@/messages/hi.json';

describe('i18n/routing — locale config', () => {
  it('declares English as the default locale', () => {
    expect(defaultLocale).toBe('en');
    expect(locales).toContain(defaultLocale);
  });

  it('isSupportedLocale() accepts only configured locales', () => {
    for (const code of locales) expect(isSupportedLocale(code)).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });

  it('every locale has a display label for the language switcher', () => {
    for (const code of locales) expect(localeLabels[code]).toBeTruthy();
  });

  it('uses a real, specific cookie name (not a generic one that could collide)', () => {
    expect(localeCookieName).toBe('NEXT_LOCALE');
  });
});

/**
 * i18n/request.ts (getRequestConfig) has no per-key fallback — a key
 * present in en.json but missing from hi.json renders as a missing-key
 * warning, not silently falling back to English. This guards the exact
 * failure mode messages/README.md warns about.
 */
describe('message dictionaries — key parity', () => {
  function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === 'object' && !Array.isArray(value)
        ? flattenKeys(value as Record<string, unknown>, path)
        : [path];
    });
  }

  it('en.json and hi.json declare exactly the same keys', () => {
    const enKeys = flattenKeys(en).sort();
    const hiKeys = flattenKeys(hi).sort();
    expect(hiKeys).toEqual(enKeys);
  });

  it('every message value is a non-empty string (no accidental null/blank entries)', () => {
    for (const [dict, name] of [[en, 'en'], [hi, 'hi']] as const) {
      for (const key of flattenKeys(dict)) {
        const value = key.split('.').reduce((o: any, k) => o[k], dict);
        expect(typeof value, `${name}.${key}`).toBe('string');
        expect((value as string).length, `${name}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
