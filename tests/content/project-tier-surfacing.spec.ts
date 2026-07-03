// Portfolio-tier surfacing regression (#2088 Fork 4 / #2133): the ratified in-place tier surfacing renders
// a `we-tag` tier cue (importance axis) side by side with the `we-badge` status pill (maturity axis) on every
// project card + detail page, the landing grids GROUP core → contextual → exploratory, and the landing
// heading is reworded off "Core Standards" so "core" is unambiguous tier vocabulary. This is the committed
// guard for that surfacing.
//
// WHY a content spec and not a unit test: the grid SSR render (weProjectGrid → pinned FUI CLI) and the
// per-page tier tag (weComponentSSR transform) are only observable in the rendered page. check:standards
// skips the 11ty build, so a template/loader regression (a lost tier tag, a mis-grouped grid, the heading
// reverting to "Core Standards") renders silently green in the static gate. This hits the real WE-docs
// origin, the same contract the a11y/smoke/dogfood specs use. The tier vocabulary itself is unit-pinned in
// scripts/lib/__tests__/component-render-build-hook.test.mjs; this asserts the RENDERED surface.

import { test, expect } from '@playwright/test';

// The real WE-docs origin (11ty), mirroring the a11y/content/smoke specs. #2167: env-ize off
// WE_ELEVENTY_PORT so a lane hits its OWN 11ty server, not main's :8080. Default unchanged.
test.use({ baseURL: `http://localhost:${process.env.WE_ELEVENTY_PORT ?? '8080'}` });

// A tier cue is a categorical `we-tag` (pre-upgrade SSR baseline) or the `.fui-tag` it upgrades to, keyed
// to the `project-tier` set. Either form satisfies the invariant.
const TIER_CUE = (tier: string) =>
  `we-tag[set="project-tier"][value="${tier}"], .fui-tag[data-cat-set="project-tier"][data-cat-value="${tier}"]`;

const TIER_ORDER = ['core', 'contextual', 'exploratory'];
const tierRank = (t: string | null) => {
  const i = t ? TIER_ORDER.indexOf(t) : -1;
  return i === -1 ? TIER_ORDER.length : i;
};

test.describe('portfolio tier surfacing (#2088 Fork 4 / #2133)', () => {
  test('landing page — heading reworded off "Core Standards", tier cues render, grids group core→contextual→exploratory', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    // The category heading no longer reads "Core Standards" (which collided with the new tier word "core").
    await expect(page.locator('h2.section-title', { hasText: /^Core Standards$/ })).toHaveCount(0);
    await expect(page.locator('h2.section-title', { hasText: /^Standards$/ })).toHaveCount(1);

    // At least one project tile carries a tier cue for each tier value (data is stamped across all 45).
    for (const tier of TIER_ORDER) {
      expect(await page.locator(TIER_CUE(tier)).count()).toBeGreaterThan(0);
    }

    // Each landing section groups its stamped tiles core → contextual → exploratory (the SSR default). Read
    // the data-tier facet in DOM order per section and assert it is non-decreasing by tier rank.
    const sections = page.locator('section', { has: page.locator('.project-card[data-tier]') });
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThan(0);
    for (let s = 0; s < sectionCount; s++) {
      const tiers = await sections.nth(s).locator('.project-card[data-tier]').evaluateAll(
        (cards) => cards.map((c) => c.getAttribute('data-tier')),
      );
      const ranks = tiers.map(tierRank);
      const sorted = [...ranks].sort((a, b) => a - b);
      expect(ranks).toEqual(sorted); // non-decreasing → grouped in tier order
    }
  });

  test('project detail page — the tier cue renders next to the status pill (orthogonal axes side by side)', async ({ page }) => {
    // webcomponents is a stamped `core` project (src/_data/projects/webcomponents.json).
    await page.goto('/projects/webcomponents/', { waitUntil: 'load' });

    // The status pill (maturity) is still present in the detail header.
    await expect(page.locator('.project-detail-status .status-lifecycle-link')).toHaveCount(1);
    // The tier cue (importance) renders beside it as a project-tier we-tag / .fui-tag.
    const tierCue = page.locator('.project-detail-tier').locator(TIER_CUE('core'));
    await expect(tierCue).toHaveCount(1);
    await expect(tierCue).toBeVisible();
    await expect(tierCue).toContainText(/core/i);
  });
});
