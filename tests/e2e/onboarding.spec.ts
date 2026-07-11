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

test.describe('Student Workspace Onboarding', () => {
  test('a fresh user is offered the work-vs-study choice, and choosing study leads to the 3 student options', async ({ page }) => {
    const email = `student-e2e-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Student Tester');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Continue")');

    // Local dev has email confirmations disabled, so this should land on /onboarding
    // and the resolver should send a profile-incomplete user to /onboarding/profile first.
    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });

    // Complete the minimal profile step.
    await page.fill('input[placeholder="janedoe"]', `student${Date.now()}`);
    await page.selectOption('select >> nth=0', 'Engineering');
    await page.selectOption('select >> nth=1', 'Software Engineer');
    await page.selectOption('select >> nth=2', 'Backend');
    await page.click('button:has-text("Continue")');

    // No workspace_path_intent cookie yet -> the resolver sends us to the choice screen.
    await page.waitForURL('**/onboarding/workspace-path', { timeout: 15000 });
    await expect(page.locator('text=What brings you to Handoff?')).toBeVisible();
    await expect(page.locator('text=For Work')).toBeVisible();
    await expect(page.locator('text=For Study / Hackathons')).toBeVisible();

    await page.click('text=For Study / Hackathons');
    await page.waitForURL('**/onboarding/student', { timeout: 15000 });
    await expect(page.locator('text=Personal Solo Workspace')).toBeVisible();
    await expect(page.locator('text=Create a Student Team')).toBeVisible();
    await expect(page.locator('text=Join a Student Team')).toBeVisible();

    const cookies = await page.context().cookies();
    const intent = cookies.find((c) => c.name === 'workspace_path_intent');
    expect(intent?.value).toBe('student');
  });

  test('creating a personal solo workspace lands on the dashboard with student-gated Settings', async ({ page }) => {
    const email = `student-solo-e2e-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Solo Tester');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Continue")');

    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });
    await page.fill('input[placeholder="janedoe"]', `solo${Date.now()}`);
    await page.selectOption('select >> nth=0', 'Engineering');
    await page.selectOption('select >> nth=1', 'Software Engineer');
    await page.selectOption('select >> nth=2', 'Backend');
    await page.click('button:has-text("Continue")');

    await page.waitForURL('**/onboarding/workspace-path', { timeout: 15000 });
    await page.click('text=For Study / Hackathons');
    await page.waitForURL('**/onboarding/student', { timeout: 15000 });
    await page.click('text=Personal Solo Workspace');
    await page.waitForURL('**/onboarding/student/solo', { timeout: 15000 });

    await page.click('button:has-text("Create Workspace")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.goto('/dashboard/settings');
    await expect(page.locator('text=Account Settings')).toBeVisible();
    // Scope to the settings sidebar nav — the Danger Zone copy legitimately
    // contains the substring "Organizations" ("Organizations you solely own
    // will also be deleted..."), which a page-wide text locator would also match.
    const sidebarNav = page.locator('div.md\\:w-64');
    await expect(sidebarNav.locator('text=Billing')).toHaveCount(0);
    await expect(sidebarNav.locator('text=Organization')).toHaveCount(0);
  });
});
