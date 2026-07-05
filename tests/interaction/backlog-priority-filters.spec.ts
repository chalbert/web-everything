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

/** Computed background colour of a chip — the SELECTED TINT under test (#2279). The fixture loads the real
 *  src/css/style.css, so this reads the shipped look, not a stub. */
const chipBg = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);

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

test('the "Hide low priority" toggle hides low-prio rows and swaps EVERY affected count independently', async ({ page }) => {
  // Two low-priority rows in DIFFERENT buckets: #107 (decision) and #104 (agent-ready). Default: both show,
  // and every dual-value count reads its FULL variant.
  expect(await visibleRowNums(page)).toEqual(expect.arrayContaining(['104', '107']));
  await expect(page.locator('h1 [data-pcount-full]')).toHaveText('8');
  await expect(page.locator('button[data-pfilter="decision"] [data-pcount-full]')).toHaveText('1');
  await expect(page.locator('button[data-pfilter="agentready"] [data-pcount-full]')).toHaveText('1');

  await page.click('button[data-pfiller]');

  // Both rows hidden; the section badge AND each pill drop to their own no-filler variant (per-bucket exact).
  expect(await visibleRowNums(page)).not.toContain('104');
  expect(await visibleRowNums(page)).not.toContain('107');
  expect(await shownCount(page)).toBe(6);
  await expect(page.locator('h1 [data-pcount-full]')).toHaveText('6');
  await expect(page.locator('button[data-pfilter="decision"] [data-pcount-full]')).toHaveText('0');
  await expect(page.locator('button[data-pfilter="agentready"] [data-pcount-full]')).toHaveText('0');

  // Toggling back off restores every row and count.
  await page.click('button[data-pfiller]');
  expect(await shownCount(page)).toBe(8);
  await expect(page.locator('h1 [data-pcount-full]')).toHaveText('8');
  await expect(page.locator('button[data-pfilter="decision"] [data-pcount-full]')).toHaveText('1');
});

test('the "Hide low priority" toggle survives a reload (localStorage persistence)', async ({ page }) => {
  await page.click('button[data-pfiller]');
  expect(await shownCount(page)).toBe(6);

  await page.reload({ waitUntil: 'networkidle' });
  await waitForChipUpgrade(page);

  // The toggle comes back pressed, the low-prio rows stay hidden, and the counts stay swapped.
  await expect(page.locator('button[data-pfiller]')).toHaveAttribute('aria-pressed', 'true');
  expect(await visibleRowNums(page)).not.toContain('107');
  expect(await shownCount(page)).toBe(6);
  await expect(page.locator('h1 [data-pcount-full]')).toHaveText('6');
});

test('the "Hide low priority" toggle STAYS ON when a summary shortcut is clicked (regression: sticky view-level filter)', async ({ page }) => {
  // Turn low-priority off, then switch to the Decision view via its summary pill. The toggle is a
  // view-level control, so it must persist — the low-priority decision must NOT reappear.
  await page.click('button[data-pfiller]');
  expect(await visibleRowNums(page)).not.toContain('107');

  await page.click('button[data-pfilter="decision"]');

  // The bug: the shortcut used to force the toggle back off, un-hiding the low-priority item.
  await expect(page.locator('button[data-pfiller]')).toHaveAttribute('aria-pressed', 'true');
  expect(await visibleRowNums(page)).not.toContain('107');

  // Same for a readiness chip click — filler stays on and #107 stays hidden.
  await page.click('button[data-pready="decision"]');
  await expect(page.locator('button[data-pfiller]')).toHaveAttribute('aria-pressed', 'true');
  expect(await visibleRowNums(page)).not.toContain('107');
});

test('the empty-state "Clear filters" DOES release the sticky low-priority toggle', async ({ page }) => {
  // A full clear is the one path that resets the view-level toggle — the empty-state means everything is
  // hidden, so recovery must restore low-priority work too.
  await page.click('button[data-pfiller]');
  await page.fill('[data-ptable-search]', 'zzzz-no-such-row');   // force the empty-state
  await page.getByRole('button', { name: /clear filters/i }).click();

  await expect(page.locator('button[data-pfiller]')).toHaveAttribute('aria-pressed', 'false');
  expect(await visibleRowNums(page)).toContain('107');
  expect(await visibleRowNums(page)).toHaveLength(8);
});

test('the splittable toggle composes with readiness as an AND facet', async ({ page }) => {
  await page.click('button[data-psplit]');
  // Only the one story flagged data-splittable="true".
  expect(await visibleRowNums(page)).toEqual(['104']);
});

test('the splittable and hide-low-priority toggles AND-compose (both constraints apply)', async ({ page }) => {
  // #104 is the only splittable row and is ALSO low-priority. Splittable ON isolates it; turning on
  // hide-low-priority then removes it too — the two orthogonal toggles intersect, not override.
  await page.click('button[data-psplit]');
  expect(await visibleRowNums(page)).toEqual(['104']);

  await page.click('button[data-pfiller]');
  expect(await visibleRowNums(page)).toHaveLength(0);          // splittable ∧ not-low-priority = ∅
  await expect(page.locator('button[data-psplit]')).toHaveAttribute('aria-pressed', 'true');   // split stays on
  await expect(page.locator('button[data-pfiller]')).toHaveAttribute('aria-pressed', 'true');  // filler stays on
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

// ── #2279: the readiness chips' SELECTED TINT must track real pressed state, not the SSR attribute ──
// Same root cause as the Tracked-work chips: the tint keyed on `we-filter-chip[selected]`, hard-coded on
// every default-on chip and never removed, so an OFF chip stayed lit identically to an ON one. The fixture
// now loads the real style.css; this asserts the RENDERED background diverges once a chip toggles off.
test('toggling a readiness chip OFF strips its tint though the SSR `selected` attribute survives (#2279)', async ({ page }) => {
  // All readiness chips start pressed (default-on). Turn "batchable" off; "agentready" stays on.
  await page.click('button[data-pready="batchable"]');

  const offBg = await chipBg(page, 'button[data-pready="batchable"]');
  const onBg = await chipBg(page, 'button[data-pready="agentready"]');
  // Pre-fix these were identical — both lit by the stuck `selected` attribute regardless of aria-pressed.
  expect(offBg).not.toBe(onBg);

  const off = page.locator('button[data-pready="batchable"]');
  await expect(off).toHaveAttribute('aria-pressed', 'false');
  await expect(off).not.toHaveClass(/fui-filter-chip--selected/);
  await expect(off).toHaveAttribute('selected', '');   // the inert SSR attribute the tint must NOT read
  await expect(page.locator('button[data-pready="agentready"]')).toHaveClass(/fui-filter-chip--selected/);
});
