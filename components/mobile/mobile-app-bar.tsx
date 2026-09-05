'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Search } from 'lucide-react';
import { GlobalAiHub } from '@/components/ai/global-ai-hub';
import { OfflineIndicator } from '@/components/offline/offline-indicator';

/**
 * Compact top bar for the native app.
 *
 * Deliberately thinner than the web shell's h-16 (--app-header-h is 56px in
 * the .app-native scope) and padded into the status bar via --safe-top, so the
 * bar's own background paints behind the system clock instead of leaving a
 * gap. Navigation lives in the bottom tab bar, so this only carries the title,
 * search, and the two status widgets the desktop header also shows.
 */
export function MobileAppBar({
  title,
  canGoBack,
  searchLabel,
  onSearch,
}: {
  title: string;
  canGoBack: boolean;
  searchLabel: string;
  onSearch: () => void;
}) {
  const router = useRouter();

  return (
    <header
      data-native-chrome
      className="shrink-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border
                 pt-[var(--safe-top)]"
    >
      <div className="h-[var(--app-header-h)] flex items-center gap-1 px-2">
        {canGoBack && (
          <button
            type="button"
            onClick={() => router.back()}
            data-testid="native-back"
            data-native-tap
            aria-label="Back"
            className="flex items-center justify-center text-muted-foreground hover:text-foreground -ml-1"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <h1 className={`flex-1 min-w-0 truncate font-bold uppercase tracking-widest text-sm text-foreground ${canGoBack ? '' : 'pl-2'}`}>
          {title}
        </h1>

        <button
          type="button"
          onClick={onSearch}
          data-testid="native-search"
          data-native-tap
          aria-label={searchLabel}
          className="flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Search className="w-5 h-5" />
        </button>

        <OfflineIndicator />
        <GlobalAiHub />
      </div>
    </header>
  );
}
