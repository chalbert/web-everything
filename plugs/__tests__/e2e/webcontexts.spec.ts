/**
 * E2E Tests for webcontexts
 * 
 * Tests context propagation system in real browsers.
 */

import { test, expect } from '@playwright/test';

test.describe('webcontexts - Context Propagation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webcontexts.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    // Define test context in page
    await page.evaluate(() => {
      class ThemeContext extends window.CustomContext {
        constructor(options) {
          super(options);
          this.defaultValue = { theme: 'light', color: 'blue' };
        }
      }
      
      const contextRegistry = new window.CustomContextRegistry();
      contextRegistry.define('theme', ThemeContext);
      
      window.ThemeContext = ThemeContext;
      window.contextRegistry = contextRegistry;
    });
  });

  test('should provide and consume context', async ({ page }) => {
    const result = await page.evaluate(() => {
      const provider = new window.ThemeContext({ value: { theme: 'dark', color: 'red' } });
      document.body.appendChild(provider);
      
      const consumer = document.createElement('div');
      provider.appendChild(consumer);
      
      const context = consumer.consumeContext?.('theme');
      
      return {
        theme: context?.theme,
        color: context?.color
      };
    });
    
    expect(result.theme).toBe('dark');
    expect(result.color).toBe('red');
  });

  test('should use default value when no provider', async ({ page }) => {
    const result = await page.evaluate(() => {
      const consumer = document.createElement('div');
      document.body.appendChild(consumer);
      
      const context = consumer.consumeContext?.('theme');
      
      return {
        theme: context?.theme,
        color: context?.color,
        isDefault: context?.theme === 'light'
      };
    });
    
    expect(result.isDefault).toBe(true);
    expect(result.theme).toBe('light');
    expect(result.color).toBe('blue');
  });

  test('should handle nested context providers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const outerProvider = new window.ThemeContext({ 
        value: { theme: 'dark', color: 'red' } 
      });
      document.body.appendChild(outerProvider);
      
      const innerProvider = new window.ThemeContext({ 
        value: { theme: 'light', color: 'green' } 
      });
      outerProvider.appendChild(innerProvider);
      
      const consumer = document.createElement('div');
      innerProvider.appendChild(consumer);
      
      const context = consumer.consumeContext?.('theme');
      
      return {
        theme: context?.theme,
        color: context?.color
      };
    });
    
    // Should get closest provider (inner)
    expect(result.theme).toBe('light');
    expect(result.color).toBe('green');
  });

  test('should update when context changes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const provider = new window.ThemeContext({ 
        value: { theme: 'dark', color: 'red' } 
      });
      document.body.appendChild(provider);
      
      const consumer = document.createElement('div');
      provider.appendChild(consumer);
      
      const initial = consumer.consumeContext?.('theme');
      
      // Update context
      provider.value = { theme: 'light', color: 'blue' };
      
      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const updated = consumer.consumeContext?.('theme');
      
      return {
        initialTheme: initial?.theme,
        updatedTheme: updated?.theme,
        changed: initial?.theme !== updated?.theme
      };
    });
    
    expect(result.changed).toBe(true);
    expect(result.initialTheme).toBe('dark');
    expect(result.updatedTheme).toBe('light');
  });

  test('should work with dynamic tree mutations', async ({ page }) => {
    const result = await page.evaluate(() => {
      const provider = new window.ThemeContext({ 
        value: { theme: 'dark', color: 'red' } 
      });
      document.body.appendChild(provider);
      
      const consumer = document.createElement('div');
      const intermediate = document.createElement('div');
      
      // Build tree: provider -> intermediate -> consumer
      provider.appendChild(intermediate);
      intermediate.appendChild(consumer);
      
      const withIntermediate = consumer.consumeContext?.('theme');
      
      // Restructure: provider -> consumer (skip intermediate)
      provider.removeChild(intermediate);
      provider.appendChild(consumer);
      
      const withoutIntermediate = consumer.consumeContext?.('theme');
      
      return {
        beforeTheme: withIntermediate?.theme,
        afterTheme: withoutIntermediate?.theme,
        stillWorks: withoutIntermediate?.theme === 'dark'
      };
    });
    
    expect(result.stillWorks).toBe(true);
    expect(result.beforeTheme).toBe('dark');
    expect(result.afterTheme).toBe('dark');
  });
});

test.describe('webcontexts - Multiple Contexts', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <script type="module">
            import CustomContext from '/plugs/webcontexts/CustomContext.ts';
            import CustomContextRegistry from '/plugs/webcontexts/CustomContextRegistry.ts';
            import { applyContextPatches } from '/plugs/webcontexts/Node.contexts.patch.ts';
            
            applyContextPatches();
            
            class ThemeContext extends CustomContext {
              constructor(options) {
                super(options);
                this.defaultValue = { theme: 'light' };
              }
            }
            
            class UserContext extends CustomContext {
              constructor(options) {
                super(options);
                this.defaultValue = { name: 'Guest' };
              }
            }
            
            const registry = new CustomContextRegistry();
            registry.define('theme', ThemeContext);
            registry.define('user', UserContext);
            
            window.ThemeContext = ThemeContext;
            window.UserContext = UserContext;
            window.multiContextReady = true;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.multiContextReady === true);
  });

  test('should handle multiple independent contexts', async ({ page }) => {
    const result = await page.evaluate(() => {
      const themeProvider = new window.ThemeContext({ value: { theme: 'dark' } });
      const userProvider = new window.UserContext({ value: { name: 'Alice' } });
      
      themeProvider.appendChild(userProvider);
      document.body.appendChild(themeProvider);
      
      const consumer = document.createElement('div');
      userProvider.appendChild(consumer);
      
      const theme = consumer.consumeContext?.('theme');
      const user = consumer.consumeContext?.('user');
      
      return {
        theme: theme?.theme,
        userName: user?.name,
        bothWork: theme && user
      };
    });
    
    expect(result.bothWork).toBeTruthy();
    expect(result.theme).toBe('dark');
    expect(result.userName).toBe('Alice');
  });

  test('should handle overlapping context scopes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const outerTheme = new window.ThemeContext({ value: { theme: 'dark' } });
      const outerUser = new window.UserContext({ value: { name: 'Bob' } });
      
      outerTheme.appendChild(outerUser);
      document.body.appendChild(outerTheme);
      
      const innerTheme = new window.ThemeContext({ value: { theme: 'light' } });
      outerUser.appendChild(innerTheme);
      
      const consumer = document.createElement('div');
      innerTheme.appendChild(consumer);
      
      const theme = consumer.consumeContext?.('theme');
      const user = consumer.consumeContext?.('user');
      
      return {
        theme: theme?.theme,
        userName: user?.name,
        themeIsInner: theme?.theme === 'light'
      };
    });
    
    expect(result.themeIsInner).toBe(true);
    expect(result.theme).toBe('light');
    expect(result.userName).toBe('Bob');
  });
});
