/* Real-browser durable-tier rehydration lane (#684) — the harness #675 depends on.
 *
 * Runs under the `chromium-sw` Playwright project (serviceWorkers: 'allow', baseURL =
 * the static fixture server). Proves the register → arm → hard-reload → rehydrate cycle
 * green in a real Chromium, plus the Background-Fetch-absent fallback re-arm. The true
 * Background-Fetch network transfer surviving reload is the documented manual residual
 * (see the fixture + docs/agent/testing.md). */
import { test, expect } from '@playwright/test';
import {
  assertSurvivesHardReload,
  waitForDurableReady,
  rehydratedTasks,
} from './sw-fixtures/rehydrate-helper';

test.describe('durable-tier service-worker rehydration (#684 harness)', () => {
  test('register → arm → hard-reload → rehydrate survives', async ({ page }) => {
    await page.goto('/');
    const survived = await assertSurvivesHardReload(page, { id: 'task-export', label: 'export 4.2GB' });
    expect(survived).toBe(true);
  });

  test('Background-Fetch-absent fallback re-arms on reload', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    // Force the degraded path: the page's feature-detect reads this flag and skips
    // Background Fetch, exercising the navigation-guard re-arm the #134 fallback ships.
    await context.addInitScript(() => {
      (window as unknown as { __forceNoBgFetch: boolean }).__forceNoBgFetch = true;
    });
    const page = await context.newPage();
    await page.goto('/');
    await waitForDurableReady(page);

    const bgFetch = await page.evaluate(
      () => (window as unknown as { __durable: { bgFetchSupported: boolean } }).__durable.bgFetchSupported,
    );
    expect(bgFetch).toBe(false);

    const survived = await assertSurvivesHardReload(page, { id: 'task-fallback', label: 'queued upload' });
    expect(survived).toBe(true);

    const tasks = await rehydratedTasks(page);
    expect(tasks.find((t) => t.id === 'task-fallback')?.bgFetch).toBe(false);

    await context.close();
  });
});
