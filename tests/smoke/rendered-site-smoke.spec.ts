// Rendered-site health/smoke gate for WE-docs — the "does this page actually work" sibling of the a11y
// sweep (tests/a11y/rendered-site-a11y.spec.ts) and the deterministic interaction lane (tests/interaction/).
//
// WHY: the a11y sweep checks WCAG over the rendered DOM; the (skipped) content spec checks the backlog
// projection. Neither catches the broad "the page is broken" class — an uncaught exception, a custom
// element whose module never loaded (so it never upgrades and renders nothing), a 4xx/5xx route, or a page
// that rendered no primary content. That's exactly the failure behind a "nothing shows" report. This sweeps
// the SAME auto-derived scope-C route set (every index surface + one representative detail page per
// path-prefix group, from /sitemap.xml — no hand-maintained list) and asserts each page is healthy.
//
// Reuses the already-running dev server via playwright.config.ts `webServer` + :8080 (the real WE-docs
// origin, like the a11y spec). Hard failures are unambiguous breakage; console.error is warn-only (a
// warn→enforce ratchet, mirroring the a11y lane) so third-party/advisory noise doesn't block the build.

import { test, expect } from '@playwright/test';
import { gatedRoutes } from '../a11y/sitemap-routes';

// Same origin pin as the a11y/content specs — :8080 is the real docs home (Vite :3000 serves the demo shell).
test.use({ baseURL: 'http://localhost:8080' });

// Flip to hard-fail on console.error too (default: warn-only, like A11Y_ENFORCE).
const ENFORCE_CONSOLE = process.env.SMOKE_ENFORCE_CONSOLE === '1';

for (const path of gatedRoutes()) {
  test(`WE-docs smoke · ${path}`, async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    // Uncaught exceptions — unambiguous JS breakage (the class that silently kills an interactive surface).
    page.on('pageerror', (e) => pageErrors.push(`${e.name}: ${e.message}`));
    // Only count document/script/stylesheet failures — a broken image or optional beacon isn't page health.
    page.on('requestfailed', (r) => {
      const type = r.resourceType();
      if (type === 'document' || type === 'script' || type === 'stylesheet') {
        failedRequests.push(`[${type}] ${r.url()} — ${(r.failure()?.errorText) ?? 'failed'}`);
      }
    });

    const resp = await page.goto(path, { waitUntil: 'networkidle' });

    // 1. The route itself resolved (no 4xx/5xx).
    expect(resp, `no response for ${path}`).toBeTruthy();
    expect(resp!.status(), `HTTP status for ${path}`).toBeLessThan(400);

    // 2. No uncaught JS exceptions — these silently break interactive surfaces (the "nothing shows" class).
    expect(pageErrors, `uncaught page errors on ${path}`).toEqual([]);

    // 3. No failed document/script/stylesheet requests (e.g. a custom-element module that never loaded).
    expect(failedRequests, `failed critical requests on ${path}`).toEqual([]);

    // 4. The page actually rendered a DOM — not an empty shell from a template/data wiring break. Deliberately
    //    structure-agnostic: WE is native-first, so many pages render via SSR custom elements (e.g. /plugs/'s
    //    <we-card>s) with no <main>/<h1> and no client upgrade — requiring a landmark or counting :not(:defined)
    //    would false-positive on healthy pages. A real page has dozens of element nodes; a broken shell has a
    //    handful, so an element-count floor catches the empty-body failure without coupling to page structure.
    const bodyElementCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(bodyElementCount, `rendered DOM element count on ${path}`).toBeGreaterThan(15);

    // 5. Console errors — advisory by default (warn + annotation), promotable to hard-fail via SMOKE_ENFORCE_CONSOLE=1.
    if (consoleErrors.length) {
      const summary = `console.error on ${path}:\n  ${consoleErrors.join('\n  ')}`;
      if (ENFORCE_CONSOLE) {
        expect(consoleErrors, summary).toEqual([]);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[smoke warn] ${summary}`);
        await testInfo.attach('console-errors', { body: summary, contentType: 'text/plain' });
      }
    }
  });
}
