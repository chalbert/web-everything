/* Reusable reload-survival helper for the real-browser durable-tier lane (#684).
 *
 * Drives any page that implements the `window.__durable` contract (see the fixture
 * `public/index.html`): register a service worker → arm an in-flight task → hard-reload
 * → assert the worker re-hydrated it. #675 and any future durable-tier page assert
 * reload-survival in one call via `assertSurvivesHardReload`. */
import type { Page } from '@playwright/test';

export interface DurableTask {
  id: string;
  label?: string;
}

/** Resolves once the page's durable surface has registered its SW and re-hydrated. */
export async function waitForDurableReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __durable?: { ready?: boolean } }).__durable?.ready === true);
}

/** Hand an in-flight task to the worker (the "arm transfer"). */
export async function armTask(page: Page, task: DurableTask): Promise<void> {
  await page.evaluate((t) => (window as unknown as { __durable: { arm(t: DurableTask): Promise<void> } }).__durable.arm(t), task);
}

/** The tasks the page re-hydrated from the worker on its last load. */
export async function rehydratedTasks(page: Page): Promise<DurableTask[]> {
  return page.evaluate(() => (window as unknown as { __durable: { rehydrated(): DurableTask[] } }).__durable.rehydrated());
}

/**
 * The one-call assertion: ready → arm → hard reload → ready → re-hydrated.
 * Returns true iff the armed task survived the reload (proven via the worker).
 */
export async function assertSurvivesHardReload(page: Page, task: DurableTask): Promise<boolean> {
  await waitForDurableReady(page);
  await armTask(page, task);
  await page.reload(); // hard reload — the page is torn down; the worker is not
  await waitForDurableReady(page);
  const tasks = await rehydratedTasks(page);
  return tasks.some((t) => t.id === task.id);
}
