/**
 * E2E Full Stack Integration Tests
 * 
 * Tests all plugs working together in real browsers.
 */

import { test, expect } from '@playwright/test';

test.describe('Full Stack E2E - Complete Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Full Stack E2E Test</title>
          <style>
            .highlighted { background-color: yellow; }
            .theme-dark { background: #333; color: #fff; }
            .theme-light { background: #fff; color: #000; }
          </style>
        </head>
        <body>
          <div id="app"></div>
          <script type="module">
            // Import all plugs
            import CustomElement from '/plugs/webcomponents/CustomElement.ts';
            import { applyPatches as applyWebcomponentsPatches } from '/plugs/webcomponents/index.ts';
            import CustomElementRegistry from '/plugs/webregistries/CustomElementRegistry.ts';
            import InjectorRoot from '/plugs/webinjectors/InjectorRoot.ts';
            import HTMLInjector from '/plugs/webinjectors/HTMLInjector.ts';
            import { applyNodeInjectorsPatches } from '/plugs/webinjectors/Node.injectors.patch.ts';
            import CustomContext from '/plugs/webcontexts/CustomContext.ts';
            import CustomContextRegistry from '/plugs/webcontexts/CustomContextRegistry.ts';
            import { applyContextPatches } from '/plugs/webcontexts/Node.contexts.patch.ts';
            import CustomStore from '/plugs/webstates/CustomStore.ts';
            
            // Apply all patches
            applyWebcomponentsPatches();
            applyNodeInjectorsPatches();
            applyContextPatches();
            
            // Create registries
            const elementRegistry = new CustomElementRegistry();
            const contextRegistry = new CustomContextRegistry();
            
            // Theme Context
            class ThemeContext extends CustomContext {
              constructor(options) {
                super(options);
                this.defaultValue = { theme: 'light' };
              }
            }
            contextRegistry.define('theme', ThemeContext);
            
            // App Store
            class AppStore extends CustomStore {
              constructor(options = {}) {
                super(options);
                this._state = options.initialState || { count: 0, items: [] };
                this._listeners = [];
              }
              
              get state() { return this._state; }
              
              subscribe(listener) {
                this._listeners.push(listener);
                return () => {
                  const index = this._listeners.indexOf(listener);
                  if (index !== -1) this._listeners.splice(index, 1);
                };
              }
              
              getItem(key) { return this._state[key]; }
              
              setItem(key, value) {
                this._state[key] = value;
                this._listeners.forEach(l => l(this._state));
              }
              
              increment() {
                this.setItem('count', this._state.count + 1);
              }
            }
            
            // Counter Component
            class CounterComponent extends CustomElement {
              constructor(options) {
                super(options);
                this.store = null;
              }
              
              connectedCallback() {
                // Consume theme context
                const theme = this.consumeContext?.('theme');
                this.className = theme ? 'theme-' + theme.theme : '';
                
                // Consume store from injector
                this.store = this.consume?.('appStore');
                
                if (this.store) {
                  this.unsubscribe = this.store.subscribe(() => this.render());
                  this.render();
                }
                
                this.addEventListener('click', () => {
                  if (this.store) this.store.increment();
                });
              }
              
              disconnectedCallback() {
                if (this.unsubscribe) this.unsubscribe();
              }
              
              render() {
                if (this.store) {
                  this.textContent = 'Count: ' + this.store.getItem('count');
                }
              }
            }
            
            elementRegistry.define('counter-component', CounterComponent);
            
            // Make available globally
            window.ThemeContext = ThemeContext;
            window.AppStore = AppStore;
            window.CounterComponent = CounterComponent;
            window.InjectorRoot = InjectorRoot;
            window.fullStackReady = true;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.fullStackReady === true);
  });

  test('should integrate all plugs in complete application', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Create app structure
      const root = new window.InjectorRoot();
      document.getElementById('app').appendChild(root);
      
      // Provide store
      const store = new window.AppStore({ initialState: { count: 0, items: [] } });
      root.provide('appStore', store);
      
      // Provide theme context
      const themeProvider = new window.ThemeContext({ value: { theme: 'dark' } });
      root.appendChild(themeProvider);
      
      // Create counter component
      const counter = new window.CounterComponent();
      themeProvider.appendChild(counter);
      
      // Initial state
      const initialCount = counter.textContent;
      const initialTheme = counter.className;
      
      // Simulate clicks
      counter.click();
      counter.click();
      counter.click();
      
      const afterClicks = counter.textContent;
      
      return {
        initialCount,
        initialTheme,
        afterClicks,
        incrementWorked: afterClicks.includes('3')
      };
    });
    
    expect(result.initialCount).toBe('Count: 0');
    expect(result.initialTheme).toContain('theme-dark');
    expect(result.incrementWorked).toBe(true);
    expect(result.afterClicks).toBe('Count: 3');
  });

  test('should handle context switching', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.InjectorRoot();
      document.getElementById('app').appendChild(root);
      
      const store = new window.AppStore();
      root.provide('appStore', store);
      
      // Start with light theme
      const lightTheme = new window.ThemeContext({ value: { theme: 'light' } });
      root.appendChild(lightTheme);
      
      const counter1 = new window.CounterComponent();
      lightTheme.appendChild(counter1);
      const theme1 = counter1.className;
      
      // Switch to dark theme
      const darkTheme = new window.ThemeContext({ value: { theme: 'dark' } });
      root.removeChild(lightTheme);
      root.appendChild(darkTheme);
      
      const counter2 = new window.CounterComponent();
      darkTheme.appendChild(counter2);
      const theme2 = counter2.className;
      
      return {
        lightTheme: theme1,
        darkTheme: theme2,
        different: theme1 !== theme2
      };
    });
    
    expect(result.different).toBe(true);
    expect(result.lightTheme).toContain('theme-light');
    expect(result.darkTheme).toContain('theme-dark');
  });

  test('should handle cloning with all features', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.InjectorRoot();
      document.getElementById('app').appendChild(root);
      
      const store = new window.AppStore({ initialState: { count: 5 } });
      root.provide('appStore', store);
      
      const original = new window.CounterComponent();
      root.appendChild(original);
      
      // Clone the component
      const clone = original.cloneNode(true);
      root.appendChild(clone);
      
      // Both should show same count
      return {
        originalText: original.textContent,
        cloneText: clone.textContent,
        bothConnected: original.textContent && clone.textContent,
        bothSame: original.textContent === clone.textContent
      };
    });
    
    expect(result.bothConnected).toBeTruthy();
    expect(result.bothSame).toBe(true);
    expect(result.originalText).toBe('Count: 5');
    expect(result.cloneText).toBe('Count: 5');
  });

  test('should handle multiple component instances with shared state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.InjectorRoot();
      document.getElementById('app').appendChild(root);
      
      const store = new window.AppStore({ initialState: { count: 0 } });
      root.provide('appStore', store);
      
      // Create multiple counters
      const counters = [];
      for (let i = 0; i < 3; i++) {
        const counter = new window.CounterComponent();
        root.appendChild(counter);
        counters.push(counter);
      }
      
      // Click first counter
      counters[0].click();
      counters[0].click();
      
      // All should update
      const allTexts = counters.map(c => c.textContent);
      const allSame = allTexts.every(t => t === 'Count: 2');
      
      return {
        allTexts,
        allSame,
        count: store.getItem('count')
      };
    });
    
    expect(result.allSame).toBe(true);
    expect(result.count).toBe(2);
    expect(result.allTexts).toEqual(['Count: 2', 'Count: 2', 'Count: 2']);
  });
});

