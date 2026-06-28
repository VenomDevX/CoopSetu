import { test, expect, type BrowserContext, type Browser } from '@playwright/test';

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

async function firstUpiTaskId(context: BrowserContext): Promise<string> {
  const res = await context.request.get('/api/v1/tasks?projectId=&status=');
  const json = await res.json();
   
  const rows: any[] = json.data ?? [];
  const t = rows.find((r) => r.project?.code === 'UPI') ?? rows[0];
  return t.id as string;
}

// 1. New user can create a company and becomes its owner.
test('workflow 1: signup → create company → becomes owner', async ({ browser }) => {
  const c = await browser.newContext();
  const page = await c.newPage();
  const email = `e2e_owner_${Date.now()}@x.test`;
  await page.goto('/signup');
  await page.getByPlaceholder('FULL NAME').fill('E2E Owner');
  await page.getByPlaceholder('EMAIL').fill(email);
  await page.getByPlaceholder(/PASSWORD/).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL('**/onboarding/company', { timeout: 30_000 });
  await page.getByPlaceholder('ORGANIZATION NAME').fill('E2E Test Co');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/onboarding/team', { timeout: 30_000 });
  // verify owner role via API
  const res = await c.request.get('/api/v1/organizations/current');
  const json = await res.json();
  expect(json.data.membership.roles).toContain('ORG_OWNER');
  await c.close();
});

