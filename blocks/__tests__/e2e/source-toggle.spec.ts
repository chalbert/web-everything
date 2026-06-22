/**
 * E2E for the HTML ↔ JSX source toggle on a block page (source-toggle.njk `autoToggle`).
 *
 * Covers two coverage-plan items at once on the real built /blocks/for-each/ page (served via the
 * Vite→11ty proxy at :3000):
 *   - #7  the JSX pane is GENERATED at build time — it contains the lowered `<template is="for-each">`
 *         (the comment-directive HTML the author wrote collapses into the customized built-in),
 *   - #11 the toggle UX works — clicking the JSX tab reveals the JSX pane and hides the HTML pane.
 *
 * Needs the dev server (Vite :3000 + 11ty :8080); the for-each page is an 11ty doc proxied to :8080.
 */
import { test, expect } from '@playwright/test';

const ID = 'for-each-usage';

// #1572 — deliberately skipped in the live dev-server e2e lane: the JSX pane is GENERATED at build time
// (the `htmlToJsx` lowering of the authored comment-directive HTML), so it is ABSENT on the watched dev
// server — `/blocks/for-each/` never fires the `load` event there (goto times out) and the
// `template is="for-each"` assertion has no artifact to match. This is a post-`npm run build` e2e check, not
// a dev-server one; re-home it to a build-then-test lane (it runs green against a built `_site`). Tracked by
// the re-enabled-lane triage (#1572).
test.describe.skip('Source toggle — /blocks/for-each/', () => {
  test('JSX pane is build-generated and the tab toggles panes', async ({ page }) => {
    await page.goto('/blocks/for-each/');

    const htmlPane = page.locator(`.mode-content[data-mode-content="${ID}"][data-mode="html"]`);
    const jsxPane = page.locator(`.mode-content[data-mode-content="${ID}"][data-mode="jsx"]`);

    // #7 — the panes were generated from one authored HTML: the HTML pane shows the comment-directive
    // form, the JSX pane shows the lowered customized built-in (build-time htmlToJsx output).
    await expect(htmlPane).toContainText('control:for-each');
    await expect(jsxPane).toContainText('template is="for-each"');

    // HTML is the default visible pane.
    await expect(htmlPane).toBeVisible();
    await expect(jsxPane).toBeHidden();

    // #11 — clicking the JSX tab swaps visibility.
    await page.locator('.mode-tab[data-mode="jsx"]').first().click();
    await expect(jsxPane).toBeVisible();
    await expect(htmlPane).toBeHidden();
  });
});
