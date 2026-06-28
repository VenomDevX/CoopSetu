'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Square, CornerDownLeft, ArrowUpRight, Terminal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { sourceHref } from '@/lib/ai/source-href';
import { useAiStream, type AiStreamBody } from '@/components/ai/use-ai-stream';
import type { AiSource } from '@/components/ai/ai-panel';

const SUGGESTIONS = [
  'Summarize the current blockers and who owns them.',
  'What is most at risk right now?',
  'What should be prioritized today?',
];

export function HubChatTab({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const { answer, sources, loading, error, done, run, stop } = useAiStream();

  const body = useCallback(
    (p?: string): AiStreamBody => ({
      intent: 'ask',
      prompt: (p ?? prompt).trim() || undefined,
    }),
    [prompt],
  );

  const canSubmit = prompt.trim().length > 0 && !loading;
  const hasOutput = answer.length > 0 || error || (done && sources.length > 0);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading && answer.length === 0 && (
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> ANALYZING_WORKSPACE_DATA…
          </div>
        )}

        {error && (
          <div className="text-xs font-mono uppercase tracking-widest text-destructive border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error}
          </div>
        )}

        {answer && (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {answer}
            {loading && <span className="inline-block w-2 h-4 bg-foreground/60 ml-0.5 animate-pulse align-middle" />}
          </div>
        )}

        {done && !error && (
          <div className="border-t border-border pt-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-3 h-3" /> Verified Sources ({sources.length})
            </h3>
            {sources.length === 0 ? (
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                No source records for this response.
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((s, i) => {
                  const href = sourceHref(s);
                  return href ? (
                    <Link
                      key={i}
                      href={href}
                      onClick={onClose}
                      className="flex items-center gap-2 text-xs font-mono border border-border px-2 py-1.5 hover:bg-foreground hover:text-background transition-colors"
                    >
                      <span className="text-[9px] uppercase tracking-widest opacity-60">{s.source_type}</span>
                      <span className="truncate">{s.source_title}</span>
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono border border-border px-2 py-1.5 text-muted-foreground">
                      <span className="text-[9px] uppercase tracking-widest opacity-60">{s.source_type}</span>
                      <span className="truncate">{s.source_title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {done && !error && (
          <div className="text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-3 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Logged query · sources above are real workspace records.
          </div>
        )}

        {!hasOutput && !loading && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Try</div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setPrompt(s); run(body(s)); }}
                className="block w-full text-left text-xs border border-border px-3 py-2 hover:bg-surface-hover transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-surface flex gap-2 flex-shrink-0">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canSubmit) { e.preventDefault(); run(body()); } }}
          placeholder="Ask about your authorized workspace data…"
          rows={2}
          className="flex-1 px-3 py-2 bg-background border border-border text-xs resize-none focus:outline-none focus:border-foreground"
        />
        {loading ? (
          <Button onClick={stop} className="h-auto px-3 rounded-none bg-destructive text-background" title="Stop generation">
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={() => run(body())} disabled={!canSubmit} className="h-auto px-3 rounded-none bg-foreground text-background disabled:opacity-50">
            <CornerDownLeft className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function HubBriefTab({ onClose }: { onClose: () => void }) {
  const { answer, sources, loading, error, done, run, stop } = useAiStream();
  const didAuto = useRef(false);

  useEffect(() => {
    if (!didAuto.current) {
      didAuto.current = true;
      run({ intent: 'daily-brief' });
    }
  }, [run]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading && answer.length === 0 && (
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> GENERATING_DAILY_BRIEF…
          </div>
        )}

        {error && (
          <div className="text-xs font-mono uppercase tracking-widest text-destructive border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error}
          </div>
        )}

        {answer && (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {answer}
            {loading && <span className="inline-block w-2 h-4 bg-foreground/60 ml-0.5 animate-pulse align-middle" />}
          </div>
        )}

        {done && !error && (
          <div className="border-t border-border pt-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-3 h-3" /> Verified Sources ({sources.length})
            </h3>
            {sources.length === 0 ? (
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                No source records for this response.
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((s, i) => {
                  const href = sourceHref(s);
                  return href ? (
                    <Link
                      key={i}
                      href={href}
                      onClick={onClose}
                      className="flex items-center gap-2 text-xs font-mono border border-border px-2 py-1.5 hover:bg-foreground hover:text-background transition-colors"
                    >
                      <span className="text-[9px] uppercase tracking-widest opacity-60">{s.source_type}</span>
                      <span className="truncate">{s.source_title}</span>
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono border border-border px-2 py-1.5 text-muted-foreground">
                      <span className="text-[9px] uppercase tracking-widest opacity-60">{s.source_type}</span>
                      <span className="truncate">{s.source_title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {done && !error && (
          <div className="text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-3 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Logged query · sources above are real workspace records.
          </div>
        )}
      </div>

      {loading && (
        <div className="p-4 border-t border-border bg-surface flex-shrink-0">
          <Button onClick={stop} className="w-full h-9 rounded-none bg-destructive text-background gap-2" title="Stop generation">
            <Square className="w-4 h-4" /> Stop Generation
          </Button>
        </div>
      )}
      {!loading && done && (
        <div className="p-4 border-t border-border bg-surface flex-shrink-0">
          <Button onClick={() => run({ intent: 'daily-brief' })} variant="outline" className="w-full h-9 rounded-none gap-2 font-mono text-xs uppercase tracking-widest">
            Regenerate Brief
          </Button>
        </div>
      )}
    </div>
  );
}
