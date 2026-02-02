/**
 * @file CustomStore.test.ts
 * @description Unit tests for CustomStore base class
 */

import { describe, it, expect } from 'vitest';
import CustomStore, {
  type StoreListener,
  type StoreUnsubscribe,
  type StoreOptions,
} from '../../CustomStore';

describe('CustomStore', () => {
  // Test store with basic state management
  interface TestState {
    count: number;
    name: string;
  }

  class TestStore extends CustomStore<TestState> {
    state: TestState = {
      count: 0,
      name: 'test',
    };

    private listeners: Set<StoreListener<TestState>> = new Set();

    subscribe(listener: StoreListener<TestState>): StoreUnsubscribe {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }

    getItem<K extends keyof TestState>(key: K): TestState[K] {
      return this.state[key];
    }

    setItem<K extends keyof TestState>(key: K, value: TestState[K]): void {
      this.state[key] = value;
      this.notify();
    }

    private notify(): void {
      this.listeners.forEach((listener) => listener(this.state));
    }
  }

  // Test store with query-based subscriptions
  class QueryStore extends CustomStore<TestState> {
    state: TestState = {
      count: 0,
      name: 'test',
    };

    private subscriptions: Array<{
      listener: StoreListener<TestState>;
      query?: any;
    }> = [];

    subscribe(
      listener: StoreListener<TestState>,
      query?: any
    ): StoreUnsubscribe {
      const subscription = { listener, query };
      this.subscriptions.push(subscription);
      return () => {
        const index = this.subscriptions.indexOf(subscription);
        if (index > -1) {
          this.subscriptions.splice(index, 1);
        }
      };
    }

    getItem<K extends keyof TestState>(key: K): TestState[K] {
      return this.state[key];
    }

    setItem<K extends keyof TestState>(key: K, value: TestState[K]): void {
      this.state[key] = value;
      this.notify(key);
    }

    private notify(key: keyof TestState): void {
      this.subscriptions.forEach(({ listener, query }) => {
        if (!query || query === key) {
          listener(this.state);
        }
      });
    }
  }

  describe('Construction', () => {
    it('should create instance with default options', () => {
      const store = new TestStore({});

      expect(store).toBeInstanceOf(TestStore);
      expect(store).toBeInstanceOf(CustomStore);
      expect(store.options).toEqual({});
    });

    it('should create instance with initial state option', () => {
      const initialState: TestState = { count: 10, name: 'initial' };
      const store = new TestStore({ initialState });

      expect(store.options.initialState).toEqual(initialState);
    });

    it('should store options', () => {
      const options = { initialState: { count: 5, name: 'test' } };
      const store = new TestStore(options);

      expect(store.options).toBe(options);
    });

    it('should initialize without options', () => {
      const store = new TestStore();

      expect(store.options).toEqual({});
    });
  });

  describe('state property', () => {
    it('should have accessible state', () => {
      const store = new TestStore({});

      expect(store.state).toBeDefined();
      expect(store.state.count).toBe(0);
      expect(store.state.name).toBe('test');
    });

    it('should be mutable', () => {
      const store = new TestStore({});

      store.state.count = 42;
      expect(store.state.count).toBe(42);
    });
  });

  describe('subscribe method', () => {
    it('should add listener', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      store.subscribe(listener);
      store.setItem('count', 1);

      expect(listener).toHaveBeenCalledWith(store.state);
    });

    it('should return unsubscribe function', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe correctly', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);
      unsubscribe();

      store.setItem('count', 1);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const store = new TestStore({});
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);
      store.setItem('count', 1);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should support query parameter', () => {
      const store = new QueryStore({});
      const listener = vi.fn();

      store.subscribe(listener, 'count');
      store.setItem('count', 1);

      expect(listener).toHaveBeenCalled();
    });

    it('should filter updates based on query', () => {
      const store = new QueryStore({});
      const countListener = vi.fn();
      const nameListener = vi.fn();

      store.subscribe(countListener, 'count');
      store.subscribe(nameListener, 'name');

      store.setItem('count', 1);

      expect(countListener).toHaveBeenCalled();
      expect(nameListener).not.toHaveBeenCalled();
    });
  });

  describe('getItem method', () => {
    it('should get item by key', () => {
      const store = new TestStore({});

      expect(store.getItem('count')).toBe(0);
      expect(store.getItem('name')).toBe('test');
    });

    it('should return updated value after setItem', () => {
      const store = new TestStore({});

      store.setItem('count', 42);
      expect(store.getItem('count')).toBe(42);
    });
  });

  describe('setItem method', () => {
    it('should set item by key', () => {
      const store = new TestStore({});

      store.setItem('count', 10);
      expect(store.state.count).toBe(10);
    });

    it('should notify subscribers', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      store.subscribe(listener);
      store.setItem('name', 'updated');

      expect(listener).toHaveBeenCalledWith(store.state);
    });

    it('should update multiple keys independently', () => {
      const store = new TestStore({});

      store.setItem('count', 1);
      store.setItem('name', 'one');

      expect(store.getItem('count')).toBe(1);
      expect(store.getItem('name')).toBe('one');
    });
  });

  describe('options property', () => {
    it('should be accessible', () => {
      const store = new TestStore({});

      expect(store.options).toBeDefined();
    });

    it('should contain initialState if provided', () => {
      const initialState: TestState = { count: 5, name: 'init' };
      const store = new TestStore({ initialState });

      expect(store.options.initialState).toEqual(initialState);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid updates', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      store.subscribe(listener);

      for (let i = 0; i < 100; i++) {
        store.setItem('count', i);
      }

      expect(listener).toHaveBeenCalledTimes(100);
      expect(store.getItem('count')).toBe(99);
    });

    it('should handle multiple subscribers with unsubscribe', () => {
      const store = new TestStore({});
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const unsub1 = store.subscribe(listener1);
      const unsub2 = store.subscribe(listener2);
      const unsub3 = store.subscribe(listener3);

      store.setItem('count', 1);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      unsub2();
      store.setItem('count', 2);
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(1); // Not called after unsubscribe
      expect(listener3).toHaveBeenCalledTimes(2);
    });

    it('should support complex state updates', () => {
      const store = new TestStore({});
      const updates: TestState[] = [];

      store.subscribe((state) => {
        updates.push({ ...state });
      });

      store.setItem('count', 1);
      store.setItem('name', 'one');
      store.setItem('count', 2);
      store.setItem('name', 'two');

      expect(updates).toHaveLength(4);
      expect(updates[0]).toEqual({ count: 1, name: 'test' });
      expect(updates[1]).toEqual({ count: 1, name: 'one' });
      expect(updates[2]).toEqual({ count: 2, name: 'one' });
      expect(updates[3]).toEqual({ count: 2, name: 'two' });
    });
  });

  describe('Edge cases', () => {
    it('should handle same value updates', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      store.subscribe(listener);
      store.setItem('count', 0); // Same value

      expect(listener).toHaveBeenCalled();
    });

    it('should handle unsubscribe without subscribe', () => {
      const store = new TestStore({});

      // Should not throw
      expect(() => {
        const unsub = () => {};
        unsub();
      }).not.toThrow();
    });

    it('should handle multiple unsubscribes', () => {
      const store = new TestStore({});
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('Type safety', () => {
    it('should enforce state key types', () => {
      const store = new TestStore({});

      // TypeScript should enforce these at compile time
      expect(typeof store.getItem('count')).toBe('number');
      expect(typeof store.getItem('name')).toBe('string');
    });

    it('should enforce state value types', () => {
      const store = new TestStore({});

      store.setItem('count', 42);
      store.setItem('name', 'value');

      expect(store.state.count).toBe(42);
      expect(store.state.name).toBe('value');
    });
  });
});
