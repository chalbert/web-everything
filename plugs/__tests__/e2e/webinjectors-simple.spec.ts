/**
 * E2E Tests for webinjectors - Simplified
 * 
 * Tests dependency injection using the actual API.
 */

import { test, expect } from '@playwright/test';

test.describe('webinjectors - Basic Dependency Injection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webinjectors.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
  });

  test('should create injector root and attach to document', async ({ page }) => {
    const result = await page.evaluate(() => {
      const injectorRoot = new window.InjectorRoot();
      injectorRoot.attach(document);
      (window as any).injectors = injectorRoot;
      
      return {
        hasRoot: injectorRoot !== null,
        attachedToDocument: injectorRoot !== undefined
      };
    });
    
    expect(result.hasRoot).toBe(true);
    expect(result.attachedToDocument).toBe(true);
  });

  test('should track element injectors', async ({ page }) => {
    const result = await page.evaluate(() => {
      const injectorRoot = new window.InjectorRoot();
      injectorRoot.attach(document);
      (window as any).injectors = injectorRoot;
      
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const injector = injectorRoot.ensureInjector(element);
      const retrieved = injectorRoot.getInjectorOf(element);
      
      return {
        hasInjector: injector !== null,
        retrieved: retrieved !== null,
        same: injector === retrieved
      };
    });
    
    expect(result.hasInjector).toBe(true);
    expect(result.retrieved).toBe(true);
    expect(result.same).toBe(true);
  });

  test('should provide and consume through injector', async ({ page }) => {
    const result = await page.evaluate(() => {
      const injectorRoot = new window.InjectorRoot();
      injectorRoot.attach(document);
      (window as any).injectors = injectorRoot;
      
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      
      const injector = injectorRoot.ensureInjector(parent);
      const service = { name: 'TestService', value: 42 };
      injector.set('testService', service);
      
      const child = document.createElement('div');
      parent.appendChild(child);
      
      const childInjector = (child as any).getClosestInjector?.();
      const consumed = childInjector?.get('testService');
      
      return {
        provided: service,
        consumed: consumed,
        match: consumed?.value === service.value
      };
    });
    
    expect(result.match).toBe(true);
    expect(result.consumed.value).toBe(42);
  });
});
