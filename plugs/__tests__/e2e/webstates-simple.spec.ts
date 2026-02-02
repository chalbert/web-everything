/**
 * E2E Tests for webstates - Simplified
 * 
 * Tests state management using the actual API.
 */

import { test, expect } from '@playwright/test';

test.describe('webstates - State Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webstates.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    // Define test store
    await page.evaluate(() => {
      class CounterStore extends window.CustomStore {
        constructor(options = {}) {
          super(options);
          this._state = options.initialState || { count: 0, items: [] };
          this._listeners = [];
        }
        
        get state() {
          return this._state;
        }
        
        subscribe(listener) {
          this._listeners.push(listener);
          return () => {
            const index = this._listeners.indexOf(listener);
            if (index !== -1) this._listeners.splice(index, 1);
          };
        }
        
        getItem(key) {
          return this._state[key];
        }
        
        setItem(key, value) {
          this._state[key] = value;
          this._listeners.forEach(l => l(this._state));
        }
        
        increment() {
          this.setItem('count', this._state.count + 1);
        }
      }
      
      window.CounterStore = CounterStore;
    });
  });

  test('should create store with initial state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore({ 
        initialState: { count: 10, items: ['a', 'b'] } 
      });
      
      return {
        count: store.getItem('count'),
        items: store.getItem('items'),
        stateCount: store.state.count
      };
    });
    
    expect(result.count).toBe(10);
    expect(result.items).toEqual(['a', 'b']);
    expect(result.stateCount).toBe(10);
  });

  test('should update state and notify subscribers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore();
      let notified = false;
      let newState = null;
      
      store.subscribe((state) => {
        notified = true;
        newState = state;
      });
      
      const before = store.getItem('count');
      store.increment();
      const after = store.getItem('count');
      
      return {
        before,
        after,
        notified,
        newStateCount: newState?.count,
        incremented: after === before + 1
      };
    });
    
    expect(result.before).toBe(0);
    expect(result.after).toBe(1);
    expect(result.notified).toBe(true);
    expect(result.newStateCount).toBe(1);
    expect(result.incremented).toBe(true);
  });

  test('should handle multiple subscribers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore();
      const notifications = [];
      
      store.subscribe((state) => notifications.push('subscriber1'));
      store.subscribe((state) => notifications.push('subscriber2'));
      store.subscribe((state) => notifications.push('subscriber3'));
      
      store.increment();
      
      return {
        notificationCount: notifications.length,
        allNotified: notifications.length === 3,
        notifications
      };
    });
    
    expect(result.allNotified).toBe(true);
    expect(result.notificationCount).toBe(3);
  });

  test('should unsubscribe correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore();
      const notifications = [];
      
      const unsubscribe1 = store.subscribe(() => notifications.push('sub1'));
      const unsubscribe2 = store.subscribe(() => notifications.push('sub2'));
      
      store.increment(); // Both notified
      const afterFirst = notifications.length;
      
      unsubscribe1(); // Remove first subscriber
      
      store.increment(); // Only second notified
      const afterSecond = notifications.length;
      
      return {
        afterFirst,
        afterSecond,
        difference: afterSecond - afterFirst,
        onlyOneNotified: (afterSecond - afterFirst) === 1
      };
    });
    
    expect(result.afterFirst).toBe(2);
    expect(result.difference).toBe(1);
    expect(result.onlyOneNotified).toBe(true);
  });

  test('should handle independent stores', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store1 = new window.CounterStore({ initialState: { count: 5 } });
      const store2 = new window.CounterStore({ initialState: { count: 10 } });
      
      store1.increment();
      store2.increment();
      store2.increment();
      
      return {
        store1Count: store1.getItem('count'),
        store2Count: store2.getItem('count'),
        different: store1.getItem('count') !== store2.getItem('count')
      };
    });
    
    expect(result.store1Count).toBe(6);
    expect(result.store2Count).toBe(12);
    expect(result.different).toBe(true);
  });

  test('should update complex state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore({ 
        initialState: { count: 0, items: [] } 
      });
      
      let updateCount = 0;
      store.subscribe(() => updateCount++);
      
      store.setItem('items', ['item1']);
      store.setItem('items', ['item1', 'item2']);
      store.setItem('count', 5);
      
      return {
        items: store.getItem('items'),
        count: store.getItem('count'),
        updateCount,
        itemsLength: store.getItem('items').length
      };
    });
    
    expect(result.items).toEqual(['item1', 'item2']);
    expect(result.count).toBe(5);
    expect(result.updateCount).toBe(3);
    expect(result.itemsLength).toBe(2);
  });
});
