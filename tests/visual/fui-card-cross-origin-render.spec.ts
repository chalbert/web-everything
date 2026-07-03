// #2000 — per-lane cross-origin visual render check (the render layer above the token-css unit floor).
//
// WHY: `npm run check:standards` never paints, and the token-css unit test guards only the emitted CSS
// STRING. This guards the rendered PIXEL: the WE home dogfoods FUI's `.fui-card` surface (#2019) and
// derives its `--token-*` values from FUI's webtheme source cross-repo at build time (#96). FUI defines
// the card tokens DARK (#2050); if the WE light theme (`src/_data/weSiteTheme.js`) misses an override,
// the tiles paint near-black — the regression that shipped to `main` in batch-2026-07-01, one lane away
// from the FUI-token lane that caused it. This is the emergent multi-item visual interaction only a
// render can see.
//
// Two directions, both against the REAL `.fui-card` element + its REAL CSS rule:
//   1. assert-light   — the live home tile is an opaque light surface (the fixed/known-good state).
//   2. negative fixture — inject FUI's dark-default card tokens (the exact leaked bytes) as `:root`
//      vars so `background: var(--color-surface-card)` resolves dark, and prove the classifier FIRES.
//
// The CLI harness `scripts/dev/render-check.mjs` is the landing-gate form (boots its own server); this
// spec reuses the already-running docs server (playwright.config.ts REUSES, never kills it) on :8080,
// like the a11y/smoke/visual-snapshot lanes. Shares the classifier with the harness + the unit test.
//
// This spec covers the BUILD-TIME coupled-pair fixture (a WE-own home tile whose token VALUES are derived
// from FUI cross-repo at build). The RUNTIME cross-origin iframe path — a `.fui-card` painted INSIDE a
// live cross-origin FUI demo frame (#1895 proper, #2081) — is exercised by the harness's `--fui-iframe`
// mode (`node scripts/dev/render-check.mjs --fui-iframe [--simulate-regression]`), which boots a WE+FUI
// pair on env-driven lane ports (#2142) and asserts the same classifier over the cross-origin frame's
// shadow-rooted card. It stays a CLI-harness check (not a spec) because it boots a FUI vite server, which
// this "reuse a running server, never boot" suite intentionally does not do.

import { test, expect } from '@playwright/test';
import { classifyCardSurface, FUI_DARK_CARD } from '../../scripts/lib/render-check.mjs';

// :8080 is the real docs origin (the SSR home with inline token CSS + passthrough /css), not Vite's :3000.
// #2167: env-ize the port off WE_ELEVENTY_PORT (as vite.config.mts reads, #1997) so a lane hits its OWN
// 11ty server, not main's :8080. Default unchanged.
test.use({ baseURL: `http://localhost:${process.env.WE_ELEVENTY_PORT ?? '8080'}` });

const SELECTOR = '.fui-card';

test.describe('WE home .fui-card cross-origin render (#2000)', () => {
  test('dogfooded tiles render a LIGHT surface (no FUI dark-token leak)', async ({ page }) => {
    const resp = await page.goto('/', { waitUntil: 'load' });
    expect(resp?.status(), 'home HTTP status').toBeLessThan(400);

    const card = page.locator(SELECTOR).first();
    await expect(card, `expected a ${SELECTOR} tile on the home grid`).toBeAttached();

    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    const verdict = classifyCardSurface(bg);
    expect(verdict.ok, `${SELECTOR} regression: ${verdict.reason} (${verdict.color})`).toBe(true);
  });

  test('the classifier FIRES when FUI dark card tokens leak in (negative fixture)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator(SELECTOR).first()).toBeAttached();

    // Reproduce the known-bad state through the real card rule: inject FUI's dark defaults as :root vars.
    await page.addStyleTag({
      content: `:root{${Object.entries(FUI_DARK_CARD)
        .flatMap(([k, v]) => [`--token-color-${k}:${v}`, `--color-${k}:${v}`])
        .join(';')}}`,
    });

    const bg = await page.locator(SELECTOR).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const verdict = classifyCardSurface(bg);
    expect(verdict.ok, `classifier should flag the injected dark surface (${verdict.color})`).toBe(false);
    expect(verdict.reason).toMatch(/dark surface/);
  });
});
