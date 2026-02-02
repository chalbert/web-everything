/**
 * E2E Tests for webinjectors
 * 
 * Tests dependency injection system in real browsers.
 */

import { test, expect } from '@playwright/test';

test.describe('webinjectors - Dependency Injection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webinjectors.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
  });

  test('should provide and consume dependencies', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      document.body.appendChild(root);
      
      // Provide a service
      const service = { name: 'TestService', value: 42 };
      root.provide('testService', service);
      
      // Create child element
      const child = document.createElement('div');
      root.appendChild(child);
      
      // Consume from child
      const consumed = child.consume?.('testService');
      
      return {
        provided: service,
        consumed: consumed,
        match: consumed?.value === service.value
      };
    });
    
    expect(result.match).toBe(true);
    expect(result.consumed.value).toBe(42);
  });

  test('should handle multi-level injection', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      document.body.appendChild(root);
      root.provide('level', 'root');
      
      const level1 = new window.HTMLInjector();
      level1.provide('level', 'level1');
      root.appendChild(level1);
      
      const level2 = document.createElement('div');
      level1.appendChild(level2);
      
      return {
        fromLevel2: level2.consume?.('level'),
        fromLevel1: level1.consume?.('level'),
        fromRoot: root.consume?.('level')
      };
    });
    
    expect(result.fromLevel2).toBe('level1');
    expect(result.fromLevel1).toBe('level1');
    expect(result.fromRoot).toBe('root');
  });

  test('should override parent providers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      document.body.appendChild(root);
      root.provide('config', { theme: 'dark' });
      
      const child = new window.HTMLInjector();
      child.provide('config', { theme: 'light' });
      root.appendChild(child);
      
      const grandchild = document.createElement('div');
      child.appendChild(grandchild);
      
      return {
        rootConfig: root.consume?.('config'),
        childConfig: child.consume?.('config'),
        grandchildConfig: grandchild.consume?.('config')
      };
    });
    
    expect(result.rootConfig.theme).toBe('dark');
    expect(result.childConfig.theme).toBe('light');
    expect(result.grandchildConfig.theme).toBe('light');
  });

  test('should work with dynamic DOM manipulation', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      root.provide('dynamicService', { id: 123 });
      document.body.appendChild(root);
      
      // Add element after root is in DOM
      const child = document.createElement('div');
      child.id = 'dynamic-child';
      root.appendChild(child);
      
      // Remove and re-add
      root.removeChild(child);
      root.appendChild(child);
      
      const service = child.consume?.('dynamicService');
      
      return {
        serviceId: service?.id,
        elementInDom: document.getElementById('dynamic-child') !== null
      };
    });
    
    expect(result.serviceId).toBe(123);
    expect(result.elementInDom).toBe(true);
  });

  test('should handle disconnected elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      root.provide('service', { value: 'test' });
      
      const child = document.createElement('div');
      root.appendChild(child);
      
      const beforeRemoval = child.consume?.('service');
      
      root.removeChild(child);
      
      const afterRemoval = child.consume?.('service');
      
      return {
        beforeValue: beforeRemoval?.value,
        afterIsNull: afterRemoval === null
      };
    });
    
    expect(result.beforeValue).toBe('test');
    expect(result.afterIsNull).toBe(true);
  });
});

test.describe('webinjectors - Performance', () => {
  test('should handle large DOM trees efficiently', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      document.body.appendChild(root);
      root.provide('sharedService', { data: 'shared' });
      
      const startTime = performance.now();
      
      // Create 100 nested elements
      let current = root;
      for (let i = 0; i < 100; i++) {
        const child = document.createElement('div');
        current.appendChild(child);
        current = child;
      }
      
      // Consume from deepest element
      const service = current.consume?.('sharedService');
      
      const endTime = performance.now();
      
      return {
        timeMs: endTime - startTime,
        serviceData: service?.data,
        treeDepth: 100
      };
    });
    
    expect(result.serviceData).toBe('shared');
    expect(result.timeMs).toBeLessThan(100); // Should be fast
  });

  test('should handle many siblings efficiently', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = new window.HTMLInjector();
      document.body.appendChild(root);
      root.provide('service', { id: 1 });
      
      const startTime = performance.now();
      
      // Create 1000 sibling elements
      for (let i = 0; i < 1000; i++) {
        const child = document.createElement('div');
        root.appendChild(child);
      }
      
      // Check each can consume
      const children = Array.from(root.children);
      const allCanConsume = children.every(child => child.consume?.('service')?.id === 1);
      
      const endTime = performance.now();
      
      return {
        timeMs: endTime - startTime,
        allCanConsume,
        childCount: children.length
      };
    });
    
    expect(result.allCanConsume).toBe(true);
    expect(result.childCount).toBe(1000);
    expect(result.timeMs).toBeLessThan(500);
  });
});
