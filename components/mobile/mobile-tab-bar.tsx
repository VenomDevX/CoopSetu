'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import type { NavItem } from '@/lib/navigation/dashboard-nav';

/**
 * Fixed bottom navigation — the native app's primary wayfinding, replacing the
 * desktop sidebar and the hamburger drawer.
 *
 * `tabs` comes from resolveMobileTabs(), which resolves them against the
 * persona-filtered nav, so nothing here can point at a route the user can't
 * reach. Everything that didn't fit lives behind the trailing More button.
 */
export function MobileTabBar({
  tabs,
  pathname,
  moreLabel,
  onMore,
  moreActive,
}: {
  tabs: NavItem[];
  pathname: string;
  moreLabel: string;
  onMore: () => void;
  moreActive: boolean;
}) {
  // /dashboard would otherwise prefix-match every child route, lighting up the
  // overview tab everywhere.
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const cellClass =
    'flex-1 flex flex-col items-center justify-center gap-1 px-1 transition-colors';
  const labelClass = 'text-[10px] font-medium leading-none truncate max-w-full';

  return (
    <nav
      data-testid="native-tab-bar"
      data-native-chrome
      aria-label={moreLabel}
      className="shrink-0 border-t border-border bg-background/95 backdrop-blur-xl
                 flex items-stretch
                 h-[calc(var(--app-tabbar-h)+var(--safe-bottom))] pb-[var(--safe-bottom)]"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
            data-testid={`native-tab-${tab.href.split('/').pop() || 'overview'}`}
            data-native-tap
            aria-current={active ? 'page' : undefined}
            className={`${cellClass} ${active ? 'text-accent' : 'text-muted-foreground'}`}
          >
            <tab.icon className="w-5 h-5 shrink-0" />
            <span className={labelClass}>{tab.name}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onMore}
        data-testid="native-more-trigger"
        data-native-tap
        aria-haspopup="dialog"
        aria-expanded={moreActive}
        className={`${cellClass} ${moreActive ? 'text-accent' : 'text-muted-foreground'}`}
      >
        <MoreHorizontal className="w-5 h-5 shrink-0" />
        <span className={labelClass}>{moreLabel}</span>
      </button>
    </nav>
  );
}
