/**
 * Startup environment validation. Called from instrumentation.ts so the app
 * refuses to boot when a critical variable is missing or malformed, instead of
 * failing later with a cryptic runtime error on the first request.
 */

interface RequiredVar {
  name: string;
  hint: string;
}

// Absolutely required for the app to function at all.
const CRITICAL: RequiredVar[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', hint: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', hint: 'Supabase anon/publishable key' },
  { name: 'ENCRYPTION_KEY', hint: '32-byte base64 key for integration-secret encryption' },
];

// At least one of these must be present (service-role key, server-only).
const SERVICE_KEY_ALTERNATIVES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'];

function isSet(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function validateEnv(): void {
  const problems: string[] = [];

  for (const v of CRITICAL) {
    if (!isSet(v.name)) problems.push(`${v.name} — ${v.hint}`);
  }

  if (!SERVICE_KEY_ALTERNATIVES.some(isSet)) {
    problems.push(
      `${SERVICE_KEY_ALTERNATIVES.join(' or ')} — Supabase service-role key (server-only)`,
    );
  }

  // ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256-GCM).
  const enc = process.env.ENCRYPTION_KEY?.trim();
  if (enc && Buffer.from(enc, 'base64').length !== 32) {
    problems.push('ENCRYPTION_KEY — must decode from base64 to exactly 32 bytes');
  }

  if (problems.length > 0) {
    throw new Error(
      'FATAL: refusing to start — missing or invalid required environment variables:\n' +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\nSee .env.example for the full list of variables.',
    );
  }

  // Non-fatal warnings: features degrade gracefully but an operator should know.
  const warnings: string[] = [];
  if (!isSet('GEMINI_API_KEY')) {
    warnings.push('GEMINI_API_KEY not set — AI features will return 503 until configured');
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http://')
  ) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL is not HTTPS in production — database traffic must use TLS');
  }
  if (warnings.length > 0) {
    console.warn('[env] warnings:\n' + warnings.map((w) => `  - ${w}`).join('\n'));
  }
}
