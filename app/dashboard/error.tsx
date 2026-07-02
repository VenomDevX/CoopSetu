'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
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
    <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500 text-muted-foreground gap-4">
      <AlertTriangle className="w-6 h-6 text-destructive" />
      <div className="text-xs font-mono uppercase tracking-widest">Something went wrong</div>
      <p className="text-sm max-w-md text-center">
        This section failed to load. Try again, or reload the page if the problem persists.
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
