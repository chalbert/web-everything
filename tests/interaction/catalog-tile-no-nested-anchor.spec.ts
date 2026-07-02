// Catalog-tile structural-integrity guard — the regression test for the "empty ghost cards / nested cards"
// class the rendered-site smoke lane can NOT catch (it is deliberately structure-agnostic: element-count > 15,
// so a page that duplicates half its tiles into empty ghosts still passes).
//
// THE BUG (found via Playwright screenshot, invisible in curl/view-source): catalog tiles wrapped the whole
// card in a navigation <a>, but the card body carries authored inline <a> links (in the description). An <a>
// may not contain another <a> — the browser's adoption-agency parser "repairs" the nesting by splitting the
// tile and re-opening an EMPTY clone of the wrapping .project-card after every inner link. Source had 47 tiles;
// the rendered DOM had 71, ~24 of them empty ghosts. curl/innerText/console all looked clean — only the parsed
// DOM (and the screenshot) showed it. Fix: an overlay .project-card-link anchor (position:absolute; inset:0)
// instead of a wrapping <a>, so no anchor nesting (component-render-build-hook.cjs renderProjectGrid/IntentGrid
// + the hand-rolled njk catalog grids).
//
// Reuses the running dev server on :8080 (the real WE-docs origin), like the smoke/a11y specs.

import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:8080' });

// The catalog surfaces whose tiles carry linked descriptions (home grids, intents, adapters).
const CATALOG_PAGES = ['/', '/intents/', '/adapters/'];

for (const path of CATALOG_PAGES) {
  test(`catalog tiles have no nested anchors or empty ghost clones · ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const r = await page.evaluate(() => ({
      // An <a> inside another <a> is the invalid nesting that clones empty tiles. Zero, site-wide.
      nestedAnchors: document.querySelectorAll('a a').length,
      // A ghost clone is a childless .project-card (the re-opened empty anchor/box after the split).
      emptyCards: [...document.querySelectorAll('.project-card')].filter((c) => c.children.length === 0).length,
      cards: document.querySelectorAll('.project-card').length,
    }));

    expect(r.cards, `${path} should render catalog tiles`).toBeGreaterThan(0);
    expect(
      r.nestedAnchors,
      `${path}: found <a> nested in <a> — the browser clones empty ghost .project-card tiles from this`,
    ).toBe(0);
    expect(r.emptyCards, `${path}: found empty ghost .project-card tiles`).toBe(0);
  });
}
