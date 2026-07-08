'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Terminal, Loader2, RefreshCw, Square } from 'lucide-react';
import { AiLogo } from '@/components/ai/ai-logo';
import { usePermission } from '@/lib/permissions/context';
import { sourceHref } from '@/lib/ai/source-href';
import { useAiStream } from '@/components/ai/use-ai-stream';

/**
 * Inline AI Daily Brief for My Work. Streams from the real `/api/v1/ai/stream`
 * (`daily-brief` intent — org-scoped, permission-filtered) and renders verifiable
 * source links. Renders nothing unless the member holds `ai:use`.
 */
export function AiDailyBrief() {
  const { has } = usePermission();
  const allowed = has('ai:use');
  const { answer, sources, loading, error, done, run, stop } = useAiStream();
  const ran = useRef(false);

  useEffect(() => {
    if (allowed && !ran.current) {
      ran.current = true;
      run({ intent: 'daily-brief' });
    }
  }, [allowed, run]);

  if (!allowed) return null;

  return (
    <div className="border border-border bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-bl-full pointer-events-none" />
      <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
        <div className="flex items-center gap-1 text-accent">
          <AiLogo className="w-3 h-3" />
          <h3 className="font-mono text-xs uppercase tracking-widest font-bold">DAILY BRIEF</h3>
        </div>
        {loading ? (
          <button onClick={stop} title="Stop" className="text-destructive hover:opacity-80">
            <Square className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => run({ intent: 'daily-brief' })}
            title="Regenerate"
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 text-sm leading-relaxed">
        {loading && answer.length === 0 && (
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> ANALYZING_WORKSPACE_DATA…
          </div>
        )}
        {error && (
          <div className="text-xs font-mono uppercase tracking-widest text-destructive">{error}</div>
        )}
        {answer && (
          <p className="text-muted-foreground whitespace-pre-wrap font-light">
            {answer}
            {loading && <span className="inline-block w-2 h-4 bg-foreground/50 ml-0.5 animate-pulse align-middle" />}
          </p>
        )}
        {done && !error && sources.length > 0 && (
          <div className="border-t border-border/50 pt-3 space-y-1.5">
            {sources.map((s, i) => {
              const href = sourceHref(s);
              return href ? (
                <Link key={i} href={href} className="flex items-center gap-2 text-[11px] font-mono hover:text-accent">
                  <ArrowUpRight className="w-3 h-3" /> {s.source_title}
                </Link>
              ) : (
                <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                  <ArrowUpRight className="w-3 h-3" /> {s.source_title}
                </div>
              );
            })}
          </div>
        )}
        {done && !error && (
          <div className="text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-2 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Logged query · sources above are real workspace records.
          </div>
        )}
      </div>
    </div>
  );
}
