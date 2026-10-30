import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * Phase 6: app/dashboard/teams/page.tsx used to render fabricated content
 * unconditionally — a hardcoded 65% sprint progress bar, a payments-company
 * "Mission" quote, static Resource Planning KPIs, a fake "Mobile Banking is
 * at risk" AI recommendation, and alert()-stub buttons. This test drives the
 * real page and asserts that content is gone, not just that new fields exist
 * (the unit/integration suites already cover the aggregation math itself).
 */
test('teams page: no fabricated copy or numbers, real team data renders', async ({ browser }) => {
  const ownerCtx = await ctx(browser, 'owner');
  const page = await ownerCtx.newPage();
  await page.goto('/dashboard/teams');

  await expect(page.getByText('Payments Platform')).toBeVisible();

  // Fabricated content that must never reappear anywhere on this page.
  await expect(page.getByText('reliable, scalable, and secure payment processing')).toHaveCount(0);
  await expect(page.getByText('Sprint Progress').locator('..').getByText('65%')).toHaveCount(0);
  await expect(page.getByText(/Mobile Banking.*team is at risk/)).toHaveCount(0);
  await expect(page.getByText('2,320h')).toHaveCount(0);
  await expect(page.getByText('Update Auth Service to v2')).toHaveCount(0);

  // Open the seeded "Payments Platform" team's detail view and confirm its
  // health badge reflects the real linked project's health (AT_RISK), not a
  // hardcoded "Healthy".
  await page.getByText('Payments Platform').click();
  await expect(page.getByText('At Risk').first()).toBeVisible();

  await ownerCtx.close();
});
