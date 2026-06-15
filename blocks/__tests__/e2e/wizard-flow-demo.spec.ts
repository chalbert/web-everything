/**
 * E2E for the Wizard / Flow Progress runtime demo (#692, slice B of #651).
 *
 * Drives the real `<wizard-flow>` Block — mounted against a CustomWorkflowEngine 4-step checkout graph
 * on /demos/wizard-flow-demo.html — through the browser, proving the demoable claim end-to-end: the
 * engine advances position on Next, Back walks the engine's history, and the Flow-Progress UX projects
 * `aria-current="step"` + a "Step N of M" announcement at each move. The same Block + graph are covered
 * headlessly by the wizard unit suite; this asserts they compose in a real browser.
 *
 * Needs the dev server (Vite :3000). The page sets `window.playgroundReady` once mounted.
 */
import { test, expect } from '@playwright/test';

const STEPS = ['Cart', 'Shipping', 'Payment', 'Review'];

test.describe('Wizard / Flow Progress demo — /demos/wizard-flow-demo.html', () => {
  test('the wizard mounts against the engine and advances/retreats with aria-current', async ({ page }) => {
    await page.goto('/demos/wizard-flow-demo.html');

    // The playground signals readiness once the Block is mounted.
    await page.waitForFunction(() => (window as unknown as { playgroundReady?: boolean }).playgroundReady === true);

    const indicators = page.locator('.wizard-steps [data-step-indicator]');
    await expect(indicators).toHaveCount(STEPS.length);

    const next = page.locator('.wizard-next');
    const back = page.locator('.wizard-back');
    const live = page.locator('.wizard-live');

    // Initial: step 1 is current, Back disabled.
    await expect(indicators.nth(0)).toHaveAttribute('aria-current', 'step');
    await expect(indicators.nth(0)).toHaveAttribute('data-step-status', 'process');
    await expect(live).toContainText('Step 1 of 4');
    await expect(back).toBeDisabled();

    // Advance through the engine → step 2 becomes current, step 1 finishes.
    await next.click();
    await expect(indicators.nth(1)).toHaveAttribute('aria-current', 'step');
    await expect(indicators.nth(0)).toHaveAttribute('data-step-status', 'finish');
    await expect(indicators.nth(1)).toHaveAttribute('data-step-status', 'process');
    await expect(live).toContainText('Step 2 of 4');
    await expect(back).toBeEnabled();

    // Back walks the engine's history → step 1 current again.
    await back.click();
    await expect(indicators.nth(0)).toHaveAttribute('aria-current', 'step');
    await expect(indicators.nth(1)).toHaveAttribute('data-step-status', 'wait');
    await expect(live).toContainText('Step 1 of 4');
    await expect(back).toBeDisabled();

    // Run to completion → final step current, Next disabled (engine `done`).
    await next.click(); // → shipping
    await next.click(); // → payment
    await next.click(); // → review (final)
    await expect(indicators.nth(3)).toHaveAttribute('aria-current', 'step');
    await expect(indicators.nth(3)).toHaveAttribute('data-step-status', 'process');
    await expect(next).toBeDisabled();
  });
});
