'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

/**
 * Bottom sheet — the native app's counterpart to the desktop dropdown.
 *
 * One primitive, reused by every sheet in the mobile shell. Dismissed by the
 * backdrop, the close button, Escape, or dragging down past a threshold.
 * `motion/react` is already a dependency (and already transpiled via
 * next.config.ts), so this adds nothing to the bundle that the desktop shell
 * doesn't already pull in.
 */
export function MobileSheet({
  open,
  onClose,
  title,
  closeLabel,
  testId,
  closeTestId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  testId?: string;
  closeTestId?: string;
  children: React.ReactNode;
}) {
  // Escape closes, and the page behind must not scroll while the sheet is up —
  // same body-overflow lock the desktop shell's drawer uses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end" data-native-chrome>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-testid={testId}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="relative bg-surface-elevated border-t border-border rounded-t-2xl max-h-[85dvh] flex flex-col
                       pb-[var(--safe-bottom)] shadow-2xl"
          >
            {/* Drag affordance */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-border-strong" />
            </div>

            <div className="px-4 pb-3 flex items-center justify-between shrink-0 border-b border-border">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                data-testid={closeTestId}
                data-native-tap
                className="-mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