test.describe('Full Stack E2E - Performance', () => {
  test('should handle large-scale application efficiently', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="app"></div>
          <script type="module">
            import InjectorRoot from '/plugs/webinjectors/InjectorRoot.ts';
            import { applyNodeInjectorsPatches } from '/plugs/webinjectors/Node.injectors.patch.ts';
            import CustomStore from '/plugs/webstates/CustomStore.ts';
            
            applyNodeInjectorsPatches();
            
            class SimpleStore extends CustomStore {
              constructor(options = {}) {
                super(options);
                this._state = options.initialState || { value: 0 };
                this._listeners = [];
              }
              get state() { return this._state; }
              subscribe(l) {
                this._listeners.push(l);
                return () => {
                  const i = this._listeners.indexOf(l);
                  if (i !== -1) this._listeners.splice(i, 1);
                };
              }
              getItem(k) { return this._state[k]; }
              setItem(k, v) {
                this._state[k] = v;
                this._listeners.forEach(l => l(this._state));
              }
            }
            
            window.SimpleStore = SimpleStore;
            window.InjectorRoot = InjectorRoot;
            window.perfReady = true;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.perfReady === true);
    
    const result = await page.evaluate(() => {
      const root = new window.InjectorRoot();
      document.getElementById('app').appendChild(root);
      
      const store = new window.SimpleStore({ initialState: { value: 0 } });
      root.provide('store', store);
      
      const startTime = performance.now();
      
      // Create 1000 elements that consume the store
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div');
        root.appendChild(div);
        
        const consumedStore = div.consume?.('store');
        if (consumedStore) {
          consumedStore.subscribe((state) => {
            div.textContent = `Value: ${'${state.value}'}`;
          });
        }
      }
      
      // Update store (should update all 1000 elements)
      store.setItem('value', 42);
      
      const endTime = performance.now();
      
      const firstChild = root.children[0];
      const lastChild = root.children[root.children.length - 1];
      
      return {
        timeMs: endTime - startTime,
        childCount: root.children.length,
        firstChildText: firstChild.textContent,
        lastChildText: lastChild.textContent,
        allUpdated: firstChild.textContent === lastChild.textContent
      };
    });
    
    expect(result.childCount).toBe(1000);
    expect(result.allUpdated).toBe(true);
    expect(result.firstChildText).toBe('Value: 42');
    expect(result.timeMs).toBeLessThan(2000); // Should complete within 2 seconds
  });
});
