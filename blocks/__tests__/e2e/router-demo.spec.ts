/**
 * E2E Tests for Router Demo
 *
 * Tests the declarative client-side routing demo featuring:
 * - route:link navigation with active class
 * - Route loaders (user profile fetch)
 * - Route guards (admin requires auth)
 * - Error boundaries (user not found)
 * - Named outlets (sidebar)
 * - Browser history navigation
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// ---------------------------------------------------------------------------
// Error Collector (same pattern as declarative-spa.spec.ts)
// ---------------------------------------------------------------------------

interface ErrorCollector {
  consoleErrors: string[];
  pageErrors: string[];
  attach: (page: Page) => void;
  clear: () => void;
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
    clear() {
      collector.consoleErrors = [];
      collector.pageErrors = [];
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Router Demo', () => {
  let errorCollector: ErrorCollector;

  test.beforeEach(async ({ page }) => {
    errorCollector = createErrorCollector();
    errorCollector.attach(page);

    await page.goto('/demos/declarative-spa-router.html');
    await page.waitForFunction(() => (window as any).demoReady === true, { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (errorCollector.hasErrors()) {
      throw new Error(`JavaScript errors detected:\n${errorCollector.getErrorSummary()}`);
    }
  });

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  test.describe('Navigation', () => {
    test('should start on welcome view at root', async ({ page }) => {
      const heading = page.locator('route-view h2');
      await expect(heading).toHaveText('Welcome');

      const featureList = page.locator('.feature-list');
      await expect(featureList).toBeVisible();
    });

    test('should navigate to counter via nav link', async ({ page }) => {
      await page.locator('nav a[href="/counter"]').click();

      const heading = page.locator('route-view h2');
      await expect(heading).toHaveText('Counter Demo');

      // URL should update
      await expect(page).toHaveURL(/\/counter$/);
    });

    test('should navigate to todos via nav link', async ({ page }) => {
      await page.locator('nav a[href="/todos"]').click();

      const heading = page.locator('route-view h2');
      await expect(heading).toHaveText('Todo List');
      await expect(page).toHaveURL(/\/todos$/);
    });

    test('should apply active class to current nav link', async ({ page }) => {
      const counterLink = page.locator('nav a[href="/counter"]');
      const todosLink = page.locator('nav a[href="/todos"]');

      await counterLink.click();
      await expect(counterLink).toHaveClass(/active/);
      await expect(todosLink).not.toHaveClass(/active/);

      await todosLink.click();
      await expect(todosLink).toHaveClass(/active/);
      await expect(counterLink).not.toHaveClass(/active/);
    });

    test('should navigate back and forward with browser history', async ({ page }) => {
      // Navigate: home → counter → todos
      await page.locator('nav a[href="/counter"]').click();
      await expect(page.locator('route-view h2')).toHaveText('Counter Demo');

      await page.locator('nav a[href="/todos"]').click();
      await expect(page.locator('route-view h2')).toHaveText('Todo List');

      // Go back to counter
      await page.goBack();
      await expect(page.locator('route-view h2')).toHaveText('Counter Demo');
      await expect(page).toHaveURL(/\/counter$/);

      // Go forward to todos
      await page.goForward();
      await expect(page.locator('route-view h2')).toHaveText('Todo List');
      await expect(page).toHaveURL(/\/todos$/);
    });
  });

  // -----------------------------------------------------------------------
  // Counter Route
  // -----------------------------------------------------------------------

  test.describe('Counter Route', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('nav a[href="/counter"]').click();
    });

    test('should start at zero', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      await expect(counterValue).toHaveText('0');
    });

    test('should increment, decrement, and reset', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      const incrementBtn = page.locator('#increment-btn');
      const decrementBtn = page.locator('#decrement-btn');
      const resetBtn = page.locator('#reset-btn');

      await incrementBtn.click();
      await incrementBtn.click();
      await expect(counterValue).toHaveText('2');

      await decrementBtn.click();
      await expect(counterValue).toHaveText('1');

      await resetBtn.click();
      await expect(counterValue).toHaveText('0');
    });

    test('should re-stamp content when navigating back (template re-created)', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      const incrementBtn = page.locator('#increment-btn');

      await incrementBtn.click();
      await incrementBtn.click();
      await incrementBtn.click();
      await expect(counterValue).toHaveText('3');

      // Navigate away
      await page.locator('nav a[href="/todos"]').click();
      await expect(page.locator('route-view h2')).toHaveText('Todo List');

      // Navigate back — template is re-stamped with initial value
      await page.locator('nav a[href="/counter"]').click();
      await expect(counterValue).toHaveText('0');
    });
  });

  // -----------------------------------------------------------------------
  // Todo Route
  // -----------------------------------------------------------------------

  test.describe('Todo Route', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('nav a[href="/todos"]').click();
    });

    test('should start with empty list', async ({ page }) => {
      const todoItems = page.locator('.todo-item');
      await expect(todoItems).toHaveCount(0);

      const todoCount = page.locator('#todo-count');
      await expect(todoCount).toHaveText('0 items');
    });

    test('should add todos and clear input', async ({ page }) => {
      const input = page.locator('#todo-input');
      const form = page.locator('#todo-form');

      await input.fill('Buy groceries');
      await form.locator('button[type="submit"]').click();

      await expect(page.locator('.todo-item')).toHaveCount(1);
      await expect(input).toHaveValue('');

      await input.fill('Walk the dog');
      await form.locator('button[type="submit"]').click();

      await expect(page.locator('.todo-item')).toHaveCount(2);
    });

    test('should update item count', async ({ page }) => {
      const input = page.locator('#todo-input');
      const submitBtn = page.locator('#todo-form button[type="submit"]');
      const todoCount = page.locator('#todo-count');

      await input.fill('First');
      await submitBtn.click();
      await expect(todoCount).toHaveText('1 item');

      await input.fill('Second');
      await submitBtn.click();
      await expect(todoCount).toHaveText('2 items');
    });
  });

  // -----------------------------------------------------------------------
  // User Loader
  // -----------------------------------------------------------------------

  test.describe('User Loader', () => {
    test('should load and display User 1 (Alice)', async ({ page }) => {
      await page.locator('nav a[href="/users/1"]').click();

      // Wait for loader to complete (500ms simulated delay)
      const userCard = page.locator('#user-card');
      await expect(userCard.locator('.user-avatar')).toHaveText('A', { timeout: 5000 });
      await expect(userCard.locator('h3')).toHaveText('Alice');
      await expect(userCard.locator('p')).toHaveText('alice@example.com');
      await expect(userCard.locator('.user-role')).toHaveText('Developer');
    });

    test('should load and display User 2 (Bob)', async ({ page }) => {
      await page.locator('nav a[href="/users/2"]').click();

      const userCard = page.locator('#user-card');
      await expect(userCard.locator('.user-avatar')).toHaveText('B', { timeout: 5000 });
      await expect(userCard.locator('h3')).toHaveText('Bob');
      await expect(userCard.locator('p')).toHaveText('bob@example.com');
      await expect(userCard.locator('.user-role')).toHaveText('Designer');
    });

    test('should show error boundary for non-existent user', async ({ page }) => {
      // Navigate to users first, then use sidebar link to user 999
      await page.locator('nav a[href="/users/1"]').click();
      await expect(page.locator('#user-card .user-avatar')).toBeVisible({ timeout: 5000 });

      // Click the User 999 link in sidebar
      await page.locator('a[href="/users/999"]').click();

      const errorCard = page.locator('.error-card');
      await expect(errorCard).toBeVisible({ timeout: 5000 });
      await expect(errorCard.locator('h2')).toHaveText('User Not Found');

      // Clear the expected error from the collector since this is intentional
      errorCollector.clear();
    });
  });

  // -----------------------------------------------------------------------
  // Guards
  // -----------------------------------------------------------------------

  test.describe('Guards', () => {
    test('should redirect /admin to /login when not authenticated', async ({ page }) => {
      await page.locator('nav a[href="/admin"]').click();

      // Should be redirected to login
      const heading = page.locator('route-view h2');
      await expect(heading).toHaveText('Login Required');
    });

    test('should show login page with toggle button', async ({ page }) => {
      await page.locator('nav a[href="/admin"]').click();

      const loginBtn = page.locator('#login-btn');
      await expect(loginBtn).toBeVisible();
      await expect(loginBtn).toHaveText('Log In');
    });

    test('should allow /admin access after logging in', async ({ page }) => {
      // Try admin → get redirected to login
      await page.locator('nav a[href="/admin"]').click();
      await expect(page.locator('route-view h2')).toHaveText('Login Required');

      // Click login to toggle auth
      await page.locator('#login-btn').click();

      // Now navigate to admin
      await page.locator('nav a[href="/admin"]').click();

      await expect(page.locator('route-view h2')).toHaveText('Admin Panel');
      await expect(page.locator('.admin-content')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Named Outlets
  // -----------------------------------------------------------------------

  test.describe('Named Outlets', () => {
    test('should show sidebar content on user routes', async ({ page }) => {
      await page.locator('nav a[href="/users/1"]').click();

      const sidebar = page.locator('route-outlet[name="sidebar"]');
      const sidebarContent = sidebar.locator('.sidebar-content');

      await expect(sidebarContent).toBeVisible({ timeout: 5000 });
      await expect(sidebarContent.locator('h3')).toHaveText('User Actions');
    });

    test('should hide sidebar content on non-user routes', async ({ page }) => {
      // First go to users to see sidebar
      await page.locator('nav a[href="/users/1"]').click();
      await expect(page.locator('.sidebar-content')).toBeVisible({ timeout: 5000 });

      // Navigate to counter
      await page.locator('nav a[href="/counter"]').click();

      // Sidebar content should no longer be visible
      await expect(page.locator('.sidebar-content')).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Source Viewer
  // -----------------------------------------------------------------------

  test.describe('Source Viewer', () => {
    test('should show HTML source by default', async ({ page }) => {
      const sourceDisplay = page.locator('#source-display');
      const htmlBtn = page.locator('#view-source-btn');

      await expect(htmlBtn).toHaveClass(/active/);
      await expect(sourceDisplay).not.toBeEmpty();
    });

    test('should toggle between HTML and JS source', async ({ page }) => {
      const sourceDisplay = page.locator('#source-display');
      const htmlBtn = page.locator('#view-source-btn');
      const jsBtn = page.locator('#view-js-btn');

      // Click JS
      await jsBtn.click();
      await expect(jsBtn).toHaveClass(/active/);
      await expect(htmlBtn).not.toHaveClass(/active/);

      const jsContent = await sourceDisplay.textContent();
      expect(jsContent).toContain('routeGuard');

      // Click HTML
      await htmlBtn.click();
      await expect(htmlBtn).toHaveClass(/active/);

      const htmlContent = await sourceDisplay.textContent();
      expect(htmlContent).toContain('route-view');
    });
  });

  // -----------------------------------------------------------------------
  // Error Detection
  // -----------------------------------------------------------------------

  test.describe('Error Detection', () => {
    test('should load without JavaScript errors', async ({ page }) => {
      await page.waitForTimeout(500);
      expect(errorCollector.hasErrors()).toBe(false);
    });

    test('should handle all interactions without errors', async ({ page }) => {
      // Counter
      await page.locator('nav a[href="/counter"]').click();
      await page.locator('#increment-btn').click();
      await page.locator('#decrement-btn').click();
      await page.locator('#reset-btn').click();

      // Todos
      await page.locator('nav a[href="/todos"]').click();
      await page.locator('#todo-input').fill('Test todo');
      await page.locator('#todo-form button[type="submit"]').click();

      // User with loader
      await page.locator('nav a[href="/users/1"]').click();
      await expect(page.locator('#user-card .user-avatar')).toBeVisible({ timeout: 5000 });

      // Guard redirect
      await page.locator('nav a[href="/admin"]').click();
      await expect(page.locator('#login-btn')).toBeVisible();

      // Navigate back home
      await page.locator('nav a[href="/counter"]').click();

      expect(errorCollector.hasErrors()).toBe(false);
    });
  });
});
