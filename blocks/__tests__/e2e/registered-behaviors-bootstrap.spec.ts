/**
 * E2E: prove `nav:list` and `type-ahead` auto-upgrade via the bootstrap registry.
 *
 * Backlog #155, the sibling of #144 (which closed this loop for `grid:cell-navigation`). Every other
 * place that exercises these two behaviors ATTACHES them by hand or relies on a demo that "looks
 * right" with authored state. Nothing proved that a plain authored `<nav nav:list>` / `<ul type-ahead>`
 * on a real bootstrapped page upgrades through the live CustomAttributeRegistry — i.e. that the
 * `registerNavigation(window.attributes)` and `registerTypeAhead(window.attributes)` lines in
 * plugs/bootstrap.ts actually fire.
 *
 * The shared fixture (demos/registered-behaviors-bootstrap-fixture.html) does ONLY
 * `window.attributes.upgrade(document.body)` — no manual attach. Both widgets are authored with NO
 * pre-seeded active state, so the behavior-produced state (a roving tabindex; a keystroke-driven focus
 * move) is itself proof the registration line fired. Each assertion fails the moment a line stops
 * firing — one shared home so a new behavior `define` in bootstrap.ts that never fires can't slip
 * through. (grid:cell-navigation / grid:cell-edit are guarded by their own bootstrap specs.)
 */

import { test, expect } from '@playwright/test';

test.describe('registered behaviors bootstrap auto-upgrade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/registered-behaviors-bootstrap-fixture.html');
    await page.waitForFunction(
      () => (window as any).fixtureReady === true,
      undefined,
      { timeout: 10000 },
    );
  });

  test.describe('nav:list', () => {
    test('the behavior seeds a single roving tabindex on the first link', async ({ page }) => {
      // Every link ships at tabindex="-1"; only NavListBehavior's #setupRovingTabindex can produce a
      // tabindex="0". Exactly one, on the first item (no aria-current authored).
      const active = page.locator('[data-test="nav"] [tabindex="0"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute('data-test', 'nav-alpha');
    });

    test('an arrow key roves focus link to link — without any manual attach', async ({ page }) => {
      const alpha = page.locator('[data-test="nav-alpha"]');
      const bravo = page.locator('[data-test="nav-bravo"]');

      // Enter the nav at its single tab stop (the roving tabindex="0" link).
      await alpha.focus();
      await expect(alpha).toBeFocused();

      // ArrowDown (vertical default): roving tabindex and real DOM focus both move one item.
      await page.keyboard.press('ArrowDown');
      await expect(bravo).toBeFocused();
      await expect(bravo).toHaveAttribute('tabindex', '0');
      await expect(alpha).toHaveAttribute('tabindex', '-1');

      // Still exactly one roving tab stop across the whole nav.
      await expect(page.locator('[data-test="nav"] [tabindex="0"]')).toHaveCount(1);
    });
  });

  test.describe('type-ahead', () => {
    test('typing a prefix moves focus to the matching option — without any manual attach', async ({ page }) => {
      const argentina = page.locator('[data-test="opt-argentina"]');
      const brazil = page.locator('[data-test="opt-brazil"]');
      const canada = page.locator('[data-test="opt-canada"]');

      // The behavior seeds no visible state; focus an option, then a printable key drives the move —
      // which can only work if TypeAheadBehavior bound keydown via the registration.
      await argentina.focus();
      await expect(argentina).toBeFocused();

      await page.keyboard.press('b');
      await expect(brazil).toBeFocused();

      // Wait out the buffer reset (default 500ms) so the next key starts a fresh search rather than
      // appending to "b" — proves the idle-reset path is live too, not just the first keystroke.
      await page.waitForTimeout(600);
      await page.keyboard.press('c');
      await expect(canada).toBeFocused();
    });
  });
});
