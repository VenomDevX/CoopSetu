import { describe, it, expect } from 'vitest';
import { toGrade, aggregateGrade, gradeColor } from '@/lib/lms/grade';

describe('toGrade', () => {
  it('places each band at its lower bound', () => {
    expect(toGrade(90, 100).letter).toBe('A+');
    expect(toGrade(80, 100).letter).toBe('A');
    expect(toGrade(70, 100).letter).toBe('B');
    expect(toGrade(60, 100).letter).toBe('C');
    expect(toGrade(40, 100).letter).toBe('D');
    expect(toGrade(39, 100).letter).toBe('F');
  });

  it('puts the value just below a bound in the band beneath it', () => {
    expect(toGrade(89, 100).letter).toBe('A');
    expect(toGrade(79, 100).letter).toBe('B');
    expect(toGrade(59, 100).letter).toBe('D');
  });

  it('scores against the assessment max, not out of 100', () => {
    const g = toGrade(18, 20);
    expect(g.percentage).toBe(90);
    expect(g.letter).toBe('A+');
  });

  it('honours the assessment passing_score instead of a fixed 40%', () => {
    // The bug this scale replaced: submitResult hardcoded 40, so 45% passed an
    // assessment whose own bar was 60.
    expect(toGrade(45, 100, 60).passed).toBe(false);
    expect(toGrade(45, 100, 40).passed).toBe(true);
    expect(toGrade(60, 100, 60).passed).toBe(true);
  });

  it('does not divide by zero on a zero-mark assessment', () => {
    const g = toGrade(0, 0);
    expect(g.percentage).toBe(0);
    expect(g.letter).toBe('F');
  });

  it('rounds to the nearest whole percent', () => {
    expect(toGrade(2, 3).percentage).toBe(67);
  });
});

describe('aggregateGrade', () => {
  it('returns null with nothing to aggregate', () => {
    expect(aggregateGrade([])).toBeNull();
  });

  it('weights by each assessment max rather than averaging percentages', () => {
    // 10/10 and 50/100: a plain mean of the percentages says 75%, but the
    // trainee scored 60 of 110 marks.
    const g = aggregateGrade([
      { score: 10, max_score: 10 },
      { score: 50, max_score: 100 },
    ]);
    expect(g?.percentage).toBe(55);
  });
});

describe('gradeColor', () => {
  it('gives every letter a class string', () => {
    for (const letter of ['A+', 'A', 'B', 'C', 'D', 'F'] as const) {
      expect(gradeColor(letter)).toMatch(/border-/);
    }
  });
});
