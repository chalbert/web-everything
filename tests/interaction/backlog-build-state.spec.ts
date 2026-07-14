// Interaction regression for the per-item BUILD-STATE badge on the /backlog/ tracker (#2474 → #2472) — the
// first "backlog-driven console" increment. src/_data/backlog.js `deriveBuildState` joins the batch skill's
// local loop-state files (claims.json / queued.json) onto each item; the `buildStateBadge` macro
// (src/_includes/backlog-badges.njk) renders it on BOTH the tile (backlog.njk) and the detail
// (backlog-pages.njk). The badge is PURELY ADDITIVE: it draws ONLY for the two states that come from those
// files (`claimed` / `queued`); resolved + the plain statuses defer to statusBadge, so with the local files
// absent nothing new renders. This asserts the rendered contract the macro emits — behaviour, not pixels.

import { test, expect } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-build-state.html';

test('a CLAIMED item renders a build-state badge carrying its owning session', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const badge = page.locator('[data-testid="card-claimed"] [data-build-state="claimed"]');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('claimed');
  await expect(badge).toContainText('batch-2026-07-14-a'); // the session is surfaced
});

test('a QUEUED (ready-to-merge) item renders a queued build-state badge', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const badge = page.locator('[data-testid="card-queued"] [data-build-state="queued"]');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('queued');
});

test('a RESOLVED item shows its status badge but NO build-state badge (resolved defers to status)', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const card = page.locator('[data-testid="card-resolved"]');
  await expect(card).toContainText('Resolved');
  await expect(card.locator('[data-build-state]')).toHaveCount(0);
});

test('an item with NO local loop-state falls back cleanly to its status — no build-state badge', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const card = page.locator('[data-testid="card-plain"]');
  await expect(card).toContainText('Open');
  await expect(card.locator('[data-build-state]')).toHaveCount(0);
});

test('the badge is purely additive — it draws ONLY for the two file-derived states (claimed + queued)', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // Four cards, but only the claimed + queued ones carry a build-state badge; resolved/open draw nothing.
  await expect(page.locator('[data-build-state]')).toHaveCount(2);
});
