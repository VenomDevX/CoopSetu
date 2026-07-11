import { test, expect } from '@playwright/test';

// Use pm@ for authenticated tests
test.use({ storageState: 'tests/e2e/.auth/owner.json' });

const viewports = {
  mobile: { width: 375, height: 812 },
  mobileLarge: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 900 }
};

test.describe('Responsive Workflows', () => {
  // 0. Marketing Page Responsive Checks
  for (const [name, vp] of Object.entries(viewports)) {
    test(`Landing Page no horizontal overflow on ${name}`, async ({ page }) => {
      // Use a new context without auth state
      const ctx = await page.context().browser()!.newContext({ storageState: undefined });
      const unauthPage = await ctx.newPage();
      await unauthPage.setViewportSize(vp);
      await unauthPage.goto('/');
      const noHorizontalScroll = await unauthPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
      await ctx.close();
    });
  }

  // 1. Login on mobile
  test('Login on mobile', async ({ page }) => {
    // Override storage state to unauthenticated
    await page.context().clearCookies();
    await page.setViewportSize(viewports.mobile);
    await page.goto('/login');
    const form = page.locator('input[type="text"]').first();
    await expect(form).toBeVisible();
    const loginBtn = page.getByRole('button', { name: /Sign in/i });
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toBeInViewport();
  });

  // 2. Signup wizard on mobile
  test('Signup wizard on mobile', async ({ page }) => {
    await page.context().clearCookies();
    await page.setViewportSize(viewports.mobileLarge);
    await page.goto('/signup');
    await expect(page.getByText('Get Started')).toBeVisible();
    // Verify it doesn't overflow horizontally
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHorizontalScroll).toBe(true);
  });

  // 3. Open/close sidebar on mobile
  test('Open/close sidebar on mobile', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/dashboard');
    const hamburger = page.getByTestId('mobile-menu-trigger');
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    const drawer = page.getByTestId('mobile-drawer');
    await expect(drawer).toBeVisible();
    const closeBtn = page.getByTestId('mobile-menu-close');
    await closeBtn.click();
    await expect(drawer).toBeHidden();
  });

  // 4, 5, 6. Create task on mobile, employee dropdown, save button
  test('Create task form, assignee dropdown, and save button on mobile', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/dashboard/tasks');
    await page.getByTestId('create-task-button').click();

    // Ensure form is a drawer (takes full height)
    const modal = page.getByTestId('create-task-modal');
    await expect(modal).toBeVisible();

    // Dropdown visibility
    const assigneeSelect = page.getByTestId('task-assignee-select');
    await expect(assigneeSelect).toBeVisible();

    // Action bar/Save button
    const saveBtn = page.getByTestId('task-save-button');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeInViewport();
  });

  // 7. Kanban board horizontal scroll
  test('Kanban board horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/dashboard/tasks');
    const boardContainer = page.getByTestId('kanban-board-scroll-container');
    await expect(boardContainer).toBeVisible();
    // Verify it is horizontally scrollable
    const scrollWidth = await boardContainer.evaluate(node => node.scrollWidth);
    const clientWidth = await boardContainer.evaluate(node => node.clientWidth);
    expect(scrollWidth).toBeGreaterThan(clientWidth);
  });

  // 8. Task table horizontal scroll
  test('Project table horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/dashboard/projects');
    // Default is list view
    const tableContainer = page.locator('.overflow-auto').first();
    await expect(tableContainer).toBeVisible();
    const scrollWidth = await tableContainer.evaluate(node => node.scrollWidth);
    const clientWidth = await tableContainer.evaluate(node => node.clientWidth);
    expect(scrollWidth).toBeGreaterThan(clientWidth);
  });

  // 9. Open task details modal on mobile
  test('Task details drawer on mobile', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/dashboard/tasks');
    // Click first task
    await page.locator('.task-card').first().click();
    // Details drawer slides in
    const drawer = page.getByTestId('task-drawer');
    await expect(drawer).toBeVisible();
    // Check save/cancel actions
    const closeBtn = page.getByTestId('task-drawer-close');
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toBeInViewport();
  });

  // 10. Dashboard cards/charts render without overflow
  test('Dashboard cards render without overflow', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/dashboard');
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHorizontalScroll).toBe(true);
  });

  // 11. Settings page remains usable on tablet
  test('Settings page on tablet', async ({ page }) => {
    await page.setViewportSize(viewports.tablet);
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: /Administration/i })).toBeVisible();
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHorizontalScroll).toBe(true);
  });

  // 12. Desktop sidebar and large tables work correctly
  test('Desktop sidebar and large tables', async ({ page }) => {
    await page.setViewportSize(viewports.desktop);
    await page.goto('/dashboard/projects');
    // Sidebar should be visible without hamburger
    const hamburger = page.getByTestId('mobile-menu-trigger');
    await expect(hamburger).toBeHidden();
    const sidebar = page.locator('aside').filter({ hasText: 'Ops_MGT' });
    await expect(sidebar).toBeVisible();
  });

  // 13. /join-team is public and never overflows, at every viewport.
  for (const [name, vp] of Object.entries(viewports)) {
    test(`Join-team page no horizontal overflow on ${name}`, async ({ page }) => {
      const ctx = await page.context().browser()!.newContext({ storageState: undefined });
      const unauthPage = await ctx.newPage();
      await unauthPage.setViewportSize(vp);
      await unauthPage.goto('/join-team');
      const noHorizontalScroll = await unauthPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
      await ctx.close();
    });
  }
});

test.describe('Student workspace responsive checks', () => {
  test.use({ storageState: 'tests/e2e/.auth/responsive-student.json' });

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    const email = `responsive-student-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Responsive Student');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Continue")');

    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });
    await page.fill('input[placeholder="janedoe"]', `respstudent${Date.now()}`);
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

    await ctx.storageState({ path: 'tests/e2e/.auth/responsive-student.json' });
    await ctx.close();
  });

  for (const [name, vp] of Object.entries(viewports)) {
    test(`Student dashboard no horizontal overflow on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/dashboard');
      const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
    });

    test(`STUDENT_SOLO settings no horizontal overflow on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/dashboard/settings');
      const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
    });
  }
});
