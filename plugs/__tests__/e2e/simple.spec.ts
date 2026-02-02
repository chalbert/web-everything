/**
 * E2E Test for webcomponents - Using test page
 */

import { test, expect } from '@playwright/test';

test.describe('webcomponents - Basic E2E', () => {
  test('should create and clone custom elements', async ({ page }) => {
    // Navigate to test page
    await page.goto('http://localhost:5173/test-pages/webcomponents.html');
    
    // Wait for modules to load
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    const result = await page.evaluate(() => {
      const original = window.TestElement.create({ label: 'Hello' });
      document.body.appendChild(original);
      
      const clone = original.cloneNode(true);
      document.body.appendChild(clone);
      
      return {
        originalText: original.textContent,
        cloneText: clone.textContent,
        hasOptions: 'options' in clone,
        optionsLabel: clone.options?.label
      };
    });
    
    expect(result.originalText).toBe('Test: Hello');
    expect(result.cloneText).toBe('Test: Hello');
    expect(result.hasOptions).toBe(true);
    expect(result.optionsLabel).toBe('Hello');
  });
});
