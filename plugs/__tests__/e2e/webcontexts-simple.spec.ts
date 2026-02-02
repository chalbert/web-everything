/**
 * E2E Tests for webcontexts
 * 
 * Tests context propagation system using the actual API with injectors.
 */

import { test, expect } from '@playwright/test';

test.describe('webcontexts - Context Propagation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webcontexts.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    // Define test context
    await page.evaluate(() => {
      class ThemeContext extends window.CustomContext {
        initialValue = { theme: 'light', color: 'blue' };
      }
      
      const contextRegistry = new window.CustomContextRegistry();
      contextRegistry.define('theme', ThemeContext);
      
      window.ThemeContext = ThemeContext;
      window.contextRegistry = contextRegistry;
    });
  });

  test('should create context through injector system', async ({ page }) => {
    const result = await page.evaluate(() => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      // Setup injector with context registry
      window.injectorRoot.ensureInjector(container);
      const injector = window.injectorRoot.getInjectorOf(container);
      injector.set('customContextTypes', window.contextRegistry);
      
      // Create a context instance
      const context = container.createContext('theme');
      
      return {
        created: context !== undefined,
        isThemeContext: context instanceof window.ThemeContext,
        isCustomContext: context instanceof window.CustomContext,
        theme: context?.get('theme'),
        color: context?.get('color')
      };
    });
    
    expect(result.created).toBe(true);
    expect(result.isThemeContext).toBe(true);
    expect(result.isCustomContext).toBe(true);
    expect(result.theme).toBe('light');
    expect(result.color).toBe('blue');
  });

  test('should store and retrieve context from injector', async ({ page }) => {
    const result = await page.evaluate(() => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      window.injectorRoot.ensureInjector(container);
      const injector = window.injectorRoot.getInjectorOf(container);
      injector.set('customContextTypes', window.contextRegistry);
      
      // Create and store context
      const context = container.createContext('theme');
      injector.set('customContexts:theme', context);
      
      // Retrieve it
      const retrieved = container.getContext('theme');
      
      return {
        stored: context !== undefined,
        retrieved: retrieved !== undefined,
        sameInstance: context === retrieved
      };
    });
    
    expect(result.stored).toBe(true);
    expect(result.retrieved).toBe(true);
    expect(result.sameInstance).toBe(true);
  });

  test('should traverse injector hierarchy to find context', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      parent.appendChild(child);
      document.body.appendChild(parent);
      
      // Setup parent with context
      window.injectorRoot.ensureInjector(parent);
      const parentInjector = window.injectorRoot.getInjectorOf(parent);
      parentInjector.set('customContextTypes', window.contextRegistry);
      
      const context = parent.createContext('theme');
      parentInjector.set('customContexts:theme', context);
      
      // Child should find parent's context
      const foundContext = child.getContext('theme');
      
      return {
        parentHasContext: context !== undefined,
        childFoundContext: foundContext !== undefined,
        sameInstance: context === foundContext,
        theme: foundContext?.get('theme')
      };
    });
    
    expect(result.parentHasContext).toBe(true);
    expect(result.childFoundContext).toBe(true);
    expect(result.sameInstance).toBe(true);
    expect(result.theme).toBe('light');
  });

  test('should update context values', async ({ page }) => {
    const result = await page.evaluate(() => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      window.injectorRoot.ensureInjector(container);
      const injector = window.injectorRoot.getInjectorOf(container);
      injector.set('customContextTypes', window.contextRegistry);
      
      const context = container.createContext('theme');
      injector.set('customContexts:theme', context);
      
      const beforeTheme = context.get('theme');
      const beforeColor = context.get('color');
      
      // Update values
      context.set('theme', 'dark');
      context.set('color', 'red');
      
      const afterTheme = context.get('theme');
      const afterColor = context.get('color');
      
      return {
        beforeTheme,
        beforeColor,
        afterTheme,
        afterColor,
        themeChanged: beforeTheme !== afterTheme,
        colorChanged: beforeColor !== afterColor
      };
    });
    
    expect(result.beforeTheme).toBe('light');
    expect(result.beforeColor).toBe('blue');
    expect(result.afterTheme).toBe('dark');
    expect(result.afterColor).toBe('red');
    expect(result.themeChanged).toBe(true);
    expect(result.colorChanged).toBe(true);
  });

  test('should support nested context providers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      parent.appendChild(child);
      document.body.appendChild(parent);
      
      // Setup parent context
      window.injectorRoot.ensureInjector(parent);
      const parentInjector = window.injectorRoot.getInjectorOf(parent);
      parentInjector.set('customContextTypes', window.contextRegistry);
      
      const parentContext = parent.createContext('theme');
      parentContext.set('theme', 'dark');
      parentInjector.set('customContexts:theme', parentContext);
      
      // Setup child context (overrides parent)
      window.injectorRoot.ensureInjector(child);
      const childInjector = window.injectorRoot.getInjectorOf(child);
      childInjector.set('customContextTypes', window.contextRegistry);
      
      const childContext = child.createContext('theme');
      childContext.set('theme', 'light');
      childInjector.set('customContexts:theme', childContext);
      
      // Child should get its own context
      const retrieved = child.getContext('theme');
      
      return {
        parentTheme: parentContext.get('theme'),
        childTheme: childContext.get('theme'),
        retrievedTheme: retrieved?.get('theme'),
        usesOwnContext: retrieved === childContext,
        notParentContext: retrieved !== parentContext
      };
    });
    
    expect(result.parentTheme).toBe('dark');
    expect(result.childTheme).toBe('light');
    expect(result.retrievedTheme).toBe('light');
    expect(result.usesOwnContext).toBe(true);
    expect(result.notParentContext).toBe(true);
  });
});
