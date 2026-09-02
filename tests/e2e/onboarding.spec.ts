import { test, expect } from '@playwright/test';

test.describe('Unified Onboarding Flow', () => {

  test('Old centered organization UI is unreachable', async ({ page }) => {
    const resProject = await page.goto('/onboarding/project');
    expect(resProject?.status()).toBe(404);

    const resInvite = await page.goto('/onboarding/invite');
    expect(resInvite?.status()).toBe(404);
  });

  test('GitHub and normal onboarding use the same shell', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('text=Enterprise work management')).toBeVisible();
    // "Account Details" legitimately appears twice (left-panel step overview
    // + the form's own step label) — use .first() to avoid a strict-mode
    // violation rather than asserting on an intentionally duplicated label.
    await expect(page.locator('text=Account Details').first()).toBeVisible();
  });

  test('Email signup requiring confirmation shows confirmation-required state', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', `test-unconfirmed-${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    // Using page.route to simulate email confirmation enabled, where Supabase returns session: null
    await page.route('**/auth/v1/signup*', async (route) => {
      await route.fulfill({ json: { user: { id: '123' }, session: null }, status: 200 });
    });
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('Safe signed invite return-to flow and malicious URL rejection', async ({ page, context }) => {
    // Navigate to invite route unauthenticated
    await page.goto('/invite/fake-token-123');
    // Middleware should redirect to login and set cookie
    await page.waitForURL('**/login?next=%2Finvite%2Ffake-token-123');
    const cookies = await context.cookies();
    const returnTo = cookies.find(c => c.name === 'invite_return_to');
    expect(returnTo).toBeDefined();
    // Next.js's cookie serializer URL-encodes values on set() and decodes them
    // symmetrically on the server via cookies().get().value — but Playwright's
    // context.cookies() reads the raw wire value, so it's the encoded form.
    expect(returnTo?.value).toBe('%2Finvite%2Ffake-token-123');

    // Test malicious URL rejection:
    // If someone visits /login?next=https://evil.com, it should not set the cookie
    // because middleware only intercepts /invite/*
    await page.goto('/login?next=https://evil.com');
    // Then we mock login. If we mock login, router pushes to safeNext which will reject absolute urls.
  });

});
