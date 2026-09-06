import Link from 'next/link';
import { WifiOff, BookOpen, ClipboardCheck } from 'lucide-react';

export const metadata = { title: 'Offline — CoopSetu' };

/**
 * Served by the service worker when a navigation fails.
 *
 * A static page on purpose: it must be cacheable and identical for everyone.
 * Caching a real dashboard document instead would risk showing one trainee
 * another's page, since those responses are per-user and Cache-Control:
 * no-store.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-background text-foreground">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-border mb-6">
          <WifiOff className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tighter uppercase mb-3">You are offline</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          CoopSetu needs a connection for live data. Anything you downloaded is still
          available, and work you do offline is queued and sent when you reconnect.
        </p>

        <div className="text-left space-y-3 mb-8">
          <div className="flex items-start gap-3 border border-border rounded p-3">
            <BookOpen className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground">Downloaded course modules</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                Available now
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border border-border rounded p-3">
            <ClipboardCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground">Assessments, progress and attendance</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                Queued, sent on reconnect
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-6 py-3 rounded border border-border font-mono text-xs uppercase tracking-widest hover:border-foreground transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
