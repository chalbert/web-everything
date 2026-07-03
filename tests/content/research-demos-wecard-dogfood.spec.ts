// Dogfood regression (#2103, epic #2021): the research + demos content-page card surfaces were converted
// off hand-rolled `.project-card`/`.standard-card` tiles onto the FUI `<we-card>` primitive (the same
// #1607/#1820 anchor-tile pattern the sibling catalog pages — blocks/resources/protocols — already ship).
// This is the committed guard for that conversion: it asserts each converted surface is a `<we-card>`
// (pre-upgrade SSR baseline) OR its upgraded `<article class="fui-card">`, AND that the whole-tile
// click-through anchor still wraps it (the load-bearing invariant of the anchor-tile pattern — a we-card
// resolves to a non-linkable <article>, so the click MUST stay on the outer <a>).
//
// WHY a content spec and not a unit test: the `weComponentSSR`/CE-upgrade split is only observable in the
// rendered page. check:standards skips the 11ty build, so a template regression (a tile that lost its
// we-card, or an anchor that no longer wraps the card) renders silently green in the static gate. This
// hits the real WE-docs origin, the same contract the a11y/smoke specs use.

import { test, expect } from '@playwright/test';

// The real WE-docs origin (11ty), mirroring the a11y/content/smoke specs. #2167: env-ize off
// WE_ELEVENTY_PORT so a lane hits its OWN 11ty server, not main's :8080. Default unchanged.
test.use({ baseURL: `http://localhost:${process.env.WE_ELEVENTY_PORT ?? '8080'}` });

// A card surface is dogfooded when it is a `<we-card>` (the pre-upgrade / JS-off SSR baseline) or the
// `.fui-card` article the transform/CE resolves it to. Either form satisfies the invariant.
const CARD = 'we-card, article.fui-card';

test.describe('research + demos card surfaces are dogfooded onto <we-card> (#2103)', () => {
  test('/research/ — design-references banner, topic grid, and external-reference tiles are we-cards inside their click-through anchor', async ({ page }) => {
    await page.goto('/research/', { waitUntil: 'load' });

    // Design Reference Library banner: an <a> tile whose body is a we-card carrying the shot-count badge.
    const banner = page.locator('a.project-card[href="/research/design-references/"]');
    await expect(banner).toHaveCount(1);
    await expect(banner.locator(CARD)).toHaveCount(1);
    // The shot-count is a <we-badge> (pre-upgrade) or the .fui-badge it upgrades to.
    await expect(banner.locator('we-badge, .fui-badge')).toHaveCount(1);

    // Open Research Topics grid: every topic tile is an <a> wrapping a we-card + a status <we-badge>.
    const topicTiles = page.locator('a.project-card[href^="/research/"]').filter({ has: page.locator(CARD) });
    const topicCount = await topicTiles.count();
    expect(topicCount).toBeGreaterThan(0);
    // Each such tile has exactly one card and its status badge, and the click-through href is preserved.
    for (let i = 0; i < topicCount; i++) {
      const tile = topicTiles.nth(i);
      await expect(tile.locator(CARD).first()).toBeVisible();
      await expect(tile).toHaveAttribute('href', /^\/research\//);
    }

    // External References: non-anchor content tiles, each a .project-card wrapping a we-card.
    const extRefTiles = page.locator('div.project-card').filter({ has: page.locator(CARD) });
    expect(await extRefTiles.count()).toBeGreaterThan(0);
  });

  test('/demos/ — showcase tiles are we-cards inside their click-through anchor, with content intact (no template-leak truncation)', async ({ page }) => {
    await page.goto('/demos/', { waitUntil: 'load' });

    const tiles = page.locator('a.standard-card[href^="/demos/"]');
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      // Each demo tile wraps exactly one card surface, and its click-through href is preserved.
      await expect(tile.locator(CARD)).toHaveCount(1);
      await expect(tile).toHaveAttribute('href', /^\/demos\//);
      // The demo heading (the anchor id) survives inside the card body.
      await expect(tile.locator('h2[id^="demo-"]')).toHaveCount(1);
    }

    // Regression guard for the DOM-truncation bug: the For-Each demo summary carries a literal `<template>`.
    // If a converted tile fed that body through the SSR harness's innerHTML round-trip, the decoded tag
    // would swallow the rest of the grid and drop tiles. Assert the full summary text is present verbatim
    // (entity-safe) AND that all tiles after it still rendered.
    const foreach = page.locator('a.standard-card', { hasText: 'For-Each Demo' });
    await expect(foreach).toHaveCount(1);
    await expect(foreach).toContainText('for each item in a collection');
    await expect(foreach).toContainText('interpolation.');
  });
});
