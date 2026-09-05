import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * Career AI ('my-learning' intent, Phase 5): a real, streamed, Gemini-backed
 * answer grounded in the trainee's own data — not the old setTimeout +
 * hardcoded-string fake. This is the highest-risk regression for this phase:
 * migration 0083 must have actually granted TRAINEE ai:use + career:view, or
 * every message here 403s before a token ever streams.
 */
test('career AI: a trainee sends a message and gets a real streamed answer, not the old canned response', async ({ browser }) => {
  const traineeCtx = await ctx(browser, 'trainee');
  const page = await traineeCtx.newPage();
  await page.goto('/dashboard/career-ai');

  // message-0 is the static greeting rendered on mount.
  await expect(page.getByTestId('chat-message-0')).toBeVisible();

  await page.getByPlaceholder('Ask about careers, skills, jobs, or training...').fill('What should I focus on to improve my job readiness?');
  await page.getByRole('button', { name: 'Send message' }).click();

  // message-1 is the user's own message, echoed immediately.
  await expect(page.getByTestId('chat-message-1')).toContainText('What should I focus on');

  // message-2 only exists once the stream has finished and been committed
  // into the message list (the in-progress bubble while streaming is a
  // separate, untestid'd element) — waiting for it to appear IS waiting for
  // the real model call to complete. Generous timeout accordingly.
  const reply = page.getByTestId('chat-message-2');
  await expect(reply).toBeVisible({ timeout: 30_000 });

  const replyText = await reply.innerText();
  expect(replyText.length).toBeGreaterThan(0);
  // The old fake implementation's canned responses are gone for good.
  expect(replyText).not.toContain('Cooperative Field Officer** — 91% match');

  await traineeCtx.close();
});
