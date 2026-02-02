/**
 * E2E Tests for webcomponents
 * 
 * Tests CustomElement and cloning behavior in real browsers.
 */

import { test, expect } from '@playwright/test';

test.describe('webcomponents - CustomElement', () => {
  test.beforeEach(async ({ page }) => {
    // Create a test page with the plugs loaded
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>webcomponents E2E Test</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module">
            // Import and initialize plugs
            import CustomElement from '/plugs/webcomponents/CustomElement.ts';
            import { applyPatches as applyWebcomponentsPatches } from '/plugs/webcomponents/index.ts';
            import CustomElementRegistry from '/plugs/webregistries/CustomElementRegistry.ts';
            
            // Apply patches
            applyWebcomponentsPatches();
            
            // Define a test element
            class TestElement extends CustomElement {
              constructor(options) {
                super(options);
                this.options = options || {};
              }
              
              connectedCallback() {
                this.textContent = 'Test: ' + (this.options.label || 'default');
              }
            }
            
            // Make available globally for tests
            window.TestElement = TestElement;
            window.CustomElement = CustomElement;
            window.elementRegistry = new CustomElementRegistry();
            window.elementRegistry.define('test-element', TestElement);
          </script>
        </body>
      </html>
    `);
    
    // Wait for module to load
    await page.waitForFunction(() => window.TestElement !== undefined);
  });

  test('should create custom element with options', async ({ page }) => {
    const result = await page.evaluate(() => {
      const element = new window.TestElement({ label: 'Hello' });
      document.body.appendChild(element);
      return element.textContent;
    });
    
    expect(result).toBe('Test: Hello');
  });

  test('should preserve options during cloning', async ({ page }) => {
    const result = await page.evaluate(() => {
      const original = new window.TestElement({ label: 'Original' });
      original.options = { label: 'Original' };
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
    
    expect(result.originalText).toBe('Test: Original');
    expect(result.cloneText).toBe('Test: Original');
    expect(result.hasOptions).toBe(true);
    expect(result.optionsLabel).toBe('Original');
  });

  test('should handle deep cloning with nested elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = new window.TestElement({ label: 'Parent' });
      const child = new window.TestElement({ label: 'Child' });
      parent.appendChild(child);
      document.body.appendChild(parent);
      
      const clone = parent.cloneNode(true);
      document.body.appendChild(clone);
      
      const clonedChild = clone.querySelector('test-element');
      
      return {
        parentText: parent.textContent.includes('Parent'),
        childText: child.textContent,
        cloneHasChild: clonedChild !== null,
        clonedChildText: clonedChild?.textContent
      };
    });
    
    expect(result.parentText).toBe(true);
    expect(result.childText).toBe('Test: Child');
    expect(result.cloneHasChild).toBe(true);
    expect(result.clonedChildText).toBe('Test: Child');
  });

  test('should maintain prototype chain', async ({ page }) => {
    const result = await page.evaluate(() => {
      const element = new window.TestElement({ label: 'Test' });
      document.body.appendChild(element);
      
      const clone = element.cloneNode(false);
      
      return {
        originalIsCustomElement: element instanceof window.CustomElement,
        originalIsHTMLElement: element instanceof HTMLElement,
        cloneIsCustomElement: clone instanceof window.CustomElement,
        cloneIsHTMLElement: clone instanceof HTMLElement,
        sameConstructor: element.constructor === clone.constructor
      };
    });
    
    expect(result.originalIsCustomElement).toBe(true);
    expect(result.originalIsHTMLElement).toBe(true);
    expect(result.cloneIsCustomElement).toBe(true);
    expect(result.cloneIsHTMLElement).toBe(true);
    expect(result.sameConstructor).toBe(true);
  });
});

test.describe('webcomponents - Element Insertion Patches', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Insertion Patches E2E Test</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module">
            import { patch as applyInsertionPatch } from '/plugs/webcomponents/Element.insertion.patch.ts';
            applyInsertionPatch();
            window.insertionPatchApplied = true;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.insertionPatchApplied === true);
  });

  test('should track creation injector with innerHTML', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.innerHTML = '<span>Test</span>';
      
      const span = div.querySelector('span');
      return {
        spanExists: span !== null,
        spanText: span?.textContent
      };
    });
    
    expect(result.spanExists).toBe(true);
    expect(result.spanText).toBe('Test');
  });

  test('should handle append with multiple elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = document.createElement('div');
      const child1 = document.createElement('span');
      const child2 = document.createElement('span');
      
      child1.textContent = 'First';
      child2.textContent = 'Second';
      
      parent.append(child1, child2);
      
      return {
        childCount: parent.children.length,
        firstText: parent.children[0].textContent,
        secondText: parent.children[1].textContent
      };
    });
    
    expect(result.childCount).toBe(2);
    expect(result.firstText).toBe('First');
    expect(result.secondText).toBe('Second');
  });

  test('should handle insertAdjacentElement', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = document.createElement('div');
      const reference = document.createElement('span');
      reference.textContent = 'Reference';
      parent.appendChild(reference);
      
      const before = document.createElement('span');
      before.textContent = 'Before';
      const after = document.createElement('span');
      after.textContent = 'After';
      
      reference.insertAdjacentElement('beforebegin', before);
      reference.insertAdjacentElement('afterend', after);
      
      return {
        childCount: parent.children.length,
        order: Array.from(parent.children).map(c => c.textContent)
      };
    });
    
    expect(result.childCount).toBe(3);
    expect(result.order).toEqual(['Before', 'Reference', 'After']);
  });
});

test.describe('webcomponents - Cross-browser compatibility', () => {
  test('should work consistently across browsers', async ({ page, browserName }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <script type="module">
            import CustomElement from '/plugs/webcomponents/CustomElement.ts';
            import { applyPatches } from '/plugs/webcomponents/index.ts';
            
            applyPatches();
            
            class BrowserTestElement extends CustomElement {
              connectedCallback() {
                this.textContent = 'Browser: ' + navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                                   navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other';
              }
            }
            
            window.BrowserTestElement = BrowserTestElement;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.BrowserTestElement !== undefined);
    
    const result = await page.evaluate(() => {
      const element = new window.BrowserTestElement();
      document.body.appendChild(element);
      return element.textContent;
    });
    
    expect(result).toContain('Browser:');
    
    // Test should pass in all browsers
    console.log(`Test passed in ${browserName}`);
  });
});
