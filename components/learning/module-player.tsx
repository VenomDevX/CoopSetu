'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Volume2, Video as VideoIcon, ExternalLink, CheckCircle2 } from 'lucide-react';

/**
 * Renders one course module and reports how much of it the trainee got through.
 *
 * Before this existed there was no player of any kind — no <video>, <iframe> or
 * <audio> anywhere in the app — so a trainee could see that a module existed,
 * and download it, but never actually consume it in the product.
 *
 * Progress is measured per type rather than pretending one signal fits all:
 *
 *   VIDEO / AUDIO   furthest point reached, as a share of duration
 *   PDF / DOCUMENT  opened counts as started; a manual "mark as read" completes
 *   TEXT            scroll depth through the body
 *
 * `onProgress` is called with a monotonically increasing percentage. The parent
 * throttles the network write; this component only measures.
 */

export interface CourseModule {
  id: string;
  title: string;
  type: string;
  content_url?: string | null;
  content_text?: string | null;
  duration_minutes?: number | null;
}

export function ModulePlayer({
  module,
  initialPct,
  onProgress,
}: {
  module: CourseModule;
  initialPct: number;
  onProgress: (pct: number) => void;
}) {
  // Progress must never go backwards: a trainee who rewinds a video has still
  // watched the furthest point, and the server would otherwise record the
  // lower number on the next tick.
  const highWater = useRef(initialPct);
  const report = useCallback(
    (pct: number) => {
      const next = Math.min(100, Math.round(pct));
      if (next <= highWater.current) return;
      highWater.current = next;
      onProgress(next);
    },
    [onProgress],
  );

  useEffect(() => { highWater.current = initialPct; }, [module.id, initialPct]);

  const type = (module.type || '').toUpperCase();

  if (type === 'VIDEO' || type === 'AUDIO') {
    return <MediaModule module={module} isAudio={type === 'AUDIO'} initialPct={initialPct} report={report} />;
  }
  if (type === 'PDF' || type === 'DOCUMENT' || type === 'SCORM_LINK') {
    return <EmbeddedDocModule module={module} report={report} />;
  }
  return <TextModule module={module} report={report} />;
}

/* -------------------------------------------------------------- video/audio */

function MediaModule({
  module, isAudio, initialPct, report,
}: { module: CourseModule; isAudio: boolean; initialPct: number; report: (n: number) => void }) {
  const ref = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [resumed, setResumed] = useState(false);

  const onLoaded = () => {
    const el = ref.current;
    if (!el || resumed) return;
    // Resume where they left off. Below 5% it is noise; at or above 98% the
    // module is effectively finished and restarting reads better than dropping
    // them on the closing frame.
    if (initialPct > 5 && initialPct < 98 && el.duration) {
      el.currentTime = (initialPct / 100) * el.duration;
    }
    setResumed(true);
  };

  const onTime = () => {
    const el = ref.current;
    if (!el?.duration) return;
    const pct = (el.currentTime / el.duration) * 100;
    // 90% counts as watched. Credits, outros and the habit of clicking away
    // near the end mean almost nobody reaches a literal 100%.
    report(pct >= 90 ? 100 : pct);
  };

  if (!module.content_url) {
    return <MissingContent label={isAudio ? 'No audio attached to this module.' : 'No video attached to this module.'} />;
  }

  const common = {
    ref: ref as never,
    controls: true,
    preload: 'metadata' as const,
    onLoadedMetadata: onLoaded,
    onTimeUpdate: onTime,
    onEnded: () => report(100),
    className: 'w-full rounded border border-border bg-black',
  };

  return (
    <div className="space-y-3">
      {isAudio ? (
        <div className="border border-border rounded p-6 bg-surface flex items-center gap-4">
          <Volume2 className="w-8 h-8 text-accent shrink-0" />
            <audio {...common} className="w-full" src={module.content_url} />
        </div>
      ) : (
        <video {...common} src={module.content_url} playsInline />
      )}
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {isAudio ? <Volume2 className="w-3 h-3 inline mr-1" /> : <VideoIcon className="w-3 h-3 inline mr-1" />}
        Progress records automatically · 90% watched counts as complete
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ pdf / document */

function EmbeddedDocModule({ module, report }: { module: CourseModule; report: (n: number) => void }) {
  // Opening a document is a real signal but a weak one — it cannot tell whether
  // anything was read. Recorded as started, with completion left to the
  // trainee, rather than inflating it into a completion the data can't support.
  useEffect(() => { report(10); }, [report]);

  if (!module.content_url) return <MissingContent label="No document attached to this module." />;

  return (
    <div className="space-y-3">
      <iframe
        src={module.content_url}
        title={module.title}
        className="w-full h-[65vh] rounded border border-border bg-surface"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => report(100)}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded font-mono text-[10px] uppercase tracking-widest hover:border-foreground transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as read
        </button>
        <a
          href={module.content_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
        </a>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- text */

function TextModule({ module, report }: { module: CourseModule; report: (n: number) => void }) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const onScroll = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    // Short lessons that never scroll would otherwise sit at 0% forever.
    if (scrollable <= 8) { report(100); return; }
    const pct = (el.scrollTop / scrollable) * 100;
    // 92% rather than 100%: the last line of a lesson sits above the fold on
    // most screens, so a reader who has finished never scrolls to the exact end.
    report(pct >= 92 ? 100 : pct);
  }, [report]);

  // Runs on mount so a lesson too short to scroll still completes.
  useEffect(() => { onScroll(); }, [module.id, onScroll]);

  if (!module.content_text) return <MissingContent label="No content has been written for this module yet." />;

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        onScroll={onScroll}
        className="h-[65vh] overflow-y-auto border border-border rounded p-6 bg-surface leading-relaxed whitespace-pre-wrap text-sm text-foreground"
      >
        {module.content_text}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <FileText className="w-3 h-3 inline mr-1" /> Progress follows your reading position
      </p>
    </div>
  );
}

function MissingContent({ label }: { label: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-border rounded bg-surface/40">
      <FileText className="w-8 h-8 text-muted-foreground mb-3" />
      <p className="text-xs font-mono text-muted-foreground">{label}</p>
    </div>
  );
}
