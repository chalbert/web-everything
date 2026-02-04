/**
 * Unit tests for SimpleStore
 */

import { describe, it, expect, vi } from 'vitest';
import SimpleStore from '../../../stores/simple/SimpleStore';

describe('SimpleStore', () => {
  describe('basic functionality', () => {
    it('should initialize with state', () => {
      const store = new SimpleStore({ count: 0, name: 'test' });

      expect(store.state).toEqual({ count: 0, name: 'test' });
      expect(store.getItem('count')).toBe(0);
      expect(store.getItem('name')).toBe('test');
    });

    it('should set and get items', () => {
      const store = new SimpleStore({ count: 0 });

      store.setItem('count', 5);
      expect(store.getItem('count')).toBe(5);
      expect(store.state.count).toBe(5);
    });

    it('should notify listeners on setItem', () => {
      const store = new SimpleStore({ count: 0 });
      const listener = vi.fn();

      store.subscribe(listener);
      store.setItem('count', 10);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ count: 10 });
    });

    it('should unsubscribe correctly', () => {
      const store = new SimpleStore({ count: 0 });
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);
      store.setItem('count', 1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.setItem('count', 2);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('dot-notation paths', () => {
    it('should get nested values with dot notation', () => {
      const store = new SimpleStore({
        user: { name: 'John', profile: { age: 30 } }
      });

      expect(store.getItem('user.name')).toBe('John');
      expect(store.getItem('user.profile.age')).toBe(30);
    });

    it('should set nested values with dot notation', () => {
      const store = new SimpleStore({
        user: { name: '', email: '' }
      });

      store.setItem('user.name', 'Jane');
      store.setItem('user.email', 'jane@example.com');

      expect(store.state.user).toEqual({ name: 'Jane', email: 'jane@example.com' });
    });

    it('should create intermediate objects if needed', () => {
      const store = new SimpleStore({} as Record<string, unknown>);

      store.setItem('deeply.nested.value', 42);

      expect(store.state).toEqual({
        deeply: { nested: { value: 42 } }
      });
    });

    it('should return undefined for non-existent paths', () => {
      const store = new SimpleStore({ user: { name: 'John' } });

      expect(store.getItem('user.nonexistent')).toBeUndefined();
      expect(store.getItem('nonexistent.path')).toBeUndefined();
    });
  });

  describe('onBeforeNotify hook', () => {
    it('should call hook before notifying listeners', () => {
      const callOrder: string[] = [];

      const store = new SimpleStore(
        { todos: [], total: 0 } as { todos: unknown[]; total: number },
        (state) => {
          callOrder.push('hook');
          state.total = state.todos.length;
        }
      );

      store.subscribe(() => callOrder.push('listener'));
      store.setItem('todos', [1, 2, 3]);

      expect(callOrder).toEqual(['hook', 'listener']);
      expect(store.state.total).toBe(3);
    });

    it('should compute derived state correctly', () => {
      interface TodoState {
        todos: Array<{ id: number; completed: boolean }>;
        totalTodos: number;
        activeTodos: number;
        completedTodos: number;
      }

      const store = new SimpleStore<TodoState>(
        { todos: [], totalTodos: 0, activeTodos: 0, completedTodos: 0 },
        (state) => {
          state.totalTodos = state.todos.length;
          state.activeTodos = state.todos.filter(t => !t.completed).length;
          state.completedTodos = state.todos.filter(t => t.completed).length;
        }
      );

      store.setItem('todos', [
        { id: 1, completed: false },
        { id: 2, completed: true },
        { id: 3, completed: false }
      ]);

      expect(store.getItem('totalTodos')).toBe(3);
      expect(store.getItem('activeTodos')).toBe(2);
      expect(store.getItem('completedTodos')).toBe(1);
    });
  });

  describe('multiple listeners', () => {
    it('should notify all listeners', () => {
      const store = new SimpleStore({ count: 0 });
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);
      store.subscribe(listener3);

      store.setItem('count', 1);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple unsubscribes', () => {
      const store = new SimpleStore({ count: 0 });
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = store.subscribe(listener1);
      const unsub2 = store.subscribe(listener2);

      store.setItem('count', 1);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      unsub1();
      store.setItem('count', 2);
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called again

      unsub2();
      store.setItem('count', 3);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2); // Not called again
    });
  });
});
