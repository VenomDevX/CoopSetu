'use client';

import Link from 'next/link';
import { LogOut, User as UserIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { OrgSwitcher } from '@/components/dashboard/org-switcher';
import { MobileSheet } from '@/components/mobile/mobile-sheet';
import type { NavGroup } from '@/lib/navigation/dashboard-nav';

/**
 * Everything the bottom tab bar couldn't fit: the full persona-filtered nav,
 * plus the controls the desktop shell keeps in its sidebar footer and profile
 * dropdown.
 *
 * Note ThemeToggle is reachable on a phone for the first time here — the web
 * header hides it behind `hidden sm:block`, so phone users have never had it.
 */
export function MobileMoreSheet({
  open,
  onClose,
  navGroups,
  pathname,
  isDemo,
  displayName,
  initials,
  avatarUrl,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  pathname: string;
  isDemo: boolean;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  labels: { title: string; close: string; profile: string; signOut: string };
}) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={labels.title}
      closeLabel={labels.close}
      testId="native-more-sheet"
      closeTestId="native-more-close"
    >
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials.charAt(0)
          )}
        </span>
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{displayName}</span>
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      {navGroups.map((group) => (
        <div key={group.title} className="mb-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 px-1">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
              const className = `w-full flex items-center gap-3 px-2 rounded-md text-sm transition-colors ${
                active ? 'bg-surface-hover text-foreground' : 'text-muted-foreground'
              }`;

              // Same demo-mode interception the desktop sidebar applies, so
              // Settings behaves identically in both shells.
              if (item.name === 'Settings' && isDemo) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    data-native-tap
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('demo-alert'));
                      onClose();
                    }}
                    className={`${className} text-left`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={onClose}
                  data-native-tap
                  className={className}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-border space-y-3">
        <OrgSwitcher />

        <Link
          href="/dashboard/settings"
          prefetch={false}
          onClick={onClose}
          data-native-tap
          className="w-full flex items-center gap-3 px-2 rounded-md text-sm text-muted-foreground"
        >
          <UserIcon className="w-4 h-4 shrink-0" />
          <span>{labels.profile}</span>
        </Link>

        {/* Same POST form the desktop dropdown uses — sign-out must go through
            the route handler, not a client-side call. */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            data-native-tap
            className="w-full flex items-center gap-3 px-2 rounded-md text-sm text-red-500"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{labels.signOut}</span>
          </button>
        </form>
      </div>
    </MobileSheet>
  );
}
