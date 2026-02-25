/**
 * @file webcontexts/__tests__/unit/CustomContext.test.ts
 * @description Unit tests for CustomContext base class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomContext, { type ImplementedContext } from '../../CustomContext';

// Mock context implementation
interface TestState {
  count: number;
  name: string;
}

class TestContext extends CustomContext<TestState> {
  initialValue = { count: 0, name: 'test' };
}

describe('CustomContext', () => {
  let context: TestContext;

  beforeEach(() => {
    context = new TestContext();
  });

  describe('construction', () => {
    it('should create context with undefined initial value', () => {
      const ctx = new TestContext();
      expect(ctx).toBeInstanceOf(CustomContext);
      expect(ctx.isAttached).toBe(false);
    });

    it('should create context with provided initial value', () => {
      const initialState = { count: 10, name: 'custom' };
      const ctx = new TestContext(initialState);
      expect(ctx.value).toEqual(initialState);
    });

    it('should use initialValue property when no constructor value provided', () => {
      const ctx = new TestContext();
      expect(ctx.value).toEqual({ count: 0, name: 'test' });
    });
  });

  describe('value management', () => {
    it('should get value', () => {
      context.value = { count: 5, name: 'updated' };
      expect(context.value).toEqual({ count: 5, name: 'updated' });
    });

    it('should set value', () => {
      const newValue = { count: 10, name: 'new' };
      context.value = newValue;
      expect(context.value).toEqual(newValue);
    });

    it('should get individual key', () => {
      context.value = { count: 7, name: 'test' };
      expect(context.get('count')).toBe(7);
      expect(context.get('name')).toBe('test');
    });

    it('should set individual key', () => {
      context.value = { count: 0, name: 'initial' };
      context.set('count', 42);
      expect(context.get('count')).toBe(42);
      expect(context.value.count).toBe(42);
    });

    it('should check key existence with has()', () => {
      context.value = { count: 5, name: 'test' };
      expect(context.has('count')).toBe(true);
      expect(context.has('name')).toBe(true);
    });
  });

  describe('Registry interface', () => {
    it('should return keys iterator', () => {
      context.value = { count: 1, name: 'test' };
      const keys = Array.from(context.keys());
      expect(keys).toContain('count');
      expect(keys).toContain('name');
    });

    it('should return size', () => {
      context.value = { count: 1, name: 'test' };
      expect(context.size).toBe(2);
    });

    it('should throw on delete()', () => {
      expect(() => context.delete()).toThrow('Method not implemented');
    });
  });

  describe('subscribe', () => {
    it('should return current value immediately', () => {
      context.value = { count: 5, name: 'test' };
      const handle = context.subscribe(null, () => {});
      expect(handle.value).toEqual({ count: 5, name: 'test' });
    });

    it('should notify callback when value changes', () => {
      context.value = { count: 5, name: 'initial' };
      const callback = vi.fn();
      context.subscribe(null, callback);

      const newValue = { count: 20, name: 'updated' };
      context.value = newValue;

      expect(callback).toHaveBeenCalledWith(newValue);
    });

    it('should notify callback when key changes via set()', () => {
      context.value = { count: 5, name: 'initial' };
      const callback = vi.fn();
      context.subscribe(null, callback);

      context.set('count', 15);

      expect(callback).toHaveBeenCalledWith({ count: 15, name: 'initial' });
    });

    it('should stop notifying after unsubscribe', () => {
      context.value = { count: 5, name: 'initial' };
      const callback = vi.fn();
      const handle = context.subscribe(null, callback);

      handle.unsubscribe();

      context.value = { count: 999, name: 'changed' };
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscriptions', () => {
      context.value = { count: 0, name: 'test' };
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      context.subscribe(null, cb1);
      context.subscribe(null, cb2);

      context.value = { count: 1, name: 'updated' };

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('should unsubscribe independently', () => {
      context.value = { count: 0, name: 'test' };
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const h1 = context.subscribe(null, cb1);
      context.subscribe(null, cb2);

      h1.unsubscribe();

      context.value = { count: 1, name: 'updated' };

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe('lifecycle', () => {
    it('should have isAttached false by default', () => {
      expect(context.isAttached).toBe(false);
    });

    it('should have target undefined by default', () => {
      expect(context.target).toBeUndefined();
    });

    it('should detach from target', () => {
      (context as any).isAttached = true;
      context.detach();
      expect(context.isAttached).toBe(false);
      expect(context.target).toBeUndefined();
    });
  });

  describe('static properties', () => {
    it('should have observedContexts array', () => {
      expect(Array.isArray(CustomContext.observedContexts)).toBe(true);
    });

    it('should have observedEvents array', () => {
      expect(Array.isArray(CustomContext.observedEvents)).toBe(true);
    });
  });

  describe('localName', () => {
    it('should return undetermined when not attached', () => {
      expect(context.localName).toBe('[[undetermined]]');
    });
  });
});
