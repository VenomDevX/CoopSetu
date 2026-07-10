/**
 * Cheap, false-positive-tolerant heuristics for the AI prompt pipeline. None of
 * these ever block a request outright (a legitimate user can always ask about
 * "ignoring instructions" in a project-management context) — they only flag
 * suspicious input for the audit log, and cap pathological input shapes that
 * have no legitimate use (huge repeated-token padding, raw control chars).
 */

const INJECTION_PATTERNS = [
  /ignore (all|the|any|previous|prior|above) instructions/i,
  /disregard (all|the|any|previous|prior|above) instructions/i,
  /reveal (your|the) system prompt/i,
  /you are now/i,
  /new instructions?:/i,
  /act as (if )?(you|an?) (are|were)/i,
  /\bDAN\b/, // "Do Anything Now" jailbreak persona
  /developer mode/i,
];

/** Returns true if the prompt matches a known jailbreak/injection phrasing. */
export function looksLikeInjectionAttempt(prompt: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(prompt));
}

/**
 * Strips raw control characters (other than newline/tab) and collapses
 * pathological repeated-token padding (a common jailbreak technique to push
 * real instructions out of the model's attention window). Never throws —
 * always returns a usable string, sanitized to a sane shape.
 */
export function sanitizePromptInput(prompt: string): string {
  const noControlChars = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Collapse any run of 20+ consecutive repeats of the same short token/char.
  const noPadding = noControlChars.replace(/(.{1,20})\1{20,}/g, '$1');
  return noPadding;
}
