import { test, expect } from '@playwright/test';

test.describe('Signup: Google OAuth parity', () => {
  test('Google sign-in button is present alongside GitHub on /signup', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

});

test.describe('Forgot password', () => {
  test('form validation disables submit until a valid email is entered', async ({ page }) => {
    await page.goto('/forgot-password');
    const submitBtn = page.getByRole('button', { name: 'Send Reset Link' });
    await expect(submitBtn).toBeDisabled();

    await page.fill('input[type="email"]', 'not-an-email');
    await expect(submitBtn).toBeDisabled();

    await page.fill('input[type="email"]', 'someone@example.com');
    await expect(submitBtn).toBeEnabled();
  });

  test('shows an enumeration-safe success message for any submitted email', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[type="email"]', `no-such-account-${Date.now()}@example.com`);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 10000 });
  });

  test('links back to sign in', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('link', { name: 'Back to Sign In' })).toBeVisible();
  });
});

test.describe('Reset password', () => {
  test('visiting without a valid recovery session shows an invalid-link state', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('text=This link is invalid or expired')).toBeVisible();
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
  });
});
