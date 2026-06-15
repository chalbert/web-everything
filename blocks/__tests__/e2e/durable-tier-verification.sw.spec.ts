/* A′ durable-tier verification (#708, ratified from #675) — the real `reloadDurabilityAdapter` as the
 * unit under test in a live browser.
 *
 * Runs under the `chromium-sw` Playwright project (serviceWorkers: 'allow'). The project's baseURL is the
 * #684 static origin, so this spec uses ABSOLUTE :3000 URLs — the A′ ruling: the spec targets the Vite
 * origin (which serves the real TS adapter), and the SW *project* (not the static origin) is the reusable
 * lane. Proves register → hard-reload → rehydrate survives against the real adapter, and the real
 * forced-unavailable fallback re-arm. The true Background-Fetch network transfer surviving reload is the
 * documented manual residual (not asserted). */
import { test, expect, type Page } from '@playwright/test';

const DEMO = 'http://localhost:3000/demos/durable-tier-verification/index.html';

async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __durable?: { ready: boolean } }).__durable?.ready === true);
}

test.describe('durable-tier verification — real reloadDurabilityAdapter (#708)', () => {
  test('registerDurableTransfer → hard-reload → rehydrateDurableTasks survives', async ({ page }) => {
    await page.goto(DEMO);
    await waitReady(page);

    // Background Fetch IS present on the real prototype in Chromium → the real feature-detect is true.
    expect(await page.evaluate(() => window.__durable.bgFetchSupported)).toBe(true);

    // Start clean, then register a durable transfer through the REAL adapter (only the bgFetch manager
    // is doubled, SW-backed).
    await page.evaluate(() => window.__durable.clear());
    const result = await page.evaluate(() =>
      window.__durable.registerTransfer({
        id: 'task-export',
        label: 'export 4.2GB',
        requests: ['/demos/durable-tier-verification/index.html'],
        downloadTotal: 4_200_000,
      }),
    );
    expect(result).toMatchObject({ durable: true, fetchId: 'task-export' });

    // Hard reload — the worker (and its durable transfer) outlives the page.
    await page.reload();
    await waitReady(page);

    // The real rehydrateDurableTasks recovers the transfer from the worker on load.
    const tasks = await page.evaluate(() => window.__durable.rehydrate());
    expect(tasks.map((t) => t.id)).toContain('task-export');
    // downloadTotal > 0 → the adapter maps it to a determinate progress entry.
    expect(tasks.find((t) => t.id === 'task-export')?.progress).toBe('determinate');
  });

  test('forced-unavailable → adapter degrades and the element re-arms the navigation guard', async ({ browser }) => {
    // Force the durable tier unavailable by removing Background Fetch from the real prototype BEFORE any
    // page script runs — the real `isBackgroundFetchAvailable()` then returns false against the real
    // (now-stripped) prototype. This is a genuine forced-unavailable, not a flag the adapter reads.
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.addInitScript(() => {
      try {
        // @ts-expect-error — deleting an optional prototype member to simulate an engine without it.
        delete ServiceWorkerRegistration.prototype.backgroundFetch;
      } catch {
        /* some engines define it non-configurable; the demo still degrades via the manager double */
      }
    });
    const page = await context.newPage();
    await page.goto(DEMO);
    await waitReady(page);

    // Real feature-detect now reports unavailable.
    expect(await page.evaluate(() => window.__durable.bgFetchSupported)).toBe(false);

    // registerDurableTransfer degrades gracefully (never throws) — route-only fallback.
    const result = await page.evaluate(() =>
      window.__durable.registerTransfer({ id: 'task-fallback', label: 'queued upload', requests: ['/x'] }),
    );
    expect(result).toMatchObject({ durable: false, fallbackReason: 'unsupported' });

    // An active route-only task makes the element re-arm: durability=reload + bgFetch unavailable →
    // data-durability-fallback (the #134 observable for "degraded + guard re-armed").
    await page.evaluate(() => window.__durable.armRouteOnlyTask({ id: 'task-fallback', label: 'queued upload' }));
    expect(await page.evaluate(() => window.__durable.fallbackActive())).toBe(true);
    await expect(page.locator('#surface')).toHaveAttribute('data-durability-fallback', '');

    await context.close();
  });
});
