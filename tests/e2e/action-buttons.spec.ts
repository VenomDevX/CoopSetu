import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Run tests in serial since we rely on the project created in Test 1 for Test 2
test.describe.serial('Action Buttons Group A', () => {
  test.use({ storageState: 'tests/e2e/.auth/owner.json' });

  test('1. Projects: CSV Import', async ({ page }, testInfo) => {
    const csvContent = `Name,Code,Description,Status\nPlaywright Project ${Date.now()},PLW,Test,ACTIVE\n`;
    const tempCsvPath = testInfo.outputPath('import.csv');
    fs.writeFileSync(tempCsvPath, csvContent);

    await page.goto('/dashboard/projects');
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();

    await page.click('[data-testid="project-import-button"]');
    await expect(page.locator('text="Import Projects"').first()).toBeVisible();

    await page.setInputFiles('[data-testid="project-import-file"]', tempCsvPath);
    await page.click('[data-testid="project-import-preview"]');
    
    await expect(page.locator('text="Row Review"').first()).toBeVisible();
    await page.click('[data-testid="project-import-confirm"]');
    
    // Modal closes automatically, verify the new project appears in the table
    await expect(page.locator('text="PLW"').first()).toBeVisible({ timeout: 5000 });
  });

  test('2. Calendar: Add Deadline Modal', async ({ page }) => {
    await page.goto('/dashboard/calendar');
    
    await page.click('[data-testid="add-deadline-button"]');
    await expect(page.locator('text="Add Deadline"').first()).toBeVisible();

    const deadlineTitle = `Test Deadline ${Date.now()}`;
    await page.fill('[data-testid="deadline-title-input"]', deadlineTitle);
    
    // Project select should now have at least one valid project from Test 1
    await page.waitForSelector('[data-testid="deadline-project-select"] option:nth-child(2)', { state: 'attached', timeout: 10000 });
    await page.locator('[data-testid="deadline-project-select"]').selectOption({ index: 1 });
    
    const today = new Date().toISOString().split('T')[0];
    await page.fill('[data-testid="deadline-date-input"]', today);

    await page.click('[data-testid="deadline-save-button"]');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    await expect(page.locator(`text="${deadlineTitle}"`)).toBeVisible({ timeout: 5000 });
  });

  test('3. Projects: Export Report', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();

    await page.click('[data-testid="project-export-report-button"]');
    await expect(page.locator('text="Export Project Report"').first()).toBeVisible();
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-report-confirm"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('4. Sprints: Export Sprint Report', async ({ page }) => {
    await page.goto('/dashboard/sprints');
    await expect(page.locator('h1:has-text("Sprints")')).toBeVisible();

    await page.click('[data-testid="sprint-export-report-button"]');
    await expect(page.locator('text="Export Sprint Report"').first()).toBeVisible();
    
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[role="dialog"] [data-testid="export-report-confirm"]').click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });
});
