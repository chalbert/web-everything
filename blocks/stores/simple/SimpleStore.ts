/**
 * @file SimpleStore.ts
 * @description Concrete implementation of CustomStore with built-in listener management
 *
 * SimpleStore provides a ready-to-use store implementation with:
 * - Automatic listener management (subscribe/unsubscribe)
 * - Dot-notation path support for nested state (getItem/setItem)
 * - Optional onBeforeNotify hook for derived state calculations
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counter = new SimpleStore({ count: 0 });
 * counter.subscribe(state => console.log('Count:', state.count));
 * counter.setItem('count', counter.getItem('count') + 1);
 *
 * // With nested state
 * const form = new SimpleStore({ user: { name: '', email: '' } });
 * form.setItem('user.name', 'John');
 * console.log(form.getItem('user.name')); // 'John'
 *
 * // With derived state hook
 * const todos = new SimpleStore(
 *   { todos: [], totalTodos: 0, activeTodos: 0 },
 *   (state) => {
 *     state.totalTodos = state.todos.length;
 *     state.activeTodos = state.todos.filter(t => !t.completed).length;
 *   }
 * );
 * ```
 *
 * @module blocks/stores/simple
 */

import CustomStore, {
  type StoreListener,
  type StoreUnsubscribe,
  type StoreOptions,
} from '../../../plugs/webstates/CustomStore';

/**
 * Options for creating a SimpleStore instance
 */
export interface SimpleStoreOptions<State> extends StoreOptions<State> {
  /**
   * Hook called before notifying listeners, useful for computing derived state
   */
  onBeforeNotify?: (state: State) => void;
}

/**
 * SimpleStore - A concrete implementation of CustomStore
 *
 * Provides a ready-to-use store with automatic listener management and
 * dot-notation path support for nested state access.
 */
export default class SimpleStore<
  State extends Record<string, unknown> = Record<string, unknown>
> extends CustomStore<State, keyof State & string> {
  /**
   * Current state of the store
   */
  state: State;

  /**
   * Registered listeners
   */
  #listeners: StoreListener<State>[] = [];

  /**
   * Optional hook called before notifying listeners
   */
  #onBeforeNotify?: (state: State) => void;

  /**
   * Create a new SimpleStore instance
   *
   * @param initialState - Initial state object
   * @param onBeforeNotify - Optional hook for derived state calculations
   */
  constructor(initialState: State, onBeforeNotify?: (state: State) => void) {
    super({ initialState });
    this.state = initialState;
    this.#onBeforeNotify = onBeforeNotify;
  }

  /**
   * Subscribe to store state changes
   *
   * @param listener - Function to call when state changes
   * @returns Function to unsubscribe from updates
   */
  subscribe(listener: StoreListener<State>): StoreUnsubscribe {
    this.#listeners.push(listener);
    return () => {
      this.#listeners = this.#listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get a value from the store by key or dot-notation path
   *
   * @param key - Key or dot-notation path (e.g., 'user.name')
   * @returns The value at the specified path
   *
   * @example
   * ```typescript
   * store.getItem('count');       // Direct key
   * store.getItem('user.name');   // Nested path
   * ```
   */
  getItem(key: keyof State & string): State[keyof State & string] {
    if (key.includes('.')) {
      const parts = key.split('.');
      let current: unknown = this.state;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined as State[keyof State & string];
        current = (current as Record<string, unknown>)[part];
      }
      return current as State[keyof State & string];
    }
    return this.state[key];
  }

  /**
   * Set a value in the store by key or dot-notation path
   *
   * @param key - Key or dot-notation path (e.g., 'user.name')
   * @param value - The value to set
   *
   * @example
   * ```typescript
   * store.setItem('count', 1);           // Direct key
   * store.setItem('user.name', 'John');  // Nested path
   * ```
   */
  setItem(key: keyof State & string, value: State[keyof State & string]): void {
    if (key.includes('.')) {
      const parts = key.split('.');
      const lastPart = parts.pop()!;
      let current: Record<string, unknown> = this.state as Record<string, unknown>;
      for (const part of parts) {
        if (current[part] === undefined || current[part] === null) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      current[lastPart] = value;
    } else {
      (this.state as Record<string, unknown>)[key] = value;
    }

    // Call hook before notifying (for derived state)
    if (this.#onBeforeNotify) {
      this.#onBeforeNotify(this.state);
    }

    // Notify listeners
    this.#notify();
  }

  /**
   * Notify all listeners of state change
   */
  #notify(): void {
    for (const listener of this.#listeners) {
      listener(this.state);
    }
  }
}
