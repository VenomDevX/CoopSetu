import { test, expect } from '@playwright/test';

test.describe('Reports & Analytics Exports', () => {
  test.use({ storageState: 'tests/e2e/.auth/owner.json' });

  test('can download PDF and CSV reports', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

    // Setup download listeners
    const downloadPromisePdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const downloadPdf = await downloadPromisePdf;
    expect(downloadPdf.suggestedFilename()).toContain('handoff-global-analytics-');
    expect(downloadPdf.suggestedFilename()).toContain('.pdf');

    const downloadPromiseCsv = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const downloadCsv = await downloadPromiseCsv;
    expect(downloadCsv.suggestedFilename()).toContain('handoff-global-analytics-');
    expect(downloadCsv.suggestedFilename()).toContain('.csv');
  });
});
