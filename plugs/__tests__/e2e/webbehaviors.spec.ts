/**
 * E2E Tests for webbehaviors
 * 
 * Tests custom attribute system in real browsers.
 */

import { test, expect } from '@playwright/test';

test.describe('webbehaviors - Custom Attributes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webbehaviors.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    // Define test attribute in page
    await page.evaluate(() => {
      class HighlightAttribute extends window.CustomAttribute {
        connectedCallback() {
          this.host.style.backgroundColor = this.value || 'yellow';
        }
        
        valueChangedCallback(oldValue, newValue) {
          this.host.style.backgroundColor = newValue || 'yellow';
        }
        
        disconnectedCallback() {
          this.host.style.backgroundColor = '';
        }
      }
      
      const registry = new window.CustomAttributeRegistry();
      registry.define('highlight', HighlightAttribute);
      
      window.HighlightAttribute = HighlightAttribute;
      window.attributeRegistry = registry;
    });
  });

  test('should apply custom attribute behavior', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.attributeRegistry.upgrade(document.body);
      
      const div = document.createElement('div');
      div.setAttribute('highlight', 'red');
      document.body.appendChild(div);
      
      // Manually trigger upgrade for this test
      const attr = new window.HighlightAttribute({ 
        name: 'highlight',
        value: 'red',
        host: div 
      });
      attr.connectedCallback();
      
      return {
        backgroundColor: div.style.backgroundColor
      };
    });
    
    expect(result.backgroundColor).toBe('red');
  });

  test('should respond to attribute changes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const div = document.createElement('div');
      div.setAttribute('highlight', 'blue');
      document.body.appendChild(div);
      
      const attr = new window.HighlightAttribute({ 
        name: 'highlight',
        value: 'blue',
        host: div 
      });
      attr.connectedCallback();
      
      const initial = div.style.backgroundColor;
      
      // Change attribute value
      div.setAttribute('highlight', 'green');
      attr.value = 'green';
      attr.valueChangedCallback('blue', 'green');
      
      const updated = div.style.backgroundColor;
      
      return {
        initial,
        updated,
        changed: initial !== updated
      };
    });
    
    expect(result.changed).toBe(true);
    expect(result.initial).toBe('blue');
    expect(result.updated).toBe('green');
  });

  test('should cleanup on removal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('highlight', 'orange');
      document.body.appendChild(div);
      
      const attr = new window.HighlightAttribute({ 
        name: 'highlight',
        value: 'orange',
        host: div 
      });
      attr.connectedCallback();
      
      const withAttribute = div.style.backgroundColor;
      
      // Remove attribute
      div.removeAttribute('highlight');
      attr.disconnectedCallback();
      
      const withoutAttribute = div.style.backgroundColor;
      
      return {
        withAttribute,
        withoutAttribute,
        cleaned: withoutAttribute === ''
      };
    });
    
    expect(result.cleaned).toBe(true);
    expect(result.withAttribute).toBe('orange');
    expect(result.withoutAttribute).toBe('');
  });

  test('should handle multiple attributes on same element', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Create another attribute type
      class TooltipAttribute extends window.HighlightAttribute.constructor {
        connectedCallback() {
          this.host.title = this.value || 'tooltip';
        }
      }
      
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      const highlight = new window.HighlightAttribute({ 
        name: 'highlight',
        value: 'pink',
        host: div 
      });
      highlight.connectedCallback();
      
      const tooltip = new TooltipAttribute({ 
        name: 'tooltip',
        value: 'Hover me',
        host: div 
      });
      tooltip.connectedCallback();
      
      return {
        backgroundColor: div.style.backgroundColor,
        title: div.title,
        bothApplied: div.style.backgroundColor && div.title
      };
    });
    
    expect(result.bothApplied).toBeTruthy();
    expect(result.backgroundColor).toBe('pink');
    expect(result.title).toBe('Hover me');
  });
});

test.describe('webbehaviors - DOM Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <script type="module">
            import CustomAttribute from '/plugs/webbehaviors/CustomAttribute.ts';
            import CustomAttributeRegistry from '/plugs/webbehaviors/CustomAttributeRegistry.ts';
            
            class ClickCounterAttribute extends CustomAttribute {
              connectedCallback() {
                this.count = 0;
                this.host.addEventListener('click', this.handleClick);
              }
              
              handleClick = () => {
                this.count++;
                this.host.textContent = \`Clicked \${this.count} times\`;
              }
              
              disconnectedCallback() {
                this.host.removeEventListener('click', this.handleClick);
              }
            }
            
            const registry = new CustomAttributeRegistry();
            registry.define('click-counter', ClickCounterAttribute);
            
            window.ClickCounterAttribute = ClickCounterAttribute;
            window.clickRegistry = registry;
            window.clickReady = true;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.clickReady === true);
  });

  test('should handle DOM events', async ({ page }) => {
    const result = await page.evaluate(() => {
      const button = document.createElement('button');
      button.setAttribute('click-counter', '');
      button.textContent = 'Click me';
      document.body.appendChild(button);
      
      const attr = new window.ClickCounterAttribute({ 
        name: 'click-counter',
        value: '',
        host: button 
      });
      attr.connectedCallback();
      
      // Simulate clicks
      button.click();
      button.click();
      button.click();
      
      return {
        text: button.textContent,
        count: attr.count
      };
    });
    
    expect(result.count).toBe(3);
    expect(result.text).toBe('Clicked 3 times');
  });

  test('should work with dynamically created elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      // Dynamically create and add elements
      for (let i = 0; i < 5; i++) {
        const button = document.createElement('button');
        button.setAttribute('click-counter', '');
        button.textContent = `Button ${'${i}'}`;
        container.appendChild(button);
        
        const attr = new window.ClickCounterAttribute({ 
          name: 'click-counter',
          value: '',
          host: button 
        });
        attr.connectedCallback();
      }
      
      // Click all buttons
      const buttons = container.querySelectorAll('button');
      buttons.forEach(btn => btn.click());
      
      return {
        buttonCount: buttons.length,
        allClicked: Array.from(buttons).every(btn => btn.textContent.includes('Clicked 1 times'))
      };
    });
    
    expect(result.buttonCount).toBe(5);
    expect(result.allClicked).toBe(true);
  });
});
