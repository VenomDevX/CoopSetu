import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/instituteAdmin.json' });

test.describe('logistics', () => {
  test('timetable and hostel tabs render', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/logistics');

    await expect(page.getByRole('button', { name: /^timetable$/i })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /schedule session/i })).toBeVisible();

    await page.getByRole('button', { name: /hostel & mess/i }).click();
    // The stat row is the tab's spine — beds and mess head-count.
    await expect(page.getByText(/occupied beds/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/on mess/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /allocate/i })).toBeVisible();
  });
});
