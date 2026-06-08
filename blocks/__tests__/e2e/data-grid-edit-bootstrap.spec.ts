/**
 * E2E: prove `grid:cell-edit` (the editable sub-pattern) auto-upgrades an authored grid via the
 * bootstrap registry — the editing twin of data-grid-bootstrap.spec.ts (#144) for backlog #157.
 *
 * Every other place that exercises DataGridEditBehavior — the unit test and the conformance playground's
 * editable cards — ATTACHES it by hand (`new DataGridEditBehavior(); attach(); connectedCallback()`).
 * Nothing proved that a plain authored `<table role="grid" grid:cell-navigation grid:cell-edit>` on a
 * real bootstrapped page upgrades through the live CustomAttributeRegistry, i.e. that the
 * `registerDataGridEdit(window.attributes)` line in plugs/bootstrap.ts actually fires.
 *
 * The fixture (demos/data-grid-edit-bootstrap-fixture.html) does ONLY
 * `window.attributes.upgrade(document.body)` — no manual attach anywhere. So the editor that appears on
 * Enter, the navigation that stays put while editing, and the read-only column that refuses to edit can
 * only come from the registry-attached behaviors. Each assertion fails the moment a registration line
 * stops firing.
 */

import { test, expect } from '@playwright/test';

test.describe('data-grid edit bootstrap auto-upgrade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/data-grid-edit-bootstrap-fixture.html');
    await page.waitForFunction(() => (window as any).fixtureReady === true, undefined, { timeout: 10000 });
  });

  test('Enter on a focused data cell opens an editor — without any manual attach', async ({ page }) => {
    const cell = page.locator('[data-test="grid"] [data-row="1"][data-col="0"]');
    await cell.focus();
    await page.keyboard.press('Enter');

    // The only source of this input on the page is the registry-attached grid:cell-edit behavior.
    const editorInput = page.locator('[data-test="grid"] input.grid-cell-input');
    await expect(editorInput).toHaveCount(1);
    await expect(editorInput).toBeFocused();
    await expect(editorInput).toHaveValue('Aaron');
  });

  test('while editing, arrows edit the field and the grid does not navigate', async ({ page }) => {
    const origin = page.locator('[data-test="grid"] [data-row="1"][data-col="0"]');
    // Click to rove the navigation tabindex onto this cell (the nav behavior's click-to-focus), so we
    // can prove it does NOT move while editing.
    await origin.click();
    await expect(origin).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');

    // Still editing the same cell — the editor survived and the roving tabindex never moved.
    await expect(page.locator('[data-test="grid"] input.grid-cell-input')).toHaveCount(1);
    await expect(origin).toHaveAttribute('tabindex', '0');
    await expect(page.locator('[data-test="grid"] [tabindex="0"]')).toHaveCount(1);
  });

  test('Enter commits the new value in-place; Escape restores it', async ({ page }) => {
    const cell = page.locator('[data-test="grid"] [data-row="1"][data-col="0"]');

    await cell.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-test="grid"] input.grid-cell-input').fill('Renamed');
    await page.keyboard.press('Enter');
    await expect(cell).toHaveText('Renamed');
    await expect(cell).toBeFocused();

    await page.keyboard.press('F2');
    await page.locator('[data-test="grid"] input.grid-cell-input').fill('ThrowAway');
    await page.keyboard.press('Escape');
    await expect(cell).toHaveText('Renamed'); // restored, not committed
  });

  test('an aria-readonly cell does not open an editor (#159 through the bootstrap)', async ({ page }) => {
    const readonly = page.locator('[data-test="grid"] [data-row="1"][data-col="2"]');
    await readonly.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('F2');
    await expect(page.locator('[data-test="grid"] input.grid-cell-input')).toHaveCount(0);
    await expect(readonly).toHaveText('110');
  });
});
