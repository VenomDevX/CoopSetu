import { test, expect } from '@playwright/test';

test.describe('Public Demo Workspace', () => {
  // Test basic public UI
  test('Demo CTA exists on authentication pages', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=EXPLORE DEMO')).toBeVisible();

    await page.goto('/signup');
    await expect(page.locator('text=EXPLORE DEMO')).toBeVisible();
  });

  test('Can navigate to demo selection page', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.locator('h1')).toHaveText('CHOOSE YOUR ROLE');
    await expect(page.locator('text=Project Manager')).toBeVisible();
    await expect(page.locator('text=START DEMO').first()).toBeVisible();
  });

  // Since provisioning takes time and alters the DB, we may want to skip
  // full E2E flow in standard test runs unless isolated.
  test.skip('Can start demo and see banner', async ({ page }) => {
    test.setTimeout(60000); // Provisioning takes ~10-15s
    
    await page.goto('/demo');
    
    // Start Demo as Developer
    const devCard = page.locator('div').filter({ hasText: 'DEVELOPER' }).first();
    await devCard.locator('button', { hasText: 'START DEMO' }).click();

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    
    // Verify Demo Banner exists
    await expect(page.locator('text=DEMO WORKSPACE')).toBeVisible();
    
    // Verify Exit button
    await page.locator('text=Exit Demo').click();
    await page.waitForURL('/login');
  });
});
