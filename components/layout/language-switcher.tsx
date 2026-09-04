'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { locales, localeLabels, localeCookieName, type Locale } from '@/i18n/routing';

/**
 * Sets the NEXT_LOCALE cookie read by i18n/request.ts and refreshes the
 * current route so Server Components re-render with the new locale's
 * messages. No URL change (see i18n/routing.ts for why this app doesn't use
 * next-intl's locale-prefixed routing) — same page, same path, new language.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('Language');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const setLocale = (next: Locale) => {
    if (next === locale) { setOpen(false); return; }
    // Same pattern already established for intent cookies elsewhere in this
    // app (e.g. app/onboarding/invites/client.tsx's handleCreateWorkspace) —
    // a plain document.cookie write from a click handler, not a React state
    // mutation the compiler needs to reason about.
    // eslint-disable-next-line react-hooks/immutability -- document.cookie write in a click handler, not a captured variable mutation
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setOpen(false);
    startTransition(() => router.refresh());
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-label={t('label')}
        title={t('label')}
        className="flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors border border-transparent hover:border-border disabled:opacity-50"
      >
        <Languages className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-36 bg-background border border-border rounded shadow-2xl z-50 overflow-hidden">
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`w-full text-left px-3 py-2 text-xs font-mono uppercase tracking-widest hover:bg-surface-hover transition-colors ${code === locale ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
            >
              {localeLabels[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
