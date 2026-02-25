/**
 * E2E Tests for Text Interpolation Demo
 *
 * Tests the complete text node expression pipeline in a real browser:
 * - Text node parsers detect {{ }} and [[ ]] syntax
 * - Expression parsers evaluate content
 * - InterpolationTextNode renders values
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

interface ErrorCollector {
  consoleErrors: string[];
  pageErrors: string[];
  attach: (page: Page) => void;
  hasErrors: () => boolean;
  getErrorSummary: () => string;
}

function createErrorCollector(): ErrorCollector {
  const collector: ErrorCollector = {
    consoleErrors: [],
    pageErrors: [],
    attach(page: Page) {
      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon.ico') && !text.includes('404')) {
            collector.consoleErrors.push(text);
          }
        }
      });
      page.on('pageerror', (error: Error) => {
        collector.pageErrors.push(`${error.name}: ${error.message}`);
      });
    },
    hasErrors() {
      return collector.consoleErrors.length > 0 || collector.pageErrors.length > 0;
    },
    getErrorSummary() {
      const errors: string[] = [];
      if (collector.consoleErrors.length > 0) {
        errors.push(`Console errors:\n  - ${collector.consoleErrors.join('\n  - ')}`);
      }
      if (collector.pageErrors.length > 0) {
        errors.push(`Page errors:\n  - ${collector.pageErrors.join('\n  - ')}`);
      }
      return errors.join('\n');
    },
  };
  return collector;
}

test.describe('Text Interpolation Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/text-interpolation-demo.html');
    await page.waitForFunction(
      () => (window as any).demoReady === true,
      { timeout: 10000 },
    );
  });

  test('page loads without JavaScript errors', async ({ page }) => {
    const errorCollector = createErrorCollector();
    errorCollector.attach(page);

    await page.reload();
    await page.waitForFunction(
      () => (window as any).demoReady === true,
      { timeout: 10000 },
    );
    await page.waitForTimeout(500);

    if (errorCollector.hasErrors()) {
      throw new Error(`JavaScript errors:\n${errorCollector.getErrorSummary()}`);
    }
  });

  test('basic interpolation renders state value', async ({ page }) => {
    const result = page.locator('[data-test="basic"]');
    await expect(result).toContainText('Hello, World!');
    // Should NOT contain raw {{ }} syntax
    await expect(result).not.toContainText('{{');
  });

  test('nested paths resolve correctly', async ({ page }) => {
    const result = page.locator('[data-test="nested"]');
    await expect(result).toContainText('User: Jane Doe (Platform Engineer)');
  });

  test('named contexts render context values', async ({ page }) => {
    const result = page.locator('[data-test="context"]');
    await expect(result).toContainText('Primary color: #6366f1');
  });

  test('pipe expressions apply filters', async ({ page }) => {
    const result = page.locator('[data-test="pipe"]');
    await expect(result).toContainText('Shouting: WORLD');
  });

  test('multiple expressions in same text node', async ({ page }) => {
    const result = page.locator('[data-test="multiple"]');
    await expect(result).toContainText('Full name: Jane Doe');
  });

  test('Polymer syntax [[ ]] renders values', async ({ page }) => {
    const result = page.locator('[data-test="polymer"]');
    await expect(result).toContainText('Count: 42');
    await expect(result).not.toContainText('[[');
  });

  test('mixed syntax works on same page', async ({ page }) => {
    const result = page.locator('[data-test="mixed"]');
    await expect(result).toContainText('Mustache: World / Polymer: 42');
  });

  test('template cloned expressions render correctly', async ({ page }) => {
    const result = page.locator('[data-test="template"]');
    await expect(result).toContainText('World');
    await expect(result).toContainText('Platform Engineer');
    await expect(result).toContainText('42');
    // No raw syntax visible
    await expect(result).not.toContainText('{{');
    await expect(result).not.toContainText('[[');
  });

  test('no FOUC — raw expression syntax not visible', async ({ page }) => {
    // Verify no raw {{ or [[ text in any result container
    const results = page.locator('.result');
    const count = await results.count();

    for (let i = 0; i < count; i++) {
      const text = await results.nth(i).textContent();
      expect(text).not.toContain('{{');
      expect(text).not.toContain('[[');
    }
  });
});
