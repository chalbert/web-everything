// Interaction regression lane for the /backlog/ tab switcher (backlog-burndown.js). Covers the whole-page
// navigation the filters live inside — clicking a tab swaps the visible panel, moves aria-selected + the
// roving tabindex (APG tablist), mirrors the active tab to the URL hash, and restores it on load from
// hash → localStorage → default. Deterministic fixture (fixtures/backlog-tabs.html) on the private
// WE_INTERACTION_PORT; the chart half of the script no-ops without #burndown-data, so only the tab logic runs.

import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-tabs.html';

/** The single panel that is currently visible (not [hidden]). */
async function visiblePanel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const shown = [...document.querySelectorAll('[role="tabpanel"]')].filter((p) => !(p as HTMLElement).hidden);
    return shown.length === 1 ? shown[0].id : `EXPECTED 1, got ${shown.length}: ${shown.map((p) => p.id).join()}`;
  });
}

test('defaults to the Tracked panel with Tracked selected', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  expect(await visiblePanel(page)).toBe('panel-tracked');
  await expect(page.locator('#tab-tracked')).toHaveAttribute('aria-selected', 'true');
});

test('clicking a tab swaps exactly one panel and mirrors the hash', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.click('#tab-priority');

  expect(await visiblePanel(page)).toBe('panel-priority');
  await expect(page.locator('#tab-priority')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tab-tracked')).toHaveAttribute('aria-selected', 'false');
  expect(await page.evaluate(() => location.hash)).toBe('#priority');

  // A second tab switches cleanly (no two panels visible at once).
  await page.click('#tab-burndown');
  expect(await visiblePanel(page)).toBe('panel-burndown');
});

test('the URL hash selects the initial tab (shareable/bookmarkable link)', async ({ page }) => {
  await page.goto(FIXTURE + '#humansetup', { waitUntil: 'networkidle' });
  expect(await visiblePanel(page)).toBe('panel-humansetup');
  await expect(page.locator('#tab-humansetup')).toHaveAttribute('aria-selected', 'true');
});

test('the last-opened tab is restored from localStorage when no hash is present', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.click('#tab-graph');
  // Re-open the bare URL (no hash): the localStorage fallback should reselect Graph.
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  expect(await visiblePanel(page)).toBe('panel-graph');
});

test('arrow keys move between tabs (APG tablist keyboard nav)', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.locator('#tab-tracked').focus();
  await page.keyboard.press('ArrowRight');            // tracked → active
  expect(await visiblePanel(page)).toBe('panel-active');
  await expect(page.locator('#tab-active')).toHaveAttribute('aria-selected', 'true');
});

test('a manual hash change re-drives the active tab (the hashchange listener)', async ({ page }) => {
  // Tab clicks use replaceState (deliberately kept out of the back button), so this covers the OTHER entry
  // point: editing the hash directly / following an in-page #anchor fires hashchange → the tab follows.
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.evaluate(() => { location.hash = '#priority'; });
  await expect(page.locator('#tab-priority')).toHaveAttribute('aria-selected', 'true');
  expect(await visiblePanel(page)).toBe('panel-priority');
});
