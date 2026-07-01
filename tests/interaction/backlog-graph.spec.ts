// Interaction regression lane for the /backlog/ Graph tab (backlog-graph.js, #255/#257). The tab/filter
// surfaces are already covered elsewhere; this locks the DYNAMIC render: the SVG dependency graph that
// backlog-graph.js lays out from the build-time model in #backlog-graph-data, plus the live↔all filter
// toggle that re-filters + re-lays-out in place. Behaviour, not pixels: we assert which items become nodes
// (one <a.bg-node> per rendered item), that the filter changes the visible set, and that the batchable /
// human-gate rings render — all against the REAL shipped script over a fixed deterministic model.
//
// Fixture model (tests/interaction/fixtures/backlog-graph.html): chain 100→101→102 (all live: 2 open + 1
// active), resolved edge-participant 200 (in "all" only), standalone open 300 (in "live" grid only). 101 is
// batchable (green ring), 300 has a humanGate (dashed held ring). So live = {100,101,102,300} (4),
// all = {100,101,102,200} (4, the edge network incl. resolved history).

import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-graph.html';

/** The item numbers currently rendered as graph nodes (one <a.bg-node> per item), sorted. */
async function nodeNums(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('#backlog-graph a.bg-node title')]
      .map((t) => (t.textContent || '').match(/^#(\d+)/)?.[1] ?? '')
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b)),
  );
}

// Each test runs in a fresh Playwright context (empty localStorage), so the filter default is clean without
// an explicit clear — and the persistence test below relies on localStorage surviving a same-context reload.

test('defaults to the live view — every open/active item is a node, resolved history is dropped', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // 100,101,102 (chain) + 300 (standalone open). 200 is resolved → excluded from live.
  expect(await nodeNums(page)).toEqual(['100', '101', '102', '300']);
  await expect(page.locator('#bg-count')).toHaveText('4 items');
});

test('switching to "All" re-lays-out to the dependency network (incl. resolved history), dropping edge-free items', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.click('[data-bg-filter="all"]');
  // "All" = the edge participants: 100,101,102 + resolved 200. Standalone 300 (inEdge:false) drops out.
  expect(await nodeNums(page)).toEqual(['100', '101', '102', '200']);
  await expect(page.locator('#bg-count')).toHaveText('4 items');
  await expect(page.locator('[data-bg-filter="all"]')).toHaveClass(/is-active/);

  // And back to live re-lays-out in place (the toggle is not one-way).
  await page.click('[data-bg-filter="live"]');
  expect(await nodeNums(page)).toEqual(['100', '101', '102', '300']);
});

test('edges are drawn between the live nodes (prerequisite → dependent)', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // The two live edges 100→101 and 101→102 render as <line marker-end> arrows (200→100 dropped — 200 not live).
  const edgeLines = await page.locator('#backlog-graph line[marker-end]').count();
  expect(edgeLines).toBe(2);
});

test('the batchable ring and the human-gate hold ring render on the right nodes', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // 101 is batchable → a solid green outer ring inside its node link.
  const batchRing = await page.evaluate(() => {
    const link = [...document.querySelectorAll('#backlog-graph a.bg-node')].find(
      (a) => (a.querySelector('title')?.textContent || '').startsWith('#101'),
    );
    return link ? [...link.querySelectorAll('circle')].some((c) => c.getAttribute('stroke') === '#16a34a' && c.getAttribute('fill') === 'none') : false;
  });
  expect(batchRing).toBe(true);

  // 300 has a humanGate → a dashed held ring (stroke-dasharray).
  const heldRing = await page.evaluate(() => {
    const link = [...document.querySelectorAll('#backlog-graph a.bg-node')].find(
      (a) => (a.querySelector('title')?.textContent || '').startsWith('#300'),
    );
    return link ? [...link.querySelectorAll('circle')].some((c) => c.getAttribute('stroke-dasharray')) : false;
  });
  expect(heldRing).toBe(true);
});

test('the filter choice persists across a reload (localStorage)', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.click('[data-bg-filter="all"]');
  expect(await nodeNums(page)).toEqual(['100', '101', '102', '200']);
  // Re-open: the saved "all" mode should re-drive the render (not fall back to the live default).
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  expect(await nodeNums(page)).toEqual(['100', '101', '102', '200']);
  await expect(page.locator('[data-bg-filter="all"]')).toHaveClass(/is-active/);
});
