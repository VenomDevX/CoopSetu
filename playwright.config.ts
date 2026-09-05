import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Load .env.local into the Playwright runner process so the auth setup can read
// TEST_USER_PASSWORD (and friends). `next dev` loads it for the server, but the
// test runner itself does not — without this, auth.setup.ts throws
// "TEST_USER_PASSWORD is required" locally (CI sets it explicitly in the job env).
loadEnv({ path: '.env.local' });

/**
 * Local E2E config. Drives the real app + local Supabase.
 * Prereqs: `npx supabase start` and a seeded DB (`npx supabase db reset`).
 * The webServer block boots `next dev` (reused if already running).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  // 1 retry absorbs realtime timing flake (e.g. right after the realtime
  // container restarts on a db reset); deterministic tests still pass first try.
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'e2e',
      dependencies: ['setup'],
      // Excludes tests/e2e/native/** so the existing suite keeps exercising
      // the WEB shell only — that separation is what proves the native UI
      // hasn't leaked.
      testIgnore: /native\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // The Capacitor app is a WebView, so the only thing distinguishing it
      // from a mobile browser is the UA sentinel that capacitor.config.ts's
      // appendUserAgent adds. Playwright cannot emulate a native context, but
      // it reproduces a UA exactly — which is precisely why detection was
      // built on the UA rather than @capacitor/core's isNativePlatform().
      name: 'native',
      dependencies: ['setup'],
      testMatch: /native\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        userAgent: `${devices['Pixel 7'].userAgent} CoopSetuApp/1`,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 120_000,
    // Disables the global per-IP rate limiter (middleware.ts) for this dev
    // server only — real-browser test traffic (page loads, prefetches,
    // notification polling) shares one per-IP counter across every route, so
    // a full suite run can trip it well before any single endpoint's own
    // budget is exceeded. Never set outside of this webServer spawn. NOTE:
    // if a dev server is already running (reuseExistingServer), Playwright
    // reuses it as-is and this env var has no effect — stop any existing
    // `npm run dev` first if you need rate limiting off for a test run.
    env: { ...process.env, DISABLE_RATE_LIMIT: 'true' },
  },
});
