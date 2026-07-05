// Interaction regression lane for the /backlog/ "Tracked work" (Items) tab — the per-section filter tool in
// home-display.js. This is the LARGEST filter surface on the page (status · kind · size · tier chips + search
// + grid/list density, all persisted per-section in localStorage) and previously had NO interaction coverage;
// every other spec only asserts static rendered content and never drives the chips after the FUI upgrade.
//
// Deterministic, like backlog-priority-filters.spec.ts: a fixed fixture (fixtures/backlog-items.html) loads the
// REAL home-display.js plus a MOCK <we-filter-chip> reproducing FUI's self-replace-to-<button> upgrade, on the
// private WE_INTERACTION_PORT — never the user's :3000/:8080. Semantics under test (home-display.js):
//   • Resolved is hidden by default (the status facet's defaultExclude).
//   • Plain click while a group is FULLY active = "solo" (show only this); once a subset is in effect, clicks
//     toggle individual chips. A size subset also excludes unsized cards; a card with no tier passes the tier facet.
//   • Search matches title + description; the grid/list toggle sets `.home-list-view`; all state persists.

import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-items.html';

/** Visible (not .is-filtered-out) card numbers, in DOM order. */
async function visibleCardNums(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.project-card')]
      .filter((c) => !c.classList.contains('is-filtered-out'))
      .map((c) => (c.querySelector('.project-title')?.textContent ?? '').trim().split(/\s+/)[0].replace('#', '')),
  );
}

const countBadge = (page: Page) =>
  page.locator('[data-count-target]').innerText().then((t) => t.trim());

/** Computed background colour of a chip — the SELECTED TINT under test (#2279). The fixture loads the
 *  real src/css/style.css, so this reads the shipped look, not a stub. */
const chipBg = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);

// Wait until the mock chips have upgraded to <button> — the regression surface (delegated handlers only).
async function waitForChipUpgrade(page: Page) {
  await expect(page.locator('button[data-status-chip="open"]')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await waitForChipUpgrade(page);
});

test('resolved items are hidden by default; the resolved chip reads unpressed', async ({ page }) => {
  expect(await visibleCardNums(page)).toEqual(['201', '202', '203', '205', '206', '207']);
  expect(await visibleCardNums(page)).not.toContain('204');
  expect(await countBadge(page)).toBe('6');
  // open/active default-on, resolved default-off.
  await expect(page.locator('button[data-status-chip="open"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button[data-status-chip="resolved"]')).toHaveAttribute('aria-pressed', 'false');
});

test('clicking the Resolved status chip reveals the resolved card', async ({ page }) => {
  // Status starts as the subset {open, active} (resolved excluded), so this is a toggle-in, not a solo.
  await page.click('button[data-status-chip="resolved"]');
  expect(await visibleCardNums(page)).toContain('204');
  expect(await countBadge(page)).toBe('7');
  await expect(page.locator('button[data-status-chip="resolved"]')).toHaveAttribute('aria-pressed', 'true');
});

test('a plain kind click SOLOS that kind (every group starts fully active)', async ({ page }) => {
  await page.click('button[data-kind-chip="epic"]');
  expect(await visibleCardNums(page)).toEqual(['205']);          // only the epic
  await expect(page.locator('button[data-kind-chip="epic"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button[data-kind-chip="story"]')).toHaveAttribute('aria-pressed', 'false');
});

test('a size subset excludes unsized cards and AND-composes with status', async ({ page }) => {
  await page.click('button[data-size-chip="3"]');                // solo to 3 pts
  // Size-3 AND not-resolved: #201 and #207. Unsized (task/epic/decision) and the size-5 story drop out.
  expect(await visibleCardNums(page)).toEqual(['201', '207']);
});

test('a plain tier click SOLOS that tier (cards without a tier are unaffected here)', async ({ page }) => {
  await page.click('button[data-tier-chip="A"]');
  expect(await visibleCardNums(page)).toEqual(['201', '202', '203']);   // the three Tier-A cards
});