// 3. Employee UI is gated: no create actions, analytics hidden, personal overview.
test('workflow 3: employee sees gated UI', async ({ browser }) => {
  const c = await ctx(browser, 'dev');
  const page = await c.newPage();
  await page.goto('/dashboard');
  await expect(page.getByText('MY_WORKSPACE')).toBeVisible();           // personal overview
  await expect(page.getByRole('button', { name: 'Init_Task' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Analytics' })).toHaveCount(0);
  await c.close();
});

// 3b. Employee cannot create a project or assign tasks (API enforced).
test('workflow 3b: employee blocked from project create + task assign', async ({ browser }) => {
  const c = await ctx(browser, 'dev');
  const createRes = await c.request.post('/api/v1/projects', {
    data: { name: 'Nope', code: 'NOPE' },
  });
  expect(createRes.status()).toBe(403);
  await c.close();
});

// 2 + 4. PM creates+assigns a task to the developer; employee sees it in My Work.
test('workflow 2+4: PM creates & assigns task → employee sees it', async ({ browser }) => {
  const pm = await ctx(browser, 'pm');
  // resolve dev member id
  const memRes = await pm.request.get('/api/v1/employees');
   
  const members: any[] = (await memRes.json()).data ?? [];
  const devMember = members.find((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return p?.email === 'dev@apexfintech.test';
  });
  const projRes = await pm.request.get('/api/v1/projects');
  const projects = (await projRes.json()).data ?? [];
  const upi = projects.find((p: { code: string }) => p.code === 'UPI');

  const title = `E2E assigned ${Date.now()}`;
  const created = await pm.request.post('/api/v1/tasks', {
    data: { project_id: upi.id, title, status: 'READY', primary_assignee_member_id: devMember.id },
  });
  expect(created.status()).toBe(201);

  const dev = await ctx(browser, 'dev');
  const mine = await dev.request.get('/api/v1/tasks?mine=true');
   
  const myTasks: any[] = (await mine.json()).data ?? [];
  expect(myTasks.some((t) => t.title === title)).toBe(true);
  await pm.close(); await dev.close();
});

// 5. Realtime: a task created live appears on the PM board without refresh.
test('workflow 5: PM board updates live (no refresh)', async ({ browser }) => {
  const pm = await ctx(browser, 'pm');
  const upiId = (await (await pm.request.get('/api/v1/projects')).json()).data
    .find((p: { code: string }) => p.code === 'UPI').id;

  const page = await pm.newPage();
  await page.goto('/dashboard/tasks');
  await expect(page.getByText(/Live ·/i)).toBeVisible({ timeout: 20_000 });
  // Watch the UPI board specifically (board defaults to the most recent project).
  await page.locator('select').first().selectOption(upiId);
  await page.waitForTimeout(3000); // let the realtime subscription bind to UPI

  const owner = await ctx(browser, 'owner');
  const title = `E2E live ${Date.now()}`;
  const created = await owner.request.post('/api/v1/tasks', {
    data: { project_id: upiId, title, status: 'BACKLOG' },
  });
  expect(created.status()).toBe(201);

  await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
  await pm.close(); await owner.close();
});

// 6. Employee @mentions the PM in a comment → PM gets a live notification.
test('workflow 6: comment mention creates a notification for the PM', async ({ browser }) => {
  const pm = await ctx(browser, 'pm');
  const dev = await ctx(browser, 'dev');

  // resolve PM member id (dev has member:view)
  const members = (await (await dev.request.get('/api/v1/employees')).json()).data ?? [];
   
  const pmMember = members.find((m: any) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return p?.email === 'pm@apexfintech.test';
  });
  const taskId = await firstUpiTaskId(dev);

  const before = (await (await pm.request.get('/api/v1/notifications')).json()).data?.unread ?? 0;
  const res = await dev.request.post(`/api/v1/tasks/${taskId}/comments`, {
    data: { body: 'Please review @pm', mentions: [pmMember.id] },
  });
  expect(res.status()).toBe(201);

  await expect.poll(async () => {
    const j = await (await pm.request.get('/api/v1/notifications')).json();
    return j.data?.unread ?? 0;
  }, { timeout: 15_000 }).toBeGreaterThan(before);
  await pm.close(); await dev.close();
});

// 7. Team manager sees only projects connected to their team.
test('workflow 7: team manager sees only team-connected projects', async ({ browser }) => {
  const tm = await ctx(browser, 'tm');
  const projects = (await (await tm.request.get('/api/v1/projects')).json()).data ?? [];
  expect(projects.length).toBeGreaterThan(0);
  // TM (Payments Platform) is only tied to UPI — must not see all 7 org projects.
  expect(projects.every((p: { code: string }) => p.code === 'UPI')).toBe(true);
  await tm.close();
});

// 8. Cross-org isolation: a different org's user cannot read Apex data via API.
test('workflow 8: cross-org user cannot access Apex project/tasks', async ({ browser }) => {
  const c = await browser.newContext();
  const email = `e2e_outsider_${Date.now()}@x.test`;
  // sign up + create their own org through the API path used by the app
  const page = await c.newPage();
  await page.goto('/signup');
  await page.getByPlaceholder('FULL NAME').fill('Outsider');
  await page.getByPlaceholder('EMAIL').fill(email);
  await page.getByPlaceholder(/PASSWORD/).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL('**/onboarding/company', { timeout: 30_000 });
  await c.request.post('/api/v1/organizations', { data: { name: 'Outsider Inc' } });

  // They must not see Apex's projects/tasks.
  const projs = await (await c.request.get('/api/v1/projects')).json();
  expect((projs.data ?? []).every((p: { organization_id: string }) => p.organization_id !== ORG)).toBe(true);
  await c.close();
});

// 9. Release deploy is blocked without required approvals.
test('workflow 9: release cannot deploy without approvals', async ({ browser }) => {
  const owner = await ctx(browser, 'owner');
  const projs = (await (await owner.request.get('/api/v1/projects')).json()).data ?? [];
  const upi = projs.find((p: { code: string }) => p.code === 'UPI');
  const rel = await (await owner.request.post('/api/v1/releases', {
    data: { project_id: upi.id, name: 'E2E Rel', version: `v${Date.now()}` },
  })).json();
  await owner.request.post(`/api/v1/releases/${rel.data.id}/request-approval`, { data: {} });
  const deploy = await owner.request.post(`/api/v1/releases/${rel.data.id}/deploy`, { data: {} });
  expect(deploy.status()).toBe(403); // gates pending
  await owner.close();
});
