'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared modal shell used by all dashboard modals: overlay + panel with the
 * standard header (square marker, mono uppercase title, close button),
 * scrollable body, and optional footer. Handles Escape-to-close, backdrop
 * click, body scroll lock, focus trapping, and dialog ARIA semantics.
 */
export function Dialog({
  title,
  onClose,
  footer,
  children,
  className,
  bodyClassName,
  testId,
}: {
  title: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the panel, e.g. a max-width override (default max-w-2xl). */
  className?: string;
  bodyClassName?: string;
  testId?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute('disabled'))
        : [];

    // Move focus into the dialog unless a field autofocused itself.
    if (panel && !panel.contains(document.activeElement)) {
      (focusables()[0] ?? panel).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-2xl bg-background sm:border sm:border-border sm:shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in duration-300 focus:outline-none',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-foreground" /> {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={cn('p-6 overflow-y-auto flex-1 space-y-5', bodyClassName)}>{children}</div>

        {footer && (
          <div className="p-4 border-t border-border bg-surface flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Standard field/label classes shared by modal forms. */
export const dialogLabelCls =
  'text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block';
export const dialogFieldCls =
  'w-full h-9 px-3 bg-background border border-border rounded text-sm focus:outline-none focus:border-foreground transition-colors';
