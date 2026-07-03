// Rendered-site a11y gate for WE-docs (#770, ratified #763 Fork 1/2/3 = A/A/A).
//
// Runs @axe-core/playwright (the embeddable WCAG engine) over each gated route, filtered to WCAG 2.0/2.1
// A + AA tags — the rendered-DOM coverage (contrast, focus order, accessible names, computed current-state)
// that check:standards structurally cannot give (it skips the 11ty build and runs no browser —
// scripts/check-standards.mjs). Reuses the already-running dev server via playwright.config.ts `webServer`
// + baseURL :3000 (Vite proxying catalog routes → 11ty :8080); no new runner or server.
//
// Route set is AUTO-DERIVED from /sitemap.xml (#847, per #774 Fork-1=C/Fork-2=A): scope-C = every index
// surface + one representative detail page per path-prefix group. The hand-maintained allowlist (#770) is
// gone — a new published surface is gated without a hand-edit.
//
// Posture: warn → enforce ratchet (#763 Fork 2 = A). A route is build-blocking only when it is in
// ENFORCED_ROUTES or A11Y_ENFORCE=1 flips the whole lane; otherwise violations are reported
// (console.warn + a step annotation) and the test passes — advisory until the route is promoted.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gatedRoutes, ENFORCED_ROUTES, WCAG_TAGS } from './sitemap-routes';

// Hit the WE-docs origin directly (11ty :8080), not the Vite dev server (:3000) whose root serves the demo
// launcher shell rather than the docs home. The catalog routes proxy identically either way; pinning :8080
// keeps `/` the real docs home (#763: "WE-docs URLs (:8080 here, proxied via :3000)").
// #2167: env-ize the port off WE_ELEVENTY_PORT (as vite.config.mts reads, #1997) so a lane hits its OWN
// 11ty server, not main's :8080. Default unchanged.
test.use({ baseURL: `http://localhost:${process.env.WE_ELEVENTY_PORT ?? '8080'}` });

const ENFORCE_ALL = process.env.A11Y_ENFORCE === '1';

for (const path of gatedRoutes()) {
  const enforce = ENFORCE_ALL || ENFORCED_ROUTES.has(path);
  const route = { path };

  test(`WE-docs a11y · ${route.path} ${enforce ? '(enforced)' : '(warn-only)'}`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });

    const { violations } = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();

    if (violations.length === 0) return;

    const summary = violations
      .map((v) => `  [${v.impact ?? 'n/a'}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.helpUrl}`)
      .join('\n');
    const message = `axe found ${violations.length} WCAG A/AA violation(s) on ${route.path}:\n${summary}`;

    await testInfo.attach(`axe-violations-${route.path.replace(/\W+/g, '_')}.json`, {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    });

    if (enforce) {
      expect(violations, message).toEqual([]);
    } else {
      // Warn-only rung of the ratchet: surface the violations without failing the build.
      console.warn(`⚠ [a11y warn-only] ${message}`);
      testInfo.annotations.push({ type: 'a11y-warn', description: message });
    }
  });
}
