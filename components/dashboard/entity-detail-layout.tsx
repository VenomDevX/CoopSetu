import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Clock, Lock, FileQuestion, Activity } from 'lucide-react';

export type BadgeTone = 'red' | 'orange' | 'green' | 'gray' | 'blue';

const TONE: Record<BadgeTone, string> = {
  red: 'border-destructive text-destructive bg-destructive/10',
  orange: 'border-orange-500 text-orange-500 bg-orange-500/10',
  green: 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
  blue: 'border-accent text-accent bg-accent/10',
  gray: 'border-border text-muted-foreground bg-surface',
};

export interface DetailBadge { label: string; tone?: BadgeTone }
export interface DetailField { label: string; value?: ReactNode; href?: string }
export interface DetailSection { label: string; body?: string | null }
export interface TimelineItem { label: string; at?: string | null; detail?: string | null }

interface EntityDetailLayoutProps {
  /** Breadcrumb back to the record's queue/list. */
  breadcrumb: { label: string; href: string };
  /** Short record identifier shown after the breadcrumb (e.g. task key, short id). */
  recordLabel: string;
  title: string;
  badges?: DetailBadge[];
  fields?: DetailField[];
  sections?: DetailSection[];
  timeline?: TimelineItem[];
  /** Optional header actions (e.g. an AI summary button), right-aligned. */
  actions?: ReactNode;
  children?: ReactNode;
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Reusable detail surface for governance records (bugs, security reviews,
 * releases, approvals, incidents). Presentational only — the page server
 * component performs all access checks and passes real data; this never fetches
 * or fabricates anything. Renders an empty timeline state when there is no real
 * activity to show.
 */
export function EntityDetailLayout({
  breadcrumb, recordLabel, title, badges = [], fields = [], sections = [], timeline = [], actions, children,
}: EntityDetailLayoutProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Link href={breadcrumb.href} className="hover:text-foreground hover:underline underline-offset-4">
          {breadcrumb.label}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground truncate max-w-[40ch]">{recordLabel}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 bg-foreground shrink-0" />
          <span className="break-words">{title}</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {badges.map((b, i) => (
            <span key={i} className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border font-bold ${TONE[b.tone ?? 'gray']}`}>
              {b.label}
            </span>
          ))}
        </div>
        {actions && <div className="flex items-center gap-2 md:ml-auto">{actions}</div>}
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: sections + children + timeline */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {sections.filter((s) => s.body).map((s, i) => (
            <div key={i} className="border border-border bg-background p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-3">{s.label}</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">{s.body}</p>
            </div>
          ))}

          {children}

          {/* Activity timeline — built from real record events/timestamps. */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Activity Timeline
              </h3>
            </div>
            {timeline.length === 0 ? (
              <div className="p-6 text-xs font-mono text-muted-foreground">No activity recorded yet.</div>
            ) : (
              <div className="p-6">
                <div className="relative space-y-6 before:absolute before:top-1 before:bottom-1 before:left-[11px] before:w-px before:bg-border">
                  {timeline.map((t, i) => (
                    <div key={i} className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center relative z-10 shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-bold">{t.label}</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{fmt(t.at)}</span>
                        </div>
                        {t.detail && <p className="text-sm text-foreground/70 mt-1 break-words">{t.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: details */}
        <div className="space-y-6">
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Details</h3>
            </div>
            <div className="p-4 space-y-4">
              {fields.length === 0 && <div className="text-xs font-mono text-muted-foreground">No additional details.</div>}
              {fields.map((f, i) => (
                <div key={i}>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{f.label}</div>
                  {f.href ? (
                    <Link href={f.href} className="text-sm font-bold text-accent hover:underline underline-offset-4 break-words">
                      {f.value ?? '—'}
                    </Link>
                  ) : (
                    <div className="text-sm font-bold break-words">{f.value ?? '—'}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared full-height centered state shell. */
function StateShell({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action: { label: string; href: string } }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-6">
      <div className="w-12 h-12 border border-border bg-surface flex items-center justify-center text-muted-foreground">{icon}</div>
      <div>
        <h2 className="font-mono text-sm uppercase tracking-widest font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-2 max-w-sm">{body}</p>
      </div>
      <Link href={action.href} className="inline-flex items-center gap-2 h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest hover:bg-surface-hover transition-colors">
        {action.label} <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

/** 403 — shown without revealing any record metadata. */
export function EntityForbidden({ backHref = '/dashboard', backLabel = 'Back to dashboard' }: { backHref?: string; backLabel?: string }) {
  return (
    <StateShell
      icon={<Lock className="w-5 h-5" />}
      title="Access denied"
      body="You don't have permission to view this record in your organization."
      action={{ label: backLabel, href: backHref }}
    />
  );
}

/** 404 — record does not exist or is not in the caller's organization. */
export function EntityNotFound({ backHref = '/dashboard', backLabel = 'Back to dashboard' }: { backHref?: string; backLabel?: string }) {
  return (
    <StateShell
      icon={<FileQuestion className="w-5 h-5" />}
      title="Not found"
      body="This record doesn't exist or isn't part of your organization."
      action={{ label: backLabel, href: backHref }}
    />
  );
}

/** Loading skeleton for detail routes (rendered by each route's loading.tsx). */
export function EntityDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-3 w-40 bg-surface" />
      <div className="h-8 w-80 max-w-full bg-surface" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-40 bg-surface border border-border" />
          <div className="h-56 bg-surface border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" /> Loading…
          </div>
        </div>
        <div className="h-64 bg-surface border border-border" />
      </div>
    </div>
  );
}
