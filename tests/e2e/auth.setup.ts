import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Logs in each demo role through the real UI and saves a storage state file so
 * each E2E test can run as a distinct authenticated session.
 */
const ACCOUNTS: Record<string, string> = {
  owner: 'owner@apexfintech.test',
  pm: 'pm@apexfintech.test',
  tm: 'tm@apexfintech.test',
  dev: 'dev@apexfintech.test',
};

fs.mkdirSync('tests/e2e/.auth', { recursive: true });

for (const [key, email] of Object.entries(ACCOUNTS)) {
  setup(`authenticate ${key}`, async ({ page }) => {
    // Auth setup authenticates via the real login API (which sets the Supabase
    // session cookie on the browser context) rather than driving the login form.
    // This keeps the fixture deterministic; the UI login flow itself is exercised
    // by the role-workflow specs. The request shares the page's cookie jar.
    const res = await page.request.post('/api/v1/auth/login', {
      data: { identifier: email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })(), rememberDevice: true },
    });
    expect(res.ok(), `login failed for ${email}: HTTP ${res.status()}`).toBeTruthy();

    // Confirm the session cookie grants dashboard access, then persist state.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await page.context().storageState({ path: `tests/e2e/.auth/${key}.json` });
  });
}
