/**
 * E2E tests for the Dev Panel (Spec Explorer).
 *
 * Validates:
 * 1. Standalone page: loads, UI structure, input, streaming, queries
 * 2. Integrated panel: toggle from site header, selection context
 *
 * Requires: `npm start` running (Vite dev server with bridge plugin).
 * Note: Some tests make real Claude API calls — keep prompts minimal.
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/** Collect console errors during test execution */
function attachErrorCollector(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('404')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (error: Error) => {
    errors.push(`${error.name}: ${error.message}`);
  });
  return errors;
}

// ── Standalone page tests ───────────────────────────────

test.describe('Dev Panel - Standalone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/dev-panel.html');
    await page.waitForSelector('.status.ready, .status.error', { timeout: 10000 });
  });

  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = attachErrorCollector(page);

    await page.goto('/demos/dev-panel.html');
    await page.waitForSelector('.status.ready, .status.error', { timeout: 10000 });
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });

  test('has correct UI structure', async ({ page }) => {
    await expect(page.locator('.panel-header h1')).toHaveText('Spec Explorer');
    const status = page.locator('.status');
    await expect(status).toBeVisible();

    const systemMsg = page.locator('.message.system');
    await expect(systemMsg).toBeVisible();
    await expect(systemMsg).toContainText('specs');

    const textarea = page.locator('#prompt-input');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', /Message/i);

    await expect(page.locator('#send-btn')).toBeVisible();
    await expect(page.locator('#send-icon')).toBeVisible();
    await expect(page.locator('#stop-icon')).toBeHidden();
  });

  test('bridge health check reports Claude available', async ({ page }) => {
    const health = await page.evaluate(async () => {
      const res = await fetch('/__dev-panel/health');
      return res.json();
    });
    expect(health.available).toBe(true);
    expect(health.binary).toBeTruthy();

    await expect(page.locator('.status')).toHaveText('Ready');
    await expect(page.locator('.status')).toHaveClass(/ready/);
  });

  test('Enter key sends message, Shift+Enter adds newline', async ({ page }) => {
    const textarea = page.locator('#prompt-input');

    await textarea.fill('line one');
    await textarea.press('Shift+Enter');
    await textarea.type('line two');
    const value = await textarea.inputValue();
    expect(value).toContain('line one');
    expect(value).toContain('line two');
    await expect(page.locator('.message.user')).toHaveCount(0);

    await textarea.fill('What is a block?');
    await textarea.press('Enter');
    await expect(textarea).toHaveValue('');
    await expect(page.locator('.message.user')).toHaveText('What is a block?');
  });

  test('can type and submit via button click', async ({ page }) => {
    const textarea = page.locator('#prompt-input');
    await textarea.fill('What is a block?');
    await page.locator('#send-btn').click();

    await expect(textarea).toHaveValue('');
    await expect(page.locator('.message.user')).toHaveText('What is a block?');
    await expect(page.locator('#send-icon')).toBeHidden();
    await expect(page.locator('#stop-icon')).toBeVisible();
    await expect(textarea).toBeDisabled();
  });

  test('shows streaming message with cursor during query', { timeout: 60000 }, async ({ page }) => {
    await page.locator('#prompt-input').fill('Say hello');
    await page.locator('#send-btn').click();

    const streamingMsg = page.locator('.message.assistant.streaming');
    await expect(streamingMsg).toBeVisible({ timeout: 30000 });
    await expect(streamingMsg.locator('.cursor')).toBeVisible();
  });

  test('completes a real query and displays response', { timeout: 90000 }, async ({ page }) => {
    const textarea = page.locator('#prompt-input');
    await textarea.fill('Reply with exactly: HELLO_DEV_PANEL');
    await page.locator('#send-btn').click();

    const assistantMsg = page.locator('.message.assistant:not(.streaming)');
    await expect(assistantMsg).toBeVisible({ timeout: 60000 });
    const text = await assistantMsg.textContent();
    expect(text!.length).toBeGreaterThan(0);

    await expect(page.locator('#send-icon')).toBeVisible();
    await expect(page.locator('#stop-icon')).toBeHidden();
    await expect(textarea).toBeEnabled();
  });

  test('does not submit empty input', async ({ page }) => {
    await page.locator('#prompt-input').press('Enter');
    await expect(page.locator('.message.user')).toHaveCount(0);
    await expect(page.locator('#send-icon')).toBeVisible();

    await page.locator('#send-btn').click();
    await expect(page.locator('.message.user')).toHaveCount(0);
  });

  test('textarea auto-resizes with content', async ({ page }) => {
    const textarea = page.locator('#prompt-input');
    const initialHeight = await textarea.evaluate(el => el.scrollHeight);
    await textarea.fill('line 1\nline 2\nline 3\nline 4');
    const expandedHeight = await textarea.evaluate(el => el.scrollHeight);
    expect(expandedHeight).toBeGreaterThan(initialHeight);
  });
});

