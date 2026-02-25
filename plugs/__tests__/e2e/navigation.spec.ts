/**
 * E2E Tests for Navigation Demo
 *
 * Tests the complete navigation block demonstrating:
 * - NavListBehavior: roving tabindex, keyboard navigation
 * - NavSectionBehavior: disclosure sections (expand/collapse)
 * - RouteLinkBehavior: active link tracking with aria-current
 * - Full accessibility compliance (ARIA attributes, keyboard interaction)
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
      return (
        collector.consoleErrors.length > 0 || collector.pageErrors.length > 0
      );
    },
    getErrorSummary() {
      const errors: string[] = [];
      if (collector.consoleErrors.length > 0) {
        errors.push(
          `Console errors:\n  - ${collector.consoleErrors.join('\n  - ')}`,
        );
      }
      if (collector.pageErrors.length > 0) {
        errors.push(
          `Page errors:\n  - ${collector.pageErrors.join('\n  - ')}`,
        );
      }
      return errors.join('\n');
    },
  };
  return collector;
}

test.describe('Navigation Demo', () => {
  let errorCollector: ErrorCollector;

  test.beforeEach(async ({ page }) => {
    errorCollector = createErrorCollector();
    errorCollector.attach(page);

    await page.goto('/demos/navigation-demo.html');
    await page.waitForFunction(
      () => (window as any).demoReady === true,
      undefined,
      { timeout: 10000 },
    );
  });

  test.describe('page load', () => {
    test('should load without errors', async () => {
      expect(errorCollector.hasErrors()).toBe(false);
    });

    test('should render sidebar navigation', async ({ page }) => {
      const nav = page.locator('[data-test="nav"]');
      await expect(nav).toBeVisible();
      await expect(nav).toHaveAttribute('aria-label', 'Main');
    });

    test('should show Dashboard as active page', async ({ page }) => {
      const dashboardLink = page.locator('[data-test="link-home"]');
      await expect(dashboardLink).toHaveAttribute('aria-current', 'page');
      await expect(dashboardLink).toHaveClass(/active/);
    });
  });

  test.describe('disclosure sections', () => {
    test('should have catalog section expanded by default', async ({
      page,
    }) => {
      const trigger = page.locator('[data-test="section-catalog"]');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(trigger).toHaveAttribute('aria-controls', 'catalog-items');

      const items = page.locator('[data-test="section-catalog-items"]');
      await expect(items).toBeVisible();
    });

    test('should have admin section collapsed by default', async ({ page }) => {
      const trigger = page.locator('[data-test="section-admin"]');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveAttribute('aria-controls', 'admin-items');

      const items = page.locator('[data-test="section-admin-items"]');
      await expect(items).toBeHidden();
    });

    test('should toggle admin section on click', async ({ page }) => {
      const trigger = page.locator('[data-test="section-admin"]');
      const items = page.locator('[data-test="section-admin-items"]');

      // Click to expand
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(items).toBeVisible();

      // Click to collapse
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(items).toBeHidden();
    });

    test('should toggle section on Enter key', async ({ page }) => {
      const trigger = page.locator('[data-test="section-admin"]');
      const items = page.locator('[data-test="section-admin-items"]');

      await trigger.focus();
      await trigger.press('Enter');
      await expect(items).toBeVisible();

      await trigger.press('Enter');
      await expect(items).toBeHidden();
    });

    test('should toggle section on Space key', async ({ page }) => {
      const trigger = page.locator('[data-test="section-admin"]');
      const items = page.locator('[data-test="section-admin-items"]');

      await trigger.focus();
      await trigger.press('Space');
      await expect(items).toBeVisible();
    });
  });

  test.describe('route navigation', () => {
    test('should navigate to Apps page and update active state', async ({
      page,
    }) => {
      const appsLink = page.locator('[data-test="link-apps"]');
      await appsLink.click();

      // Wait for route change
      await expect(page.locator('[data-test="page-content"]')).toHaveText(
        'Application catalog page.',
      );

      // Active state should update
      await expect(appsLink).toHaveAttribute('aria-current', 'page');
      await expect(appsLink).toHaveClass(/active/);

      // Dashboard should no longer be active
      const dashboardLink = page.locator('[data-test="link-home"]');
      await expect(dashboardLink).not.toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    test('should navigate to hidden section link after expanding', async ({
      page,
    }) => {
      // Expand admin section
      const adminTrigger = page.locator('[data-test="section-admin"]');
      await adminTrigger.click();

      // Click Settings link
      const settingsLink = page.locator('[data-test="link-settings"]');
      await settingsLink.click();

      await expect(page.locator('[data-test="page-content"]')).toHaveText(
        'Settings page.',
      );
      await expect(settingsLink).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('keyboard navigation', () => {
    test('should move focus with arrow keys', async ({ page }) => {
      const nav = page.locator('[data-test="nav"]');
      const dashboardLink = page.locator('[data-test="link-home"]');

      // Focus the nav area via the dashboard link
      await dashboardLink.focus();

      // ArrowDown should move to next item
      await nav.press('ArrowDown');
      await page.waitForTimeout(50);

      // Check that focus has moved (we can verify tabindex changed)
      await expect(dashboardLink).toHaveAttribute('tabindex', '-1');
    });
  });

  test.describe('no errors after interactions', () => {
    test('should have no JS errors after full navigation flow', async ({
      page,
    }) => {
      // Click through several links
      await page.locator('[data-test="link-apps"]').click();
      await page.waitForTimeout(100);

      await page.locator('[data-test="link-libraries"]').click();
      await page.waitForTimeout(100);

      // Toggle sections
      await page.locator('[data-test="section-admin"]').click();
      await page.waitForTimeout(100);

      await page.locator('[data-test="link-settings"]').click();
      await page.waitForTimeout(100);

      // Go back home
      await page.locator('[data-test="link-home"]').click();
      await page.waitForTimeout(100);

      if (errorCollector.hasErrors()) {
        throw new Error(
          `JS errors during navigation:\n${errorCollector.getErrorSummary()}`,
        );
      }
    });
  });
});
