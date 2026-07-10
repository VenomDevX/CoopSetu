'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

/**
 * Root-level error boundary for everything outside /dashboard (marketing
 * pages, auth flows, legal pages). Keeps the app shell/theme intact instead
 * of falling through to global-error.tsx's bare full-document fallback,
 * which only fires if the root layout itself throws.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
      <AlertTriangle className="w-6 h-6 text-red-500" />
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Something went wrong</div>
      <p className="text-sm max-w-md text-muted-foreground">
        This page failed to load. Try again, or return to the homepage if the problem persists.
      </p>
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={reset}
          className="h-9 px-4 border border-border rounded text-xs font-mono uppercase tracking-widest hover:bg-surface-hover transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="h-9 px-4 flex items-center border border-border rounded text-xs font-mono uppercase tracking-widest hover:bg-surface-hover transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
