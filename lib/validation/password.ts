import { z } from 'zod';

/** Shared password policy: 12+ chars, upper/lower/number/special. Used by both
 * signup and password-reset so the two flows can never drift out of sync. */
export const passwordSchema = z
  .string()
  .min(12)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export interface PasswordChecklist {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
  score: number;
  strength: 'WEAK' | 'FAIR' | 'STRONG';
}

export function checkPassword(password: string): PasswordChecklist {
  const length = password.length >= 12;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const score = [upper, lower, number, special].filter(Boolean).length;
  const strength = score < 2 ? 'WEAK' : score < 4 ? 'FAIR' : 'STRONG';
  return { length, upper, lower, number, special, score, strength };
}
