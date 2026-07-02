import { test, expect } from '@playwright/test';

test.describe('Reports & Analytics Creation and Scheduling', () => {
  test.use({ storageState: 'tests/e2e/.auth/owner.json' });

  test('can create a report and schedule it', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    
    // Create Report
    await page.getByRole('button', { name: 'Create Report' }).click();
    await expect(page.getByText('Report Name *')).toBeVisible();
    await page.getByPlaceholder('e.g. Q3 Analytics Overview').fill('Test Global Report');
    await page.getByRole('button', { name: 'Save Report' }).click();

    // Immediately prompts to schedule
    await expect(page.getByText('Schedule Report Delivery')).toBeVisible();
    await page.getByPlaceholder('0 9 * * 1').fill('0 9 * * *');
    await page.getByPlaceholder('manager@example.com').fill('test@example.com');
    await page.getByRole('button', { name: 'Save Schedule' }).click();

    // Modals closed
    await expect(page.getByText('Schedule Report Delivery')).not.toBeVisible();
  });
});
