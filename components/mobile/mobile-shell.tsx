'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { MembershipProvider, type MembershipContextValue } from '@/lib/permissions/context';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { resolveDashboardPersona } from '@/lib/auth/dashboard-persona';
import { buildNavGroups, resolveMobileTabs } from '@/lib/navigation/dashboard-nav';
import { MobileAppBar } from '@/components/mobile/mobile-app-bar';
import { MobileTabBar } from '@/components/mobile/mobile-tab-bar';
import { MobileMoreSheet } from '@/components/mobile/mobile-more-sheet';

interface MobileShellProps {
  children: React.ReactNode;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  membership: MembershipContextValue;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN'];

/**
 * The dashboard shell used inside the Capacitor Android app.
 *
 * Rendered instead of DashboardShell by app/dashboard/layout.tsx when the
 * request carries the native UA sentinel; the web shell is left completely
 * untouched, which is what keeps the browser experience byte-identical.
 *
 * Structurally different rather than a narrower sidebar: bottom tab bar for
 * primary navigation, a compact app bar, and sheets in place of dropdowns.
 * Both shells take the same props and read the same persona-filtered nav
 * (lib/navigation/dashboard-nav.ts), so they cannot drift apart.
 *
 * NotificationBell is deliberately not rendered here: it is a draggable
 * floating widget whose corner-snapping math assumes a desktop viewport, and
 * it would collide with the tab bar. Inbox is a nav destination already.
 */
export function MobileDashboardShell({
  children,
  displayName,
  initials,
  avatarUrl,
  membership,
}: MobileShellProps) {
  const pathname = usePathname();
  const tNav = useTranslations('Nav');
  const tShell = useTranslations('Shell');
  const persona = resolveDashboardPersona(membership.roles);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const navGroups = buildNavGroups(tNav, persona);
  const tabs = resolveMobileTabs(navGroups, persona);
  const paletteNavItems = navGroups.flatMap((g) =>
    g.items.map((it) => ({ name: it.name, href: it.href, icon: it.icon })),
  );

  // Close the sheet on navigation. Compared during render rather than in an
  // effect, matching the pattern the web shell uses for its drawer.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMoreOpen(false);
  }

  // Real for a Bluetooth keyboard, and keeps parity with the web shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [demoAlertVisible, setDemoAlertVisible] = useState(false);
  useEffect(() => {
    const onDemoAlert = () => {
      setDemoAlertVisible(true);
      setTimeout(() => setDemoAlertVisible(false), 4000);
    };
    window.addEventListener('demo-alert', onDemoAlert);
    return () => window.removeEventListener('demo-alert', onDemoAlert);
  }, []);

  // Title the current destination from the nav itself, so it stays translated
  // and in step with the sidebar's labels. Longest-prefix match so detail
  // routes inherit their section's name.
  const allItems = navGroups.flatMap((g) => g.items);
  const current = allItems
    .filter((it) => (it.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(it.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const title = current?.name ?? tShell('dashboard');

  // A tab root is its own top level; anything deeper gets a back affordance.
  const canGoBack = !tabs.some((t) => t.href === pathname) && pathname !== '/dashboard';

  return (
    <MembershipProvider value={membership}>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={paletteNavItems}
        canViewTasks={
          ADMIN_ROLES.some((r) => membership.roles.includes(r)) ||
          membership.permissions.includes('task:view')
        }
      />

      <div className="flex flex-col h-[100dvh] overflow-hidden bg-background text-foreground font-sans">
        <MobileAppBar
          title={title}
          canGoBack={canGoBack}
          searchLabel={tShell('searchPlaceholder')}
          onSearch={() => setPaletteOpen(true)}
        />

        <main className="flex-1 overflow-y-auto overscroll-contain bg-background">
          {/* No decorative grid background and no responsive padding ramp —
              both are desktop texture that just costs width on a phone. */}
          <div className="w-full p-4">{children}</div>
        </main>

        <MobileTabBar
          tabs={tabs}
          pathname={pathname}
          moreLabel={tNav('more')}
          onMore={() => setMoreOpen(true)}
          moreActive={moreOpen}
        />

        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          navGroups={navGroups}
          pathname={pathname}
          isDemo={Boolean(membership.isDemo)}
          displayName={displayName}
          initials={initials}
          avatarUrl={avatarUrl}
          labels={{
            title: tShell('menu'),
            close: tShell('closeMenu'),
            profile: tShell('profile'),
            signOut: tShell('signOut'),
          }}
        />

        <AnimatePresence>
          {demoAlertVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              // Clears the tab bar rather than sitting under it.
              className="fixed left-4 right-4 z-[100] flex items-start gap-3 bg-surface-elevated border border-border
                         border-l-4 border-l-red-500 shadow-2xl px-4 py-3 rounded-lg
                         bottom-[calc(var(--app-tabbar-h)+var(--safe-bottom)+12px)]"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest font-mono text-foreground">
                  {tShell('demoLimitationTitle')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{tShell('demoLimitationBody')}</p>
              </div>
              <button
                onClick={() => setDemoAlertVisible(false)}
                aria-label={tShell('closeMenu')}
                className="p-1 text-muted-foreground shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MembershipProvider>
  );
}
