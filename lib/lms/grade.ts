/**
 * The one grade scale.
 *
 * Percentages were being rendered ad hoc and no grade existed anywhere. Keeping
 * the bands in a single module means the API, the trainee's screen, the staff
 * results table and the seed all say the same thing about the same score —
 * three of those previously had no opinion at all, and the fourth would have
 * invented one.
 */

export type GradeLetter = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface Grade {
  letter: GradeLetter;
  label: string;
  /** 0-100, rounded. */
  percentage: number;
  passed: boolean;
}

/** Lower bound of each band, highest first. */
const BANDS: { min: number; letter: GradeLetter; label: string }[] = [
  { min: 90, letter: 'A+', label: 'Outstanding' },
  { min: 80, letter: 'A',  label: 'Excellent' },
  { min: 70, letter: 'B',  label: 'Good' },
  { min: 60, letter: 'C',  label: 'Satisfactory' },
  { min: 40, letter: 'D',  label: 'Pass' },
  { min: 0,  letter: 'F',  label: 'Not passed' },
];

/**
 * @param passingPct the assessment's own passing_score, as a percentage of
 * max_score. Defaults to 40 — the schema default — but callers should pass the
 * real value: submitResult() used to hardcode 40 and ignore an assessment set
 * to 60, so a 45% answer passed an exam it should have failed.
 */
export function toGrade(score: number, maxScore: number, passingPct = 40): Grade {
  // A zero-mark assessment is a data problem, not a division-by-zero crash.
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const band = BANDS.find((b) => percentage >= b.min) ?? BANDS[BANDS.length - 1];

  return {
    letter: band.letter,
    label: band.label,
    percentage,
    // Passing is the assessment's threshold, not the letter: an assessment with
    // a 60% bar fails a D even though D is nominally "Pass".
    passed: percentage >= passingPct,
  };
}

/** Average of several results, weighted by each one's max score. */
export function aggregateGrade(
  results: { score: number; max_score: number }[],
  passingPct = 40,
): Grade | null {
  if (!results.length) return null;
  const totalScore = results.reduce((a, r) => a + (r.score || 0), 0);
  const totalMax = results.reduce((a, r) => a + (r.max_score || 0), 0);
  return toGrade(totalScore, totalMax, passingPct);
}

/** Tailwind classes for a grade pill, matching the pill vocabulary elsewhere. */
export function gradeColor(letter: GradeLetter): string {
  switch (letter) {
    case 'A+':
    case 'A':  return 'border-green-500/40 text-green-500 bg-green-500/10';
    case 'B':  return 'border-accent/40 text-accent bg-accent/10';
    case 'C':  return 'border-blue-500/40 text-blue-500 bg-blue-500/10';
    case 'D':  return 'border-yellow-500/40 text-yellow-500 bg-yellow-500/10';
    default:   return 'border-red-500/40 text-red-500 bg-red-500/10';
  }
}
