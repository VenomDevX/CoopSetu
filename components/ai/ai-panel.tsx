'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion } from 'motion/react';
import { X, ArrowUpRight, Terminal, Loader2, CornerDownLeft, Square } from 'lucide-react';
import { AiLogo } from '@/components/ai/ai-logo';
import { Button } from '@/components/ui/button';
import { sourceHref } from '@/lib/ai/source-href';
import { useAiStream, type AiStreamBody } from '@/components/ai/use-ai-stream';
import { TaskPlanApplier } from '@/components/ai/task-plan-applier';

export interface AiSource { source_type: string; source_id?: string; source_title: string; }
export interface AiResponse { answer: string; sources: AiSource[]; }

const SUGGESTIONS = [
  'Summarize the current blockers and who owns them.',
  'What is most at risk right now?',
  'What should be prioritized today?',
];

interface Props {
  /** AI intent to run (see lib/ai/intents.ts). */
  intent: string;
  title?: string;
  /** Free-form ask mode: shows a composer + suggestions and waits for a prompt. */
  askable?: boolean;
  initialPrompt?: string;
  projectId?: string;
  sprintId?: string;
  taskId?: string;
  incidentId?: string;
  releaseId?: string;
  onClose: () => void;
}

/**
 * Slide-over that streams a real, grounded AI answer from `/api/v1/ai/stream`
 * and renders verifiable source citations (deep-linked via `sourceHref`).
 * Auto-runs on open for non-askable intents; ask mode waits for a prompt. Never
 * fabricates — surfaces API errors (incl. the `ai:use`/feature-permission 403).
 */
export function AiPanel(props: Props) {
  const { intent, title, askable, initialPrompt, onClose } = props;
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const { answer, sources, loading, error, done, run, stop } = useAiStream();
  const didAuto = useRef(false);

  const body = useCallback(
    (p?: string): AiStreamBody => ({
      intent,
      prompt: askable ? (p ?? prompt).trim() || undefined : undefined,
      project_id: props.projectId,
      sprint_id: props.sprintId,
      task_id: props.taskId,
      incident_id: props.incidentId,
      release_id: props.releaseId,
    }),
    [intent, askable, prompt, props.projectId, props.sprintId, props.taskId, props.incidentId, props.releaseId],
  );

  // Non-ask intents fire automatically on open.
  useEffect(() => {
    if (!askable && !didAuto.current) {
      didAuto.current = true;
      run(body());
    }
  }, [askable, run, body]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const canSubmit = !!askable && prompt.trim().length > 0 && !loading;
  const hasOutput = answer.length > 0 || error || (done && sources.length > 0);

  if (!mounted) return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] pointer-events-auto"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="fixed top-0 right-0 w-full md:w-[480px] h-full bg-background border-l border-border z-[61] flex flex-col shadow-2xl pointer-events-auto"
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border bg-surface-hover flex-shrink-0">
          <div className="flex items-center gap-1 text-accent font-mono text-xs uppercase tracking-widest font-bold">
            {(() => {
              const displayTitle = title ?? 'HANDOFF AI';
              if (displayTitle.toUpperCase() === 'HANDOFF AI') {
                return (
                  <>
                    <span>HANDOFF</span>
                    <AiLogo className="w-3 h-3" />
                  </>
                );
              }
              return (
                <>
                  <AiLogo className="w-3 h-3" />
                  <span>{displayTitle}</span>
                </>
              );
            })()}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface border border-transparent hover:border-border transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
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

          {done && !error && intent === 'task-plan' && props.taskId && (
            <TaskPlanApplier answer={answer} taskId={props.taskId} />
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
                        className="flex items-center gap-2 text-xs font-mono border border-border rounded px-2 py-1.5 hover:bg-foreground hover:text-background transition-colors"
                      >
                        <span className="text-[9px] uppercase tracking-widest opacity-60">{s.source_type}</span>
                        <span className="truncate">{s.source_title}</span>
                      </Link>
                    ) : (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono border border-border rounded px-2 py-1.5 text-muted-foreground">
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
              <Terminal className="w-3 h-3" /> Logged query · sources above are real workspace records · human approval required for actions.
            </div>
          )}

          {askable && !hasOutput && !loading && (
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Try</div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPrompt(s); run(body(s)); }}
                  className="block w-full text-left text-xs border border-border rounded px-3 py-2 hover:bg-surface-hover transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer (ask mode) / Stop control */}
        {askable ? (
          <div className="p-4 border-t border-border bg-surface flex gap-2 flex-shrink-0">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canSubmit) { e.preventDefault(); run(body()); } }}
              placeholder="Ask about your authorized workspace data…"
              rows={2}
              className="flex-1 px-3 py-2 bg-background border border-border rounded text-xs resize-none focus:outline-none focus:border-foreground"
            />
            {loading ? (
              <Button onClick={stop} className="h-auto px-3 rounded bg-destructive text-background" title="Stop generation">
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={() => run(body())} disabled={!canSubmit} className="h-auto px-3 rounded bg-foreground text-background disabled:opacity-50">
                <CornerDownLeft className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          loading && (
            <div className="p-4 border-t border-border bg-surface flex-shrink-0">
              <Button onClick={stop} className="w-full h-9 rounded bg-destructive text-background gap-2" title="Stop generation">
                <Square className="w-4 h-4" /> Stop Generation
              </Button>
            </div>
          )
        )}
      </motion.div>
    </>,
    document.body
  );
}
