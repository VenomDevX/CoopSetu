import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

test.describe('Incidents', () => {
  test('declare incident, view timeline, and create postmortem', async ({ browser }) => {
    const context = await ctx(browser, 'owner');
    const page = await context.newPage();

    // Navigate to incidents dashboard
    await page.goto('/dashboard/incidents');
    await expect(page.getByRole('heading', { name: 'Incidents' })).toBeVisible();

    // 1. Declare Incident
    await page.getByRole('button', { name: 'Declare Incident' }).click();
    await expect(page.getByRole('heading', { name: 'Declare Incident' })).toBeVisible();

    const title = `E2E Incident Test ${Date.now()}`;
    await page.getByPlaceholder('e.g. API Latency Spike in EU Region').fill(title);
    await page.locator('select[name="severity"]').selectOption('SEV1');
    await page.getByPlaceholder('Describe how customers are affected...').fill('Total outage in E2E tests');

    await page.getByRole('button', { name: 'Declare Incident', exact: true }).click();
    
    // The modal should close and the new incident should appear in the list
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });

    // 2. View Incident and Timeline
    await page.getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Verify timeline shows "DECLARED" event
    await expect(page.locator('text=DECLARED')).toBeVisible();

    // 3. Create Postmortem (Wait, create postmortem is on the incidents page, not details page? Let me check)
    // Looking back at app/dashboard/incidents/page.tsx, the Create Postmortem button is on the global incidents page.
    await page.goto('/dashboard/incidents');
    await page.getByRole('button', { name: 'Create Postmortem' }).click();
    await expect(page.getByRole('heading', { name: 'Create Postmortem' })).toBeVisible();

    await page.locator('select[name="incident_id"]').selectOption({ label: title });
    await page.locator('textarea[name="summary"]').fill('This was an E2E test incident.');
    await page.locator('textarea[name="root_cause"]').fill('Playwright test runner.');

    await page.getByRole('button', { name: 'Save Postmortem', exact: true }).click();

    // The modal should close
    await expect(page.getByRole('heading', { name: 'Create Postmortem' })).not.toBeVisible();
    
    await context.close();
  });
});
