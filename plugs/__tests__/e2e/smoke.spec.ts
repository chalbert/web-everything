/**
 * Smoke Tests - Validates all pages load without errors
 *
 * These tests ensure that every page on the site:
 * 1. Loads without JavaScript errors
 * 2. Has no uncaught exceptions
 * 3. Returns a valid HTTP response
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Error collector for capturing console errors and page errors during tests.
 */
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
          // Ignore common non-critical errors
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

/**
 * All pages that should be tested.
 * Add new pages here as they are created.
 *
 * Note: Clean URLs like /demos/declarative-spa/ are detail pages served by Eleventy,
 * not the actual demos. The demos are at the .html paths.
 */
const pages = [
  { name: 'Declarative SPA (plugged)', url: '/demos/declarative-spa.html', waitFor: 'demoReady' },
  { name: 'Declarative SPA (unplugged)', url: '/demos/declarative-spa-unplugged.html', waitFor: 'demoReady' },
];

test.describe('Smoke Tests - All Pages Load', () => {
  for (const pageConfig of pages) {
    test(`${pageConfig.name} loads without errors`, async ({ page }) => {
      const errorCollector = createErrorCollector();
      errorCollector.attach(page);

      // Navigate to the page
      const response = await page.goto(pageConfig.url);

      // Check HTTP response
      expect(response?.status()).toBeLessThan(400);

      // Wait for page to be ready if specified
      if (pageConfig.waitFor) {
        await page.waitForFunction(
          (prop) => (window as any)[prop] === true,
          pageConfig.waitFor,
          { timeout: 10000 }
        );
      }

      // Give async code time to error
      await page.waitForTimeout(500);

      // Check for errors
      if (errorCollector.hasErrors()) {
        throw new Error(`JavaScript errors on ${pageConfig.name}:\n${errorCollector.getErrorSummary()}`);
      }
    });
  }
});

test.describe('Smoke Tests - Basic Interactivity', () => {
  for (const pageConfig of pages) {
    test(`${pageConfig.name} responds to basic interactions`, async ({ page }) => {
      const errorCollector = createErrorCollector();
      errorCollector.attach(page);

      await page.goto(pageConfig.url);

      if (pageConfig.waitFor) {
        await page.waitForFunction(
          (prop) => (window as any)[prop] === true,
          pageConfig.waitFor,
          { timeout: 10000 }
        );
      }

      // Try clicking any visible buttons
      const buttons = page.locator('button:visible');
      const buttonCount = await buttons.count();

      if (buttonCount > 0) {
        // Click the first button
        await buttons.first().click();
        await page.waitForTimeout(100);
      }

      // Check for errors after interaction
      if (errorCollector.hasErrors()) {
        throw new Error(`JavaScript errors after interaction on ${pageConfig.name}:\n${errorCollector.getErrorSummary()}`);
      }
    });
  }
});
