// Visual-regression guard for WE-docs (#1966, epic #2232) — the rendered-look sibling of the a11y
// sweep (tests/a11y/), the smoke gate (tests/smoke/), and the content spec (tests/content/).
//
// WHY: `npm run check:standards` never renders a page, so a CSS/template change that visually breaks a
// surface ships green. That is exactly how #1895 stripped the shared `.section-card`/`.standard-card` frame
// off /backlog/NNN/ and ~14 other pages undetected. This guard captures committed full-page baselines for a
// small, visually-stable, representative page set and fails on a pixel diff.
// Run it BEFORE and AFTER any UI-touching change.
//
// #2236 — FROZEN-FIXTURE TARGET. This spec targets a DEDICATED, isolated Eleventy build+serve
// (playwright.config.ts webServer, its own port off the dev band) that renders with `WE_VISUAL_FIXTURES=1`
// set — which makes the `backlog` global (we:src/_data/backlog.js) source the small, checked-in,
// hand-frozen fixture set at ./fixtures/backlog/*.md instead of the LIVE backlog/ directory. The live
// backlog churns on nearly every commit (a new item filed, an unrelated item resolved, a title reworded),
// none of which is a real LOOK change — pointing at frozen content means a baseline only ever moves on a
// genuine style/layout regression. Pages that don't read the backlog collection at all (home, the
// capability-adapter detail page) render byte-identical whether served live or via the fixture build, so
// they're listed here too — the fixture server is just one isolated, deterministic place to render EVERY
// visual target from, fully decoupled from the developer's own running dev server (never booted/touched by
// this spec). The live docs build (`npm run build:docs`, `npm run dev`) is completely untouched.
//
// The page set + masks live in ./pages.json (curated, editable — its header comment documents how to add
// a new fixture-backed target). Baselines: ./rendered-site-visual.spec.ts-snapshots/ — refresh
// DELIBERATELY with `npm run check:visual:update` after an intended look change.
//
// Threshold note: `maxDiffPixelRatio` is generous (1%) on purpose — this guard targets STRUCTURAL/style
// regressions (a vanished card frame is a huge diff), not pixel-perfect parity, so minor antialiasing/text
// reflow under a percent of the page won't false-fail. Tighten per-page later if a surface warrants it.
// (`animations: 'disabled'` + `maxDiffPixelRatio` are pinned config-side — playwright.config.ts `expect`
// — so every `toHaveScreenshot()` call here inherits them without repeating the literals.)
//
// Determinism hardening (#2237): a screenshot must be a pure function of the styles under test, not of
// WHEN or WHERE it was captured.
//  - Fonts: `--font-sans`/`--font-mono` resolve to system-font stacks only (FUI `webtheme` defaultTheme,
//    no `@font-face`/webfont) — so there is no FOUT/fallback-metric-shift risk to harden against today.
//    `document.fonts.ready` is still awaited below as a cheap, correct-regardless guard in case a future
//    theme value introduces a webfont.
//  - Time & randomness: `Date`/`Math.random` are frozen (see `freezeClock` below) so a page that renders
//    a live date/id would be stable across runs instead of failing sporadically.
//  - Dynamic regions: `mask:` (from pages.json, per-page) stays the escape hatch for anything
//    intentionally variable (build id, live counts) — none of the current 3 pages render one.

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Fixed epoch so any page that happens to render `Date`/`Math.random` output is byte-stable across
// runs/machines. `Date` uses Playwright's own Clock API (`page.clock.setFixedTime`, #2237 review —
// prefer the library's tested fake-time implementation over a hand-rolled `Date` subclass); `Math.random`
// has no Playwright equivalent, so a small seeded LCG is installed via `addInitScript` so it's in place
// before the page's own scripts run (a `page.evaluate` after `goto` would be too late for anything the
// page renders on load). Both must run BEFORE `page.goto` to affect the page's initial render.
const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z');

async function freezeClock(page: Page) {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
  });
}

// Playwright runs from the repo root (testDir './'), so resolve the curated page set from cwd — avoids
// import.meta/__dirname module-context differences across Playwright's TS transform.
const config = JSON.parse(readFileSync(join(process.cwd(), 'tests/visual/pages.json'), 'utf8')) as {
  pages: { name: string; path: string; mask?: string[] }[];
};

// The dedicated frozen-fixture docs server (playwright.config.ts webServer, WE_VISUAL_FIXTURES=1) — its
// own port, env-configurable via WE_VISUAL_FIXTURE_PORT (mirrors WE_ELEVENTY_PORT/WE_INTERACTION_PORT so a
// lane clone never collides with another lane's or main's fixture server). Default matches the config.
test.use({ baseURL: `http://localhost:${process.env.WE_VISUAL_FIXTURE_PORT ?? '8099'}` });

for (const { name, path, mask = [] } of config.pages) {
  test(`WE-docs visual · ${name} (${path})`, async ({ page }) => {
    await freezeClock(page);

    const resp = await page.goto(path, { waitUntil: 'networkidle' });
    expect(resp, `no response for ${path}`).toBeTruthy();
    expect(resp!.status(), `HTTP status for ${path}`).toBeLessThan(400);

    // Let SSR custom elements upgrade + fonts settle so the first capture isn't mid-render.
    await page.waitForLoadState('networkidle');
    // Belt-and-braces font-metric guard (#2237) — see the file-header note on why this is a no-op today
    // (system-font stacks only) but cheap/correct to keep regardless.
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      // Volatile regions (dates, live counts, "currently-doing" status) painted over so data churn
      // doesn't fail the baseline — only a real look change does. Selectors come from pages.json.
      mask: mask.map((sel) => page.locator(sel)),
    });
  });
}
