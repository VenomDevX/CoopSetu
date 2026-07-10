'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, CheckSquare, Layers, Bug, AlertCircle, FileText, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import type { SearchHit } from '@/services/search.service';

export interface PaletteNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const HIT_ICONS: Record<SearchHit['type'], LucideIcon> = {
  task: CheckSquare, project: Layers, bug: Bug, incident: AlertCircle, document: FileText,
};
const HIT_LABELS: Record<SearchHit['type'], string> = {
  task: 'Task', project: 'Project', bug: 'Bug', incident: 'Incident', document: 'Document',
};

interface PaletteResult {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Where Enter / click navigates. */
  href: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Already permission-filtered nav destinations from the shell. */
  navItems: PaletteNavItem[];
  /** Whether the current member may list tasks (gates the task fetch). */
  canViewTasks: boolean;
}

/**
 * Global ⌘K command palette. Searches permission-filtered navigation plus a
 * debounced cross-entity backend search (tasks, projects, bugs, incidents,
 * documents via `/api/v1/search`) and deep-links each hit to its page.
 * Keyboard-driven: ↑/↓ to move, Enter to go, Esc to close.
 */
export function CommandPalette({ open, onClose, navItems, canViewTasks }: Props) {
  // The body is mounted only while open, so its state resets on each open via a
  // fresh mount — no reset effect (and no synchronous setState in an effect).
  return (
    <AnimatePresence>
      {open && (
        <PaletteBody onClose={onClose} navItems={navItems} canViewTasks={canViewTasks} />
      )}
    </AnimatePresence>
  );
}

function PaletteBody({ onClose, navItems, canViewTasks }: Omit<Props, 'open'>) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  // Debounce the query before it hits the backend so we don't fire a search
  // request per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Cross-entity search (tasks, projects, bugs, incidents, documents) once the
  // user has typed something. RLS + org scoping happens server-side; a 403 or
  // empty response just yields no hits rather than a fabricated list.
  const { data: searchHits = [], isFetching: searching } = useQuery({
    queryKey: ['command-palette-search', debouncedQuery],
    queryFn: () => apiGet<SearchHit[]>(`/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: canViewTasks && debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase();
    const nav: PaletteResult[] = navItems
      .filter((it) => !q || it.name.toLowerCase().includes(q))
      .map((it) => ({ key: `nav:${it.href}`, label: it.name, hint: 'Go to', icon: it.icon, href: it.href }));

    // Search hits only surface once the (debounced) query is committed —
    // keeps the default view to nav and avoids flashing stale results.
    const hits: PaletteResult[] = q.length >= 2
      ? searchHits.map((h) => ({
          key: `${h.type}:${h.id}`,
          label: h.title,
          hint: [HIT_LABELS[h.type], h.subtitle].filter(Boolean).join(' · '),
          icon: HIT_ICONS[h.type],
          href: h.href,
        }))
      : [];

    return [...nav, ...hits];
  }, [query, navItems, searchHits]);

  // Clamp the highlighted row to the current result count at render time (results
  // shrink as the query narrows) rather than syncing via an effect.
  const safeActive = results.length ? Math.min(active, results.length - 1) : 0;

  const go = useCallback((r?: PaletteResult) => {
    const target = r ?? results[safeActive];
    if (!target) return;
    onClose();
    router.push(target.href);
  }, [results, safeActive, onClose, router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(safeActive + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(safeActive - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="fixed left-1/2 top-[15vh] -translate-x-1/2 w-[92%] max-w-xl bg-background border border-border rounded shadow-2xl z-[71] flex flex-col"
        onKeyDown={onKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, tasks, projects, bugs, incidents, docs…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          <kbd className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">
              No matches
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key}
                onClick={() => go(r)}
                onMouseMove={() => setActive(i)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                  i === safeActive ? 'bg-foreground text-background' : 'text-foreground hover:bg-surface-hover'
                }`}
              >
                <r.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate text-sm">{r.label}</span>
                {r.hint && (
                  <span className={`text-[10px] font-mono uppercase tracking-widest shrink-0 ${
                    i === safeActive ? 'text-background/70' : 'text-muted-foreground'
                  }`}>
                    {r.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 h-9 border-t border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> Move</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> Open</span>
        </div>
      </motion.div>
    </>
  );
}
