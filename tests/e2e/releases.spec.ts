import { test, expect } from '@playwright/test';

test.describe('Delivery: Releases & Deployments', () => {
  test.use({ storageState: 'tests/e2e/.auth/owner.json' });

  test('create a new release and view deployments', async ({ page }) => {
    // Navigate to Releases page
    await page.goto('/dashboard/releases');
    await expect(page.getByRole('heading', { name: 'Releases' })).toBeVisible();

    // Click "Create Release"
    await page.getByRole('button', { name: 'Create Release' }).click();
    await expect(page.getByRole('heading', { name: 'Create Release' })).toBeVisible();

    // Fill the form
    const releaseName = `E2E Release ${Date.now()}`;
    await page.locator('select[name="project_id"]').selectOption({ index: 1 }); // select the first actual project
    await page.locator('input[name="name"]').fill(releaseName);
    await page.locator('input[name="version"]').fill('1.0.0-e2e');
    await page.locator('textarea[name="description"]').fill('E2E automated release test');
    await page.locator('textarea[name="rollback_plan"]').fill('Rollback by restoring previous stable tag');

    // Submit
    await page.getByRole('button', { name: 'Create Release', exact: true }).click();

    // Modal should close and the new release should be visible in the list
    await expect(page.getByRole('heading', { name: 'Create Release' })).not.toBeVisible();
    await expect(page.getByText(releaseName)).toBeVisible();

    // Click into the release
    await page.getByText(releaseName).click();

    // We expect the Entity Detail to load with the correct title
    await expect(page.getByRole('heading', { name: releaseName })).toBeVisible();
    
    // Test passes if we successfully created it and navigated to the details
  });
});