// ── Integrated panel tests (from site pages) ────────────

test.describe('Dev Panel - Integrated', () => {
  test.beforeEach(async ({ page }) => {
    // Go to a documentation page (the home page)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('toggle button opens and closes the panel', async ({ page }) => {
    const toggle = page.locator('#claude-panel-toggle');
    const panel = page.locator('#claude-panel');

    // Panel should start closed
    await expect(panel).not.toHaveClass(/open/);
    await expect(page.locator('body')).not.toHaveClass(/panel-open/);

    // Click to open
    await toggle.click();
    await expect(panel).toHaveClass(/open/);
    await expect(page.locator('body')).toHaveClass(/panel-open/);
    await expect(toggle).toHaveClass(/active/);

    // Click to close
    await toggle.click();
    await expect(panel).not.toHaveClass(/open/);
    await expect(page.locator('body')).not.toHaveClass(/panel-open/);
  });

  test('Escape key closes the panel', async ({ page }) => {
    await page.locator('#claude-panel-toggle').click();
    await expect(page.locator('#claude-panel')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#claude-panel')).not.toHaveClass(/open/);
  });

  test('iframe loads dev panel when opened', async ({ page }) => {
    const frame = page.locator('#claude-panel-frame');

    // Iframe should have no src initially (lazy load)
    await expect(frame).not.toHaveAttribute('src');

    // Open panel
    await page.locator('#claude-panel-toggle').click();

    // Iframe should now have src
    await expect(frame).toHaveAttribute('src', '/demos/dev-panel.html');

    // Wait for iframe content to load
    const iframePage = page.frameLocator('#claude-panel-frame');
    await expect(iframePage.locator('#prompt-input')).toBeVisible({ timeout: 10000 });
  });

  test('text selection is forwarded to panel as context', async ({ page }) => {
    // Open panel so iframe loads
    await page.locator('#claude-panel-toggle').click();
    const iframePage = page.frameLocator('#claude-panel-frame');
    await expect(iframePage.locator('#prompt-input')).toBeVisible({ timeout: 10000 });

    // Wait for the iframe's status check to complete (ensures all JS has run)
    await expect(iframePage.locator('.status.ready, .status.error')).toBeVisible({ timeout: 10000 });

    // Post selection context directly to the iframe via its contentWindow
    // We use the iframe's frame to evaluate, which runs inside the iframe context
    await iframePage.locator('#prompt-input').evaluate((_, ctx) => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'selection-context',
          context: ctx
        }
      }));
    }, {
      text: 'This is selected text from the page',
      page: '/blocks/simple-store/',
      title: 'SimpleStore — Web Everything',
      heading: 'API Reference'
    });

    // Context chip should appear in the iframe
    await expect(iframePage.locator('.selection-context')).toBeVisible({ timeout: 5000 });
    await expect(iframePage.locator('.selection-context-source')).toContainText('SimpleStore');
    await expect(iframePage.locator('.selection-context-source')).toContainText('API Reference');

    // Dismiss the context
    await iframePage.locator('.selection-context-dismiss').click();
    await expect(iframePage.locator('#selection-context')).toBeHidden();
  });
});
