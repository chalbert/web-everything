// Interim visual-regression guard for WE-docs (#1966, epic #800) — the rendered-look sibling of the a11y
// sweep (tests/a11y/), the smoke gate (tests/smoke/), and the content spec (tests/content/).
//
// WHY: `npm run check:standards` never renders a page, so a CSS/template change that visually breaks a
// surface ships green. That is exactly how #1895 stripped the shared `.section-card`/`.standard-card` frame
// off /backlog/NNN/ and ~14 other pages undetected. This guard captures committed full-page baselines for a
// small, visually-stable, representative page set and fails on a pixel diff — the #799-resolved option-C
// in-repo bootstrap (a hosted visual service stays deferred). Run it BEFORE and AFTER any UI-touching change.
//
// Reuses the already-running dev server (playwright.config.ts `webServer` REUSES, never kills it) on :8080 —
// the real WE-docs origin, like the a11y/smoke specs (Vite :3000 serves the demo shell). The page set + masks
// live in ./pages.json (curated, editable). Baselines: ./rendered-site-visual.spec.ts-snapshots/ — refresh
// DELIBERATELY with `npm run check:visual:update` after an intended look change.
//
// Threshold note: `maxDiffPixelRatio` is generous (1%) on purpose — this guard targets STRUCTURAL/style
// regressions (a vanished card frame is a huge diff), not pixel-perfect parity, so minor antialiasing/text
// reflow under a percent of the page won't false-fail. Tighten per-page later if a surface warrants it.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Playwright runs from the repo root (testDir './'), so resolve the curated page set from cwd — avoids
// import.meta/__dirname module-context differences across Playwright's TS transform.
const config = JSON.parse(readFileSync(join(process.cwd(), 'tests/visual/pages.json'), 'utf8')) as {
  pages: { name: string; path: string; mask?: string[] }[];
};

// :8080 is the real docs origin (the a11y/smoke/content lanes pin the same), not Vite's :3000 demo shell.
// #2167: env-ize the port off WE_ELEVENTY_PORT (as vite.config.mts reads, #1997) so a lane renders +
// regenerates its OWN baselines against its OWN 11ty server, not main's :8080. Default unchanged.
test.use({ baseURL: `http://localhost:${process.env.WE_ELEVENTY_PORT ?? '8080'}` });

for (const { name, path, mask = [] } of config.pages) {
  test(`WE-docs visual · ${name} (${path})`, async ({ page }) => {
    const resp = await page.goto(path, { waitUntil: 'networkidle' });
    expect(resp, `no response for ${path}`).toBeTruthy();
    expect(resp!.status(), `HTTP status for ${path}`).toBeLessThan(400);

    // Let SSR custom elements upgrade + fonts settle so the first capture isn't mid-render.
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: 'disabled',
      // Volatile regions (dates, live counts, "currently-doing" status) painted over so data churn
      // doesn't fail the baseline — only a real look change does. Selectors come from pages.json.
      mask: mask.map((sel) => page.locator(sel)),
      maxDiffPixelRatio: 0.01,
    });
  });
}
