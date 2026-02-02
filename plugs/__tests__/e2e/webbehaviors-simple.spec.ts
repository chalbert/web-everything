/**
 * E2E Tests for webbehaviors - Simplified
 * 
 * Tests custom attribute system using the actual API.
 */

import { test, expect } from '@playwright/test';

test.describe('webbehaviors - Custom Attributes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webbehaviors.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    // Define test attribute
    await page.evaluate(() => {
      class HighlightAttribute extends window.CustomAttribute {
        static observedAttributes = ['highlight'];
        
        connectedCallback() {
          this.target.style.backgroundColor = this.value || 'yellow';
        }
        
        attributeChangedCallback(name, oldValue, newValue) {
          this.target.style.backgroundColor = newValue || 'yellow';
        }
        
        disconnectedCallback() {
          this.target.style.backgroundColor = '';
        }
      }
      
      const registry = new window.CustomAttributeRegistry();
      registry.define('highlight', HighlightAttribute);
      
      window.HighlightAttribute = HighlightAttribute;
      window.attributeRegistry = registry;
    });
  });

  test('should apply attribute behavior to element', async ({ page }) => {
    const result = await page.evaluate(() => {
      const container = document.createElement('div');
      container.innerHTML = '<div highlight=""></div>';
      document.body.appendChild(container);
      
      window.attributeRegistry.upgrade(container);
      
      const element = container.querySelector('[highlight]');
      
      return {
        backgroundColor: element.style.backgroundColor,
        hasBackground: element.style.backgroundColor !== ''
      };
    });
    
    expect(result.hasBackground).toBe(true);
    expect(result.backgroundColor).toBe('yellow');
  });

  test('should update when attribute value changes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const container = document.createElement('div');
      container.innerHTML = '<div highlight="red"></div>';
      document.body.appendChild(container);
      
      window.attributeRegistry.upgrade(container);
      
      const element = container.querySelector('[highlight]');
      const instance = window.attributeRegistry.getInstance(element, window.HighlightAttribute);
      
      const beforeColor = element.style.backgroundColor;
      
      // Change attribute value
      element.setAttribute('highlight', 'blue');
      
      // Wait for MutationObserver to process the change
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const afterColor = element.style.backgroundColor;
      
      return {
        beforeColor,
        afterColor,
        changed: beforeColor !== afterColor
      };
    });
    
    expect(result.beforeColor).toBe('red');
    expect(result.afterColor).toBe('blue');
    expect(result.changed).toBe(true);
  });

  test('should cleanup on disconnect', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const container = document.createElement('div');
      container.innerHTML = '<div highlight="green"></div>';
      document.body.appendChild(container);
      
      window.attributeRegistry.upgrade(container);
      
      const element = container.querySelector('[highlight]');
      const withBackground = element.style.backgroundColor;
      
      // Remove attribute to trigger disconnect
      element.removeAttribute('highlight');
      
      // Wait for MutationObserver to process the removal
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const withoutBackground = element.style.backgroundColor;
      
      return {
        withBackground,
        withoutBackground,
        cleaned: withoutBackground === ''
      };
    });
    
    expect(result.withBackground).toBe('green');
    expect(result.cleaned).toBe(true);
  });

  test('should handle multiple attributes on same element', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Define second attribute
      class TooltipAttribute extends window.CustomAttribute {
        connectedCallback() {
          this.target.title = this.value || 'tooltip';
        }
      }
      
      window.attributeRegistry.define('tooltip', TooltipAttribute);
      
      const container = document.createElement('div');
      container.innerHTML = '<div highlight="pink" tooltip="Test tooltip"></div>';
      document.body.appendChild(container);
      
      window.attributeRegistry.upgrade(container);
      
      const element = container.querySelector('[highlight]');
      
      return {
        backgroundColor: element.style.backgroundColor,
        title: element.title,
        hasBoth: element.style.backgroundColor !== '' && element.title !== ''
      };
    });
    
    expect(result.backgroundColor).toBe('pink');
    expect(result.title).toBe('Test tooltip');
    expect(result.hasBoth).toBe(true);
  });
});
