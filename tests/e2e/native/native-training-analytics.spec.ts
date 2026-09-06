import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/instituteAdmin.json' });

test.describe('training analytics', () => {
  test('institute admin lands on training outcomes, not sprint velocity', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/analytics');

    // The tab must exist and be the one selected on arrival — before this, an
    // institute admin was shown delivery metrics inherited from the
    // project-management core.
    await expect(page.getByRole('button', { name: /training outcomes/i }))
      .toBeVisible({ timeout: 60_000 });

    await expect(page.getByText(/trainee journey/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/registered/i).first()).toBeVisible();
    await expect(page.getByText(/institutes/i).first()).toBeVisible();
  });
});
