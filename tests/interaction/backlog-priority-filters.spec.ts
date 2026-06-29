// Interaction regression lane for the /backlog/ Prioritisation table (backlog-table-sort.js).
//
// WHY THIS EXISTS — two shipped regressions slipped past the existing suite because every other spec hits
// the LIVE dev server with live data and only asserts STATIC rendered content (rendered-backlog-content
// .spec.ts, itself describe.skip'd). Neither drives the filter UI after the FUI <we-filter-chip> upgrade,
// which is exactly where both bugs lived:
//   1. The summary count pills (data-pfilter) stopped filtering — they upgrade to <button>, dropping the
//      direct click listeners; the fix delegates on document.
//   2. An over-narrow filter (a persisted search term, a chip combo) silently emptied the table with no
//      message and no escape; the fix adds a self-recovering empty-state row.
//
// This lane is deterministic: a fixed fixture page (tests/interaction/fixtures/backlog-priority.html) loads
// the REAL backlog-table-sort.js plus a MOCK <we-filter-chip> that reproduces FUI's self-replace-to-<button>
// upgrade, served on its own port (WE_INTERACTION_PORT, default 3137) — never the user's :3000/:8080.

import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-priority.html';

/** Visible (not display:none) data rows — excludes the injected empty-state row. */
async function visibleRowNums(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('tbody tr[data-readiness]')]
      .filter((tr) => getComputedStyle(tr as HTMLElement).display !== 'none')
      .map((tr) => (tr.getAttribute('data-search') ?? '').trim().split(/\s+/)[0]),
  );
}

const shownCount = (page: Page) =>
  page.locator('[data-ptable-count]').innerText().then((t) => Number(t.trim()));

// Wait until the mock chips have upgraded to <button> — the regression surface. After this, the original
// custom elements are gone and only delegated handlers can still drive the filters.
async function waitForChipUpgrade(page: Page) {
  await expect(page.locator('button[data-pfilter="batchable"]')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await waitForChipUpgrade(page);
});

test('all rows show by default once the chips have upgraded', async ({ page }) => {
  expect(await visibleRowNums(page)).toHaveLength(8);
  expect(await shownCount(page)).toBe(8);
});

test('summary pills still filter after the <we-filter-chip> upgrade (regression #1)', async ({ page }) => {
  // Clicking the "batchable" count pill narrows to exactly the batchable rows. Pre-fix this did nothing
  // because the pill's direct listener died on upgrade.
  await page.click('button[data-pfilter="batchable"]');
  expect(await visibleRowNums(page)).toEqual(['101', '102', '103']);
  expect(await shownCount(page)).toBe(3);

  // A different pill switches the view (shortcuts are mutually exclusive).
  await page.click('button[data-pfilter="notready"]');
  expect(await visibleRowNums(page)).toEqual(['108']);

  // Clicking the active shortcut again clears it — back to all rows.
  await page.click('button[data-pfilter="notready"]');
  expect(await visibleRowNums(page)).toHaveLength(8);
});

test('an over-narrow filter shows a recoverable empty-state, not a silent blank (regression #2)', async ({ page }) => {
  await page.fill('[data-ptable-search]', 'zzzz-no-such-row');
  // Search debounce is synchronous (input → apply), but assert via the count to be robust.
  await expect(page.locator('[data-ptable-count]')).toHaveText('0');

  const empty = page.locator('tbody tr.ptable-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText(/no rows match/i);

  // The empty-state's reset recovers every row and clears the search box.
  await empty.getByRole('button', { name: /clear filters/i }).click();
  expect(await visibleRowNums(page)).toHaveLength(8);
  await expect(page.locator('[data-ptable-search]')).toHaveValue('');
});

test('a persisted filter is restored on reload but stays recoverable (the real "nothing shows" report)', async ({ page }) => {
  // Simulate a stale persisted search the user forgot about, then reload.
  await page.evaluate(() => localStorage.setItem('we-backlog-priority-search', 'zzzz-no-such-row'));
  await page.reload({ waitUntil: 'networkidle' });
  await waitForChipUpgrade(page);

  await expect(page.locator('[data-ptable-count]')).toHaveText('0');
  await expect(page.locator('tbody tr.ptable-empty')).toBeVisible();

  await page.getByRole('button', { name: /clear filters/i }).click();
  expect(await visibleRowNums(page)).toHaveLength(8);
  // The reset wipes the persisted value so it doesn't re-break the next load.
  expect(await page.evaluate(() => localStorage.getItem('we-backlog-priority-search'))).toBe('');
});

test('the splittable toggle composes with readiness as an AND facet', async ({ page }) => {
  await page.click('button[data-psplit]');
  // Only the one story flagged data-splittable="true".
  expect(await visibleRowNums(page)).toEqual(['104']);
});

test('clicking a column header re-sorts the rows in place', async ({ page }) => {
  // Sort by "Gates" descending (numeric first-click = desc). #105 (gates 8) should lead.
  await page.click('th[data-sort-key="gates"]');
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('tbody tr[data-readiness]')].map((tr) =>
      (tr.getAttribute('data-search') ?? '').trim().split(/\s+/)[0],
    ),
  );
  expect(order[0]).toBe('105');
});
