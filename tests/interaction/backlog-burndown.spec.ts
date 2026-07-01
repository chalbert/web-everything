// Interaction regression lane for the /backlog/ Burndown CHART (backlog-burndown.js). The tab-switcher half
// of this script is covered by backlog-tabs.spec.ts; this locks the OTHER half — the SVG chart render for a
// given #burndown-data payload and the granularity toggle (daily/weekly/monthly, persisted in localStorage).
// Behaviour, not pixels: we assert the historical lines + projection lines are drawn, the per-point remaining
// dots carry their <title>, and switching granularity re-renders with a different dated-tick count — all
// against the REAL shipped script over a fixed deterministic model.
//
// Fixture (tests/interaction/fixtures/backlog-burndown.html): three grain series with distinct lengths
// (daily 6 pts, weekly 4, monthly 3) + a 4-point daily projection past `today`, diverging:false (so the net
// projection line is also drawn).

import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-burndown.html';

/** Count of dated x-axis ticks the chart drew (one rotated <text> per visible bucket). */
async function tickCount(page: Page): Promise<number> {
  return page.locator('#bd-chart text[transform^="rotate"]').count();
}

// Each test runs in a fresh Playwright context (empty localStorage), so the grain default (weekly) is clean
// without an explicit clear — and the persistence test relies on localStorage surviving a same-context reload.
// The granularity buttons live inside the burndown tabpanel, which is hidden until the tab is opened, so tests
// that CLICK a grain button open the burndown tab first (the chart itself renders regardless of visibility).

test('renders the historical + projection lines for the default (weekly) payload', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // scope / done / remaining historical paths + the frozen and (diverging:false) net projection paths.
  // All are <path fill="none"> lines; there should be at least the 3 historical + 2 projection = 5.
  const paths = await page.locator('#bd-chart path[fill="none"]').count();
  expect(paths).toBeGreaterThanOrEqual(5);

  // The scope line is the sky-blue series; assert it specifically so an empty/failed render is caught.
  await expect(page.locator('#bd-chart path[stroke="#0ea5e9"]')).toHaveCount(1);
  // A "today" marker is always drawn.
  await expect(page.locator('#bd-chart text', { hasText: 'today' })).toHaveCount(1);
});

test('each historical remaining dot carries a hover title with its numbers', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // The remaining markers (r="3") each embed a <title> like "2026-06-15: 40 remaining (scope 110, done 70)".
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('#bd-chart circle title')].map((t) => t.textContent || ''),
  );
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.some((t) => /\d+ remaining \(scope \d+, done \d+\)/.test(t))).toBe(true);
});

test('the granularity toggle re-renders the chart at a different scale', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.click('#tab-burndown');   // reveal the grain buttons (they live in the burndown tabpanel)
  // Default is weekly (4 buckets). Daily has more buckets (6 hist + projection) → strictly more ticks; this
  // proves the toggle actually re-rendered against a different series rather than no-opping.
  const weeklyTicks = await tickCount(page);
  await expect(page.locator('[data-bd-gran="weekly"]')).toHaveClass(/is-active/);

  await page.click('[data-bd-gran="daily"]');
  await expect(page.locator('[data-bd-gran="daily"]')).toHaveClass(/is-active/);
  const dailyTicks = await tickCount(page);
  expect(dailyTicks).toBeGreaterThan(weeklyTicks);

  // Monthly (3 buckets) is the coarsest → fewer ticks than daily. Confirms all three grains render.
  await page.click('[data-bd-gran="monthly"]');
  await expect(page.locator('[data-bd-gran="monthly"]')).toHaveClass(/is-active/);
  const monthlyTicks = await tickCount(page);
  expect(monthlyTicks).toBeLessThan(dailyTicks);
});

test('the chosen granularity persists across a reload (localStorage)', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await page.click('#tab-burndown');   // reveal the grain buttons
  await page.click('[data-bd-gran="daily"]');
  await expect(page.locator('[data-bd-gran="daily"]')).toHaveClass(/is-active/);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // The saved grain should re-drive the render, not fall back to the weekly default. (setGran runs on load
  // regardless of tab visibility, so the persisted grain is re-applied even before the burndown tab is opened.)
  await expect(page.locator('[data-bd-gran="daily"]')).toHaveClass(/is-active/);
});
