'use client';

import { gradeColor, type Grade } from '@/lib/lms/grade';

/**
 * The grade pill. Every grade the product shows comes through here, so the
 * letter, its colour and the percentage beside it can never drift apart —
 * they are all read off the one Grade object lib/lms/grade produced.
 */
export function GradeBadge({ grade, showPercentage = true }: { grade: Grade | null; showPercentage?: boolean }) {
  if (!grade) {
    return (
      <span className="inline-flex items-center border border-border rounded px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Not graded
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 border rounded px-2.5 py-1 ${gradeColor(grade.letter)}`}>
      <span className="font-bold text-sm tracking-tighter">{grade.letter}</span>
      {showPercentage && (
        <span className="font-mono text-[10px] uppercase tracking-widest tabular-nums opacity-80">
          {grade.percentage}% · {grade.label}
        </span>
      )}
    </span>
  );
}