test('search filters by title/description and clearing restores the default set', async ({ page }) => {
  await page.fill('.home-filter', 'epsilon');
  expect(await visibleCardNums(page)).toEqual(['205']);
  await page.fill('.home-filter', '');
  expect(await visibleCardNums(page)).toEqual(['201', '202', '203', '205', '206', '207']);
});

test('the grid/list density toggle flips the section view and persists it', async ({ page }) => {
  const section = page.locator('section');
  await expect(section).not.toHaveClass(/home-list-view/);

  await page.click('.view-toggle-btn[data-view="list"]');
  await expect(section).toHaveClass(/home-list-view/);
  await expect(page.locator('.view-toggle-btn[data-view="list"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.view-toggle-btn[data-view="grid"]')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('we-home-view:Tracked work'))).toBe('list');
});

test('filters persist across a reload (per-section localStorage)', async ({ page }) => {
  await page.click('button[data-kind-chip="epic"]');             // solo epic
  expect(await visibleCardNums(page)).toEqual(['205']);

  await page.reload({ waitUntil: 'networkidle' });
  await waitForChipUpgrade(page);

  // The persisted kind subset re-applies: still only the epic, chip still pressed.
  expect(await visibleCardNums(page)).toEqual(['205']);
  await expect(page.locator('button[data-kind-chip="epic"]')).toHaveAttribute('aria-pressed', 'true');
});

// ── #2279: the SELECTED TINT must track real pressed state, not the SSR `selected` attribute ──
// The dropped-active-state bug: the CSS lit the accent tint on `we-filter-chip[selected]`, but that
// attribute is hard-coded on every default-on chip and never removed — the JS drives real state via the
// `fui-filter-chip--selected` CLASS + aria-pressed. So every chip stayed lit and pressed/unpressed looked
// identical. These specs load the REAL style.css (via the fixture) and assert the RENDERED background — the
// gap that let a pure-CSS regression ship past a suite that only ever checked the class/aria attributes.

test('at load, a pressed chip carries the accent tint and an unpressed one does not (#2279)', async ({ page }) => {
  const openBg = await chipBg(page, 'button[data-status-chip="open"]');        // default-on
  const resolvedBg = await chipBg(page, 'button[data-status-chip="resolved"]'); // default-off
  // Pre-fix these were byte-identical (both lit by the stuck `selected` attribute).
  expect(openBg).not.toBe(resolvedBg);
  await expect(page.locator('button[data-status-chip="open"]')).toHaveClass(/fui-filter-chip--selected/);
  await expect(page.locator('button[data-status-chip="resolved"]')).not.toHaveClass(/fui-filter-chip--selected/);
});

test('toggling a chip OFF strips its tint even though the SSR `selected` attribute survives (#2279 core)', async ({ page }) => {
  // This is the definitive guard: soloing Epic turns Story OFF. The JS removes Story's `--selected` class
  // (and aria-pressed) but NEVER its hard-coded `selected` attribute — so a CSS rule keyed on `[selected]`
  // (the bug) would keep Story lit identically to the pressed Epic. Keyed on the class (the fix), Story goes
  // neutral and its background diverges from Epic's. Robust regardless of the SSR markup.
  await page.click('button[data-kind-chip="epic"]');

  const epicBg = await chipBg(page, 'button[data-kind-chip="epic"]');
  const storyBg = await chipBg(page, 'button[data-kind-chip="story"]');
  expect(epicBg).not.toBe(storyBg);

  // Story is logically off but still carries the inert SSR attribute — proving the tint no longer reads it.
  await expect(page.locator('button[data-kind-chip="story"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('button[data-kind-chip="story"]')).not.toHaveClass(/fui-filter-chip--selected/);
  await expect(page.locator('button[data-kind-chip="story"]')).toHaveAttribute('selected', '');
  await expect(page.locator('button[data-kind-chip="epic"]')).toHaveClass(/fui-filter-chip--selected/);
});
