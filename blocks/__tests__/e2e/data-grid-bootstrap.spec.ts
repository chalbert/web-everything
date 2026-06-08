/**
 * E2E: prove `grid:cell-navigation` auto-upgrades an authored grid via the bootstrap registry.
 *
 * Backlog #144. Every other place that exercises the Data Grid behavior — the unit test and the
 * conformance playground's live card — ATTACHES it by hand (`new DataGridBehavior(); attach();
 * connectedCallback()`). Nothing proved that a plain authored `<table role="grid" grid:cell-navigation>`
 * on a real bootstrapped page upgrades through the live CustomAttributeRegistry, i.e. that the
 * `registerDataGrid(window.attributes)` line in plugs/bootstrap.ts actually fires.
 *
 * The fixture (demos/data-grid-bootstrap-fixture.html) does ONLY `window.attributes.upgrade(document.body)`
 * — no manual attach anywhere. Its grid is authored with every cell at `tabindex="-1"`, so:
 *   - the roving `tabindex="0"` that appears can only come from the behavior's connectedCallback, and
 *   - an arrow key moving focus can only work if the behavior bound keydown.
 * Both assertions therefore fail the moment the registration line stops firing.
 */

import { test, expect } from '@playwright/test';

test.describe('data-grid bootstrap auto-upgrade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/data-grid-bootstrap-fixture.html');
    await page.waitForFunction(
      () => (window as any).fixtureReady === true,
      undefined,
      { timeout: 10000 },
    );
  });

  test('the behavior seeds a single roving tabindex on the origin cell', async ({ page }) => {
    // The authored markup ships every cell at tabindex="-1"; only the behavior's #seedActive can
    // produce a tabindex="0". Exactly one, on the origin (data-row=0, data-col=0).
    const active = page.locator('[data-test="grid"] [tabindex="0"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-row', '0');
    await expect(active).toHaveAttribute('data-col', '0');
    await expect(active).toHaveText('Name');
  });

  test('an arrow key roves focus cell to cell — without any manual attach', async ({ page }) => {
    const origin = page.locator('[data-test="grid"] [data-row="0"][data-col="0"]');
    const right = page.locator('[data-test="grid"] [data-row="0"][data-col="1"]');
    const down = page.locator('[data-test="grid"] [data-row="1"][data-col="1"]');

    // Enter the grid at its single tab stop (the roving tabindex="0" cell).
    await origin.focus();
    await expect(origin).toBeFocused();

    // ArrowRight: roving tabindex and real DOM focus both move one column.
    await page.keyboard.press('ArrowRight');
    await expect(right).toBeFocused();
    await expect(right).toHaveAttribute('tabindex', '0');
    await expect(origin).toHaveAttribute('tabindex', '-1');

    // ArrowDown: into the body row, proving header→body movement is wired too.
    await page.keyboard.press('ArrowDown');
    await expect(down).toBeFocused();
    await expect(down).toHaveAttribute('tabindex', '0');
    await expect(down).toHaveText('Engineering');

    // Still exactly one roving tab stop across the whole grid.
    await expect(page.locator('[data-test="grid"] [tabindex="0"]')).toHaveCount(1);
  });
});
