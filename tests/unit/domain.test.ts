import { describe, it, expect } from 'vitest';
import { sanitizeText } from '@/lib/validation/comment';
import { CLOSED_TASK_STATUSES, TASK_STATUSES } from '@/lib/constants/task-statuses';

describe('sanitizeText', () => {
  it('trims and preserves normal text + newlines', () => {
    expect(sanitizeText('  hello\nworld  ')).toBe('hello\nworld');
  });
  it('strips control characters', () => {
    const withCtrl = 'ab' + String.fromCharCode(0) + 'c';
    expect(sanitizeText(withCtrl)).toBe('abc');
  });
});

describe('task status constants', () => {
  it('closed statuses are a subset of all statuses', () => {
    for (const s of CLOSED_TASK_STATUSES) {
      expect(TASK_STATUSES).toContain(s);
    }
  });
  it('DONE and CANCELLED are closed', () => {
    expect(CLOSED_TASK_STATUSES).toContain('DONE');
    expect(CLOSED_TASK_STATUSES).toContain('CANCELLED');
  });
});
