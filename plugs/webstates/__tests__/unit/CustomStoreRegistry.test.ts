/**
 * @file CustomStoreRegistry.test.ts
 * @description Unit tests for CustomStoreRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CustomStoreRegistry from '../../CustomStoreRegistry';
import CustomStore, { type StoreOptions } from '../../CustomStore';

describe('CustomStoreRegistry', () => {
  // Test stores with different state shapes
  interface CounterState {
    count: number;
  }

  interface UserState {
    id: string;
    name: string;
  }

  class CounterStore extends CustomStore<CounterState> {
    state: CounterState = { count: 0 };

    subscribe() {
      return () => {};
    }

    getItem(key: keyof CounterState) {
      return this.state[key];
    }

    setItem(key: keyof CounterState, value: any) {
      this.state[key] = value;
    }
  }

  class UserStore extends CustomStore<UserState> {
    state: UserState = { id: '', name: '' };

    subscribe() {
      return () => {};
    }

    getItem(key: keyof UserState) {
      return this.state[key];
    }

    setItem(key: keyof UserState, value: any) {
      this.state[key] = value;
    }
  }

  let registry: CustomStoreRegistry;

  beforeEach(() => {
    registry = new CustomStoreRegistry();
  });

  describe('Construction', () => {
    it('should create instance', () => {
      expect(registry).toBeInstanceOf(CustomStoreRegistry);
    });

    it('should have localName property', () => {
      expect(registry.localName).toBe('customStores');
    });

    it('should extend HTMLRegistry', () => {
      expect(typeof registry.define).toBe('function');
      expect(typeof registry.get).toBe('function');
    });
  });

  describe('define method', () => {
    it('should register a store', () => {
      registry.define('counter', CounterStore);

      const StoreConstructor = registry.get('counter');
      expect(StoreConstructor).toBe(CounterStore);
    });

    it('should register store with context types', () => {
      registry.define('user', UserStore, {
        contextTypes: ['session', 'auth'],
      });

      const definition = registry.getOwn('user');
      expect(definition?.contextTypes).toEqual(['session', 'auth']);
    });

    it('should register store without options', () => {
      registry.define('counter', CounterStore);

      const definition = registry.getOwn('counter');
      expect(definition?.contextTypes).toEqual([]);
    });

    it('should register multiple stores', () => {
      registry.define('counter', CounterStore);
      registry.define('user', UserStore);

      expect(registry.get('counter')).toBe(CounterStore);
      expect(registry.get('user')).toBe(UserStore);
    });

    it('should override existing registration', () => {
      class CounterStore2 extends CounterStore {}

      registry.define('counter', CounterStore);
      registry.define('counter', CounterStore2);

      expect(registry.get('counter')).toBe(CounterStore2);
    });
  });

  describe('get method', () => {
    it('should retrieve registered store', () => {
      registry.define('counter', CounterStore);

      const StoreConstructor = registry.get('counter');
      expect(StoreConstructor).toBe(CounterStore);
    });

    it('should return undefined for unregistered store', () => {
      const StoreConstructor = registry.get('nonexistent');
      expect(StoreConstructor).toBeUndefined();
    });

    it('should retrieve store definition', () => {
      registry.define('user', UserStore, {
        contextTypes: ['session'],
      });

      const definition = registry.getOwn('user');
      expect(definition).toBeDefined();
      expect(definition?.constructor).toBe(UserStore);
      expect(definition?.contextTypes).toEqual(['session']);
    });
  });

  describe('Store instantiation', () => {
    it('should instantiate store from registry', () => {
      registry.define('counter', CounterStore);

      const StoreConstructor = registry.get('counter');
      const store = StoreConstructor ? new StoreConstructor() : null;

      expect(store).toBeInstanceOf(CounterStore);
      expect(store?.state.count).toBe(0);
    });

    it('should pass options to store constructor', () => {
      registry.define('counter', CounterStore);

      const StoreConstructor = registry.get('counter');
      const initialState: CounterState = { count: 10 };
      const store = StoreConstructor
        ? new StoreConstructor({ initialState })
        : null;

      expect(store?.options.initialState).toEqual(initialState);
    });

    it('should create independent store instances', () => {
      registry.define('counter', CounterStore);

      const StoreConstructor = registry.get('counter');
      const store1 = StoreConstructor ? new StoreConstructor() : null;
      const store2 = StoreConstructor ? new StoreConstructor() : null;

      store1?.setItem('count', 5);
      store2?.setItem('count', 10);

      expect(store1?.getItem('count')).toBe(5);
      expect(store2?.getItem('count')).toBe(10);
    });
  });

  describe('upgrade method', () => {
    it('should exist', () => {
      expect(typeof registry.upgrade).toBe('function');
    });

    it('should be a no-op', () => {
      registry.define('counter', CounterStore);

      // Should not throw
      expect(() => registry.upgrade()).not.toThrow();
    });
  });

  describe('downgrade method', () => {
    it('should exist', () => {
      expect(typeof registry.downgrade).toBe('function');
    });

    it('should be a no-op', () => {
      registry.define('counter', CounterStore);

      // Should not throw
      expect(() => registry.downgrade()).not.toThrow();
    });
  });

  describe('Context types', () => {
    it('should store single context type', () => {
      registry.define('auth', UserStore, {
        contextTypes: ['authentication'],
      });

      const definition = registry.getOwn('auth');
      expect(definition?.contextTypes).toEqual(['authentication']);
    });

    it('should store multiple context types', () => {
      registry.define('user', UserStore, {
        contextTypes: ['session', 'auth', 'profile'],
      });

      const definition = registry.getOwn('user');
      expect(definition?.contextTypes).toEqual(['session', 'auth', 'profile']);
    });

    it('should default to empty array', () => {
      registry.define('counter', CounterStore);

      const definition = registry.getOwn('counter');
      expect(definition?.contextTypes).toEqual([]);
    });
  });

  describe('Registry inheritance', () => {
    it('should support extends option', () => {
      const parentRegistry = new CustomStoreRegistry();
      parentRegistry.define('counter', CounterStore);

      const childRegistry = new CustomStoreRegistry({
        extends: [parentRegistry],
      });

      expect(childRegistry.get('counter')).toBe(CounterStore);
    });

    it('should override parent definitions', () => {
      class CounterStore2 extends CounterStore {}

      const parentRegistry = new CustomStoreRegistry();
      parentRegistry.define('counter', CounterStore);

      const childRegistry = new CustomStoreRegistry({
        extends: [parentRegistry],
      });
      childRegistry.define('counter', CounterStore2);

      expect(childRegistry.get('counter')).toBe(CounterStore2);
    });

    it('should access parent definitions', () => {
      const parentRegistry = new CustomStoreRegistry();
      parentRegistry.define('counter', CounterStore);

      const childRegistry = new CustomStoreRegistry({
        extends: [parentRegistry],
      });
      childRegistry.define('user', UserStore);

      expect(childRegistry.get('counter')).toBe(CounterStore);
      expect(childRegistry.get('user')).toBe(UserStore);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty registry', () => {
      expect(registry.get('anything')).toBeUndefined();
    });

    it('should handle special characters in store names', () => {
      registry.define('store-name', CounterStore);
      registry.define('store_name', UserStore);

      expect(registry.get('store-name')).toBe(CounterStore);
      expect(registry.get('store_name')).toBe(UserStore);
    });

    it('should handle numeric-like names', () => {
      registry.define('123', CounterStore);

      expect(registry.get('123')).toBe(CounterStore);
    });

    it('should handle re-registration', () => {
      registry.define('counter', CounterStore);
      expect(registry.get('counter')).toBe(CounterStore);

      class NewCounterStore extends CounterStore {}
      registry.define('counter', NewCounterStore);
      expect(registry.get('counter')).toBe(NewCounterStore);
    });
  });

  describe('Integration with CustomStore', () => {
    it('should work with stores that have complex state', () => {
      interface ComplexState {
        nested: {
          value: number;
        };
        array: string[];
      }

      class ComplexStore extends CustomStore<ComplexState> {
        state: ComplexState = {
          nested: { value: 0 },
          array: [],
        };

        subscribe() {
          return () => {};
        }

        getItem(key: keyof ComplexState) {
          return this.state[key];
        }

        setItem(key: keyof ComplexState, value: any) {
          this.state[key] = value;
        }
      }

      registry.define('complex', ComplexStore);

      const StoreConstructor = registry.get('complex');
      const store = StoreConstructor ? new StoreConstructor() : null;

      expect(store?.state.nested.value).toBe(0);
      expect(store?.state.array).toEqual([]);
    });
  });
});
