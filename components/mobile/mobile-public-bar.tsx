'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

/**
 * Public-page top bar for the Capacitor app, replacing MarketingHeader's
 * desktop chrome.
 *
 * Three things the web header does are wrong inside an app:
 *  - it is `fixed` and transparent until scrolled, so with viewportFit:'cover'
 *    it renders underneath the system status bar;
 *  - it carries a six-link marketing nav and Sign In / Request Demo CTAs,
 *    which are a website's job, not an installed app's;
 *  - it mounts MobileNavDrawer, a second navigation surface competing with the
 *    dashboard's bottom tab bar.
 *
 * These pages are still reachable in the app — legal pages in particular have
 * to be — so this gives them a plain, solid, safe-area-aware bar with a way
 * back and nothing else.
 */
const TITLES: Record<string, string> = {
  '/ai': 'AI',
  '/about': 'About',
  '/contact': 'Contact',
  '/cookies': 'Cookies',
  '/demo': 'Demo',
  '/enterprise': 'Enterprise',
  '/pricing': 'Pricing',
  '/privacy': 'Privacy',
  '/product': 'Product',
  '/security': 'Security',
  '/solutions': 'Solutions',
  '/terms': 'Terms',
};

export function MobilePublicBar() {
  const pathname = usePathname();
  const router = useRouter();

  const title =
    TITLES[pathname] ??
    (pathname === '/'
      ? 'CoopSetu'
      : // Fall back to the last path segment rather than showing nothing on a
        // route this map hasn't been told about.
        (pathname.split('/').filter(Boolean).pop() ?? 'CoopSetu').replace(/-/g, ' '));

  return (
    <header
      data-native-chrome
      data-testid="native-public-bar"
      className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-xl border-b border-border
                 pt-[var(--safe-top)]"
    >
      <div className="h-[var(--app-header-h)] flex items-center gap-1 px-2">
        {pathname === '/' ? (
          <Link href="/" className="pl-2 font-bold uppercase tracking-widest text-sm text-foreground">
            CoopSetu
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.back()}
              data-testid="native-public-back"
              data-native-tap
              aria-label="Back"
              className="flex items-center justify-center text-muted-foreground hover:text-foreground -ml-1"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="flex-1 min-w-0 truncate font-bold uppercase tracking-widest text-sm text-foreground">
              {title}
            </h1>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
