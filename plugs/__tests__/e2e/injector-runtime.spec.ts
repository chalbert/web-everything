import { test, expect } from '@playwright/test';

test.describe('Injector Runtime API Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/injector-runtime-demo.html');
    await page.waitForFunction(() => (window as any).demoReady === true);
  });

  test('should display initial provider values from module', async ({ page }) => {
    const configValue = page.locator('[data-test="config-value"]');
    await expect(configValue).toContainText('dark');
    await expect(configValue).toContainText('1.0.0');

    const counterProvider = page.locator('[data-test="counter-provider-value"]');
    await expect(counterProvider).toContainText('"count":0');
  });

  test('should show module as active', async ({ page }) => {
    const statusText = page.locator('[data-test="module-status-text"]');
    await expect(statusText).toHaveText('Module active');
  });

  test('counter increments on click', async ({ page }) => {
    const counterValue = page.locator('[data-test="counter-value"]');
    await expect(counterValue).toHaveText('0');

    await page.click('[data-test="increment-btn"]');
    await expect(counterValue).toHaveText('1');

    await page.click('[data-test="increment-btn"]');
    await expect(counterValue).toHaveText('2');
  });

  test('counter decrements on click', async ({ page }) => {
    const counterValue = page.locator('[data-test="counter-value"]');

    await page.click('[data-test="increment-btn"]');
    await page.click('[data-test="increment-btn"]');
    await expect(counterValue).toHaveText('2');

    await page.click('[data-test="decrement-btn"]');
    await expect(counterValue).toHaveText('1');
  });

  test('reset sets counter to zero', async ({ page }) => {
    const counterValue = page.locator('[data-test="counter-value"]');

    await page.click('[data-test="increment-btn"]');
    await page.click('[data-test="increment-btn"]');
    await page.click('[data-test="increment-btn"]');
    await expect(counterValue).toHaveText('3');

    await page.click('[data-test="reset-btn"]');
    await expect(counterValue).toHaveText('0');
  });

  test('event log records updates', async ({ page }) => {
    const eventLog = page.locator('[data-test="event-log"]');

    // Should have initial log entries
    await expect(eventLog).toContainText('Consumed');
    await expect(eventLog).toContainText('lazy-loaded');

    await page.click('[data-test="increment-btn"]');
    await expect(eventLog).toContainText('"count":1');
  });

  test('dispose clears providers and updates status', async ({ page }) => {
    const counterValue = page.locator('[data-test="counter-value"]');
    const statusText = page.locator('[data-test="module-status-text"]');
    const eventLog = page.locator('[data-test="event-log"]');

    // Increment first to verify it works
    await page.click('[data-test="increment-btn"]');
    await expect(counterValue).toHaveText('1');

    // Dispose the module
    await page.click('[data-test="dispose-btn"]');

    // Status should update
    await expect(statusText).toHaveText('Module disposed');

    // Log should show disposal
    await expect(eventLog).toContainText('providers cleared');

    // Further clicks should not change the counter
    await page.click('[data-test="increment-btn"]');
    await expect(counterValue).toHaveText('1');
  });
});
