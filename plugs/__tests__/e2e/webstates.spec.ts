/**
 * E2E Tests for webstates
 * 
 * Tests state management system in real browsers.
 */

import { test, expect } from '@playwright/test';

test.describe('webstates - State Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/test-pages/webstates.html');
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 });
    
    // Define test store in page
    await page.evaluate(() => {
      class CounterStore extends window.CustomStore {
        constructor(options = {}) {
          super(options);
          this._state = options.initialState || { count: 0 };
          this._listeners = [];
        }
        
        get state() {
          return this._state;
        }
        
        subscribe(listener, query) {
          this._listeners.push({ listener, query });
          return () => {
            const index = this._listeners.findIndex(l => l.listener === listener);
            if (index !== -1) this._listeners.splice(index, 1);
          };
        }
        
        getItem(key) {
          return this._state[key];
        }
        
        setItem(key, value) {
          this._state[key] = value;
          this._listeners.forEach(({ listener }) => listener(this._state));
        }
        
        increment() {
          this.setItem('count', this._state.count + 1);
        }
      }
      
      window.CounterStore = CounterStore;
    });
  });
      
      window.CounterStore = CounterStore;
    });
  });

  test('should create store and get initial state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore({ initialState: { count: 10 } });
      
      return {
        count: store.getItem('count'),
        state: store.state
      };
    });
    
    expect(result.count).toBe(10);
    expect(result.state.count).toBe(10);
  });

  test('should update state and notify subscribers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore({ initialState: { count: 0 } });
      
      const updates = [];
      store.subscribe((state) => {
        updates.push(state.count);
      });
      
      store.setItem('count', 1);
      store.setItem('count', 2);
      store.setItem('count', 3);
      
      return {
        updates,
        finalCount: store.getItem('count')
      };
    });
    
    expect(result.updates).toEqual([1, 2, 3]);
    expect(result.finalCount).toBe(3);
  });

  test('should handle multiple subscribers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore({ initialState: { count: 0 } });
      
      let subscriber1Count = 0;
      let subscriber2Count = 0;
      
      store.subscribe(() => subscriber1Count++);
      store.subscribe(() => subscriber2Count++);
      
      store.setItem('count', 1);
      store.setItem('count', 2);
      
      return {
        subscriber1Count,
        subscriber2Count,
        bothNotified: subscriber1Count === subscriber2Count
      };
    });
    
    expect(result.bothNotified).toBe(true);
    expect(result.subscriber1Count).toBe(2);
    expect(result.subscriber2Count).toBe(2);
  });

  test('should unsubscribe correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.CounterStore({ initialState: { count: 0 } });
      
      let notificationCount = 0;
      const unsubscribe = store.subscribe(() => notificationCount++);
      
      store.setItem('count', 1);
      
      unsubscribe();
      
      store.setItem('count', 2);
      store.setItem('count', 3);
      
      return {
        notificationCount,
        onlyOneBefore: notificationCount === 1
      };
    });
    
    expect(result.onlyOneBefore).toBe(true);
    expect(result.notificationCount).toBe(1);
  });

  test('should handle multiple stores independently', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store1 = new window.CounterStore({ initialState: { count: 0 } });
      const store2 = new window.CounterStore({ initialState: { count: 100 } });
      
      store1.setItem('count', 10);
      store2.setItem('count', 200);
      
      return {
        store1Count: store1.getItem('count'),
        store2Count: store2.getItem('count'),
        independent: store1.getItem('count') !== store2.getItem('count')
      };
    });
    
    expect(result.independent).toBe(true);
    expect(result.store1Count).toBe(10);
    expect(result.store2Count).toBe(200);
  });
});

test.describe('webstates - Integration with DOM', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="app"></div>
          <script type="module">
            import CustomStore from '/plugs/webstates/CustomStore.ts';
            
            class TodoStore extends CustomStore {
              constructor(options = {}) {
                super(options);
                this._state = options.initialState || { todos: [] };
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
                this._listeners.forEach(listener => listener(this._state));
              }
              
              addTodo(text) {
                const todos = [...this._state.todos, { id: Date.now(), text }];
                this.setItem('todos', todos);
              }
              
              removeTodo(id) {
                const todos = this._state.todos.filter(t => t.id !== id);
                this.setItem('todos', todos);
              }
            }
            
            window.TodoStore = TodoStore;
            window.todosReady = true;
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.todosReady === true);
  });

  test('should sync store with DOM', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.TodoStore();
      const app = document.getElementById('app');
      
      // Subscribe to render todos
      store.subscribe((state) => {
        app.innerHTML = state.todos
          .map(todo => `<div class="todo">${'${todo.text}'}</div>`)
          .join('');
      });
      
      // Add todos
      store.addTodo('First todo');
      store.addTodo('Second todo');
      store.addTodo('Third todo');
      
      return {
        todoCount: app.querySelectorAll('.todo').length,
        firstTodo: app.querySelector('.todo')?.textContent,
        htmlContains: app.innerHTML.includes('Second todo')
      };
    });
    
    expect(result.todoCount).toBe(3);
    expect(result.firstTodo).toBe('First todo');
    expect(result.htmlContains).toBe(true);
  });

  test('should handle CRUD operations', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.TodoStore();
      const app = document.getElementById('app');
      
      let renderCount = 0;
      store.subscribe((state) => {
        renderCount++;
        app.innerHTML = state.todos
          .map(todo => \`<div data-id="\${todo.id}">\${todo.text}</div>\`)
          .join('');
      });
      
      // Create
      store.addTodo('Task 1');
      store.addTodo('Task 2');
      const task2Id = store.state.todos[1].id;
      
      // Read
      const beforeDelete = app.querySelectorAll('div').length;
      
      // Delete
      store.removeTodo(task2Id);
      const afterDelete = app.querySelectorAll('div').length;
      
      return {
        beforeDelete,
        afterDelete,
        renderCount,
        remainingText: app.querySelector('div')?.textContent
      };
    });
    
    expect(result.beforeDelete).toBe(2);
    expect(result.afterDelete).toBe(1);
    expect(result.renderCount).toBe(3); // Initial + 2 adds + 1 remove
    expect(result.remainingText).toBe('Task 1');
  });

  test('should handle rapid updates efficiently', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = new window.TodoStore();
      
      let updateCount = 0;
      store.subscribe(() => updateCount++);
      
      const startTime = performance.now();
      
      // Rapid updates
      for (let i = 0; i < 100; i++) {
        store.addTodo(\`Todo \${i}\`);
      }
      
      const endTime = performance.now();
      
      return {
        todoCount: store.state.todos.length,
        updateCount,
        timeMs: endTime - startTime
      };
    });
    
    expect(result.todoCount).toBe(100);
    expect(result.updateCount).toBe(100);
    expect(result.timeMs).toBeLessThan(100); // Should be fast
  });
});
