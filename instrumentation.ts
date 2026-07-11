/**
 * Next.js instrumentation hook — runs once at server startup, before any
 * request is handled. We use it to validate environment configuration so the
 * app fails fast (and loudly) on a misconfigured deploy rather than serving
 * broken requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');
    validateEnv();
  }
}
