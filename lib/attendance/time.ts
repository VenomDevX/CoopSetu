/**
 * IST time utilities for attendance.
 *
 * All attendance logic operates in IST (Asia/Kolkata, UTC+5:30) because the
 * system serves Indian cooperative training institutes. A 22:00 UTC tap must
 * bucket to the IST day (03:30 next day), not the UTC day. The old code used
 * `marked_at.slice(0, 10)` which silently misclassified every evening tap.
 */

export const IST_TZ = 'Asia/Kolkata';

/** Grace before slot start_time when a tap counts for that slot (minutes). */
export const GRACE_BEFORE_MIN = 20;

/** Grace after slot end_time when a tap still counts for that slot (minutes). */
export const GRACE_AFTER_MIN = 15;

/** Minutes after slot start_time after which a tap is marked LATE. */
export const LATE_AFTER_MIN = 10;

/** Deduplicate window for device taps (minutes). */
export const DEDUPE_WINDOW_MIN = 30;

/**
 * Returns the YYYY-MM-DD date string in IST for the given Date.
 * Replaces every `.slice(0, 10)` and `.substring(0, 10)` on UTC timestamps.
 */
export function istDayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-CA', { timeZone: IST_TZ });
  // 'en-CA' locale gives YYYY-MM-DD format
}

/**
 * Returns HH:MM:SS in IST for the given Date.
 */
export function istClock(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Returns a Date representing midnight IST for the given date.
 */
export function istMidnight(d: Date | string): Date {
  const dayKey = istDayKey(d);
  // Parse YYYY-MM-DD as IST midnight
  return new Date(`${dayKey}T00:00:00+05:30`);
}

/**
 * Converts a TIME string (HH:MM or HH:MM:SS) and a DATE string (YYYY-MM-DD)
 * into a Date in IST.
 */
export function istDateTime(date: string, time: string): Date {
  // Normalize time to HH:MM:SS
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}+05:30`);
}

/**
 * Returns the current time as a Date (convenience wrapper for testing —
 * tests can mock this module).
 */
export function nowIST(): Date {
  return new Date();
}
