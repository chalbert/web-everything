/**
 * @file CustomStore.ts
 * @description Abstract base class for custom state stores
 * @source Migrated from plateau/src/plugs/custom-stores/CustomStore.ts
 */

/**
 * Listener function called when store state changes
 */
export type StoreListener<State = any> = (state: State) => void;

/**
 * Function to unsubscribe from store updates
 */
export type StoreUnsubscribe = () => void;

/**
 * Subscription entry tracking listener and query
 */
export type StoreSubscription<State = any> = {
  listener: StoreListener<State>;
  query: any;
};

/**
 * Options for creating a CustomStore instance
 */
export interface StoreOptions<State> {
  /**
   * Initial state for the store
   */
  initialState?: State;
}

/**
 * Type for an implemented custom store constructor
 */
export type ImplementedStore<
  State extends Record<Key, unknown>,
  Key extends keyof State = keyof State
> = new (options?: StoreOptions<State>) => CustomStore<State, Key>;

/**
 * Abstract base class for custom state stores
 * 
 * Custom stores provide a standardized interface for state management
 * with subscription-based reactivity. Stores can be registered in a
 * CustomStoreRegistry and accessed through dependency injection.
 * 
 * @example
 * ```typescript
 * interface AppState {
 *   count: number;
 *   user: string;
 * }
 * 
 * class AppStore extends CustomStore<AppState> {
 *   state: AppState = {
 *     count: 0,
 *     user: 'guest'
 *   };
 * 
 *   subscribe(listener: StoreListener<AppState>) {
 *     // Implement subscription logic
 *     return () => {}; // Unsubscribe function
 *   }
 * 
 *   getItem(key: keyof AppState) {
 *     return this.state[key];
 *   }
 * 
 *   setItem(key: keyof AppState, value: any) {
 *     this.state[key] = value;
 *     // Notify subscribers
 *   }
 * }
 * 
 * const registry = new CustomStoreRegistry();
 * registry.define('app', AppStore);
 * ```
 */
export default abstract class CustomStore<
  State extends Record<Key, unknown>,
  Key extends keyof State = keyof State
> {
  /**
   * Current state of the store
   */
  abstract state: State;

  /**
   * Subscribe to store state changes
   * 
   * @param listener - Function to call when state changes
   * @param query - Optional query to filter updates
   * @returns Function to unsubscribe from updates
   */
  abstract subscribe(
    listener: StoreListener<State>,
    query?: any
  ): StoreUnsubscribe;

  /**
   * Get a specific item from the store by key
   * 
   * @param key - The key to retrieve
   * @returns The value at the specified key
   */
  abstract getItem(key: Key): State[Key];

  /**
   * Set a specific item in the store by key
   * 
   * @param key - The key to set
   * @param value - The value to set
   */
  abstract setItem(key: Key, value: State[Key]): void;

  /**
   * Options passed during construction
   */
  options: StoreOptions<State>;

  /**
   * Create a new CustomStore instance
   * 
   * @param options - Configuration options
   */
  constructor(options: StoreOptions<State> = {}) {
    this.options = options;
  }
}
