import { defineConfig, devices } from '@playwright/test';

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
      use: { ...devices['Desktop Chrome'] },
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
