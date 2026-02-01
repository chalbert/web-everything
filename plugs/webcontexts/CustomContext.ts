/**
 * @file CustomContext.ts
 * @description Abstract base class for custom contexts with state management
 * @source Migrated from plateau/src/plugs/custom-contexts/CustomContext.ts
 */

import InjectorRoot from '../webinjectors/InjectorRoot';
import HTMLInjector from '../webinjectors/HTMLInjector';
import type { Registry } from '../webinjectors/Registry';
import type { HTMLInjectorTarget, HTMLProviderType } from '../webinjectors/HTMLInjector';
import type Injector from '../webinjectors/Injector';

/**
 * Consumable represents a query result that can be provided with values
 */
export class Consumable<T> {
  value?: T;
  expression?: any;

  constructor(expression?: any) {
    this.expression = expression;
  }

  provide(value: T) {
    this.value = value;
  }
}

/**
 * Path expression parser interface (placeholder for future implementation)
 */
export interface CustomPathExpressionParser {
  parse(expression: any): {
    vertices: any[];
    resolve(state: any): any;
  } | null;
}

/**
 * Constructor definition type for implemented contexts
 */
export type ImplementedContext<ContextValue> = (new (initialValue?: ContextValue) => CustomContext<ContextValue>) & {
  observedContexts?: typeof CustomContext['observedContexts'];
};

/**
 * Constructor definition with metadata
 */
export interface ConstructorDefinition<T> {
  constructor: T;
}

/**
 * CustomContext provides hierarchical state management with dependency injection
 * 
 * Contexts can:
 * - Attach to DOM nodes via injector system
 * - Provide values to child nodes
 * - Support path-based queries
 * - Integrate with store implementations
 * - Track and notify consumers on changes
 */
export default abstract class CustomContext<
  ContextValue extends Record<Key, unknown>,
  Key extends keyof ContextValue = keyof ContextValue
> implements Registry<ContextValue, keyof ContextValue> {
  static observedContexts: string[] = [];
  static observedEvents: string[] = [];

  #target: HTMLInjectorTarget | undefined;
  #queries = new Set<WeakRef<Consumable<any>>>();
  #value?: ContextValue;
  #store?: any; // CustomStore type - to be imported when webstates is available
  #pathExpressionParser: CustomPathExpressionParser | null = null;

  abstract initialValue?: ContextValue;

  isAttached: boolean = false;

  constructor(initialValue?: ContextValue) {
    this.#value = initialValue;

    const { connectedCallback: originalConnectedCallback } = this;

    this.connectedCallback = () => {
      originalConnectedCallback?.();
    };
  }

  get value(): ContextValue {
    return typeof this.#value !== 'undefined' ? this.#value : (this.initialValue as ContextValue);
  }

  set value(newValue: ContextValue) {
    this.#value = newValue;

    if (this.#store) {
      this.#store.state = newValue;
    }

    // Notify all queries of the new value
    this.#queries.forEach((ref) => {
      const query = ref.deref();
      if (query) {
        if (query.expression) {
          const graph = this.#pathExpressionParser?.parse(query.expression);
          query.provide(graph?.resolve(newValue));
        } else {
          query.provide(newValue);
        }
      } else {
        this.#queries.delete(ref);
      }
    });
  }

  get target(): HTMLInjectorTarget | undefined {
    return this.#target;
  }

  /**
   * Get the local name of this context in the injector system
   */
  get localName(): string {
    if (this.target) {
      const constructor = this.constructor as ConstructorDefinition<ImplementedContext<any>>['constructor'];
      const localName = InjectorRoot.getLocalNameInProviderOf(
        this.target,
        'customContextTypes',
        constructor
      );

      if (localName) {
        return `customContexts:${localName}`;
      }
    }

    return '[[undetermined]]';
  }

  /**
   * Get a value from the context state
   */
  get(key: Key): ContextValue[Key] | undefined {
    if (this.#store) {
      return this.#store.getItem(key);
    }

    return this.value[key];
  }

  /**
   * Set a value in the context state and notify queries
   */
  set(key: Key, value: ContextValue[Key]): void {
    if (this.#store) {
      this.#store.setItem(key, value);
    } else {
      this.value[key] = value;
    }

    const state = this.#store ? this.#store.state : this.#value;

    // Notify queries that may be affected by this key change
    this.#queries.forEach((ref) => {
      const query = ref.deref();
      if (query) {
        if (query.expression) {
          const graph = this.#pathExpressionParser?.parse(query.expression);
          // Only notify if the changed key is the first vertex in the query
          if (graph?.vertices[0] === key) {
            query.provide(graph?.resolve(state));
          }
        } else {
          // If listening to the base, notify of every update
          query.provide(state);
        }
      } else {
        this.#queries.delete(ref);
      }
    });
  }

  /**
   * Check if a key exists in the context state
   */
  has(key: Key): boolean {
    return Boolean(this.get(key));
  }

  /**
   * Get all keys in the context state
   */
  keys(): IterableIterator<keyof ContextValue> {
    if (this.#store) {
      return Object.keys(this.#store.state).values();
    }

    return Object.keys(this.value).values();
  }

  /**
   * Get the number of keys in the context state
   */
  get size(): number {
    if (this.#store) {
      return Object.keys(this.#store.state).length;
    }

    return Object.keys(this.value).length;
  }

  /**
   * Delete not implemented for contexts
   */
  delete(): void {
    throw new Error('Method not implemented.');
  }

  /**
   * Query the context with a path expression
   */
  query<QueryValue>(expression: any): Consumable<QueryValue> {
    const query = new Consumable<QueryValue>(expression);
    this.claim(query);
    return query;
  }

  /**
   * Register a query to receive updates
   */
  claim(query: Consumable<any>): void {
    const state = this.#store ? this.#store.state : this.#value;

    if (query.expression && this.#pathExpressionParser) {
      const graph = this.#pathExpressionParser.parse(query.expression);
      const newValue = graph?.resolve(state);
      if (query.value !== newValue) {
        query.provide(newValue);
      }
    } else {
      // Without parser or without expression, provide full state
      query.provide(state);
    }

    this.#queries.add(new WeakRef(query));
  }

  /**
   * Unregister a query from receiving updates
   */
  unclaim(query: Consumable<any>): void {
    const which = Array.from(this.#queries.values()).find((item) => item.deref() === query);

    if (which) {
      this.#queries.delete(which);
    }
  }

  // Lifecycle callbacks (to be implemented by subclasses)
  attachedCallback?(): void;
  detachedCallback?(): void;
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  adoptedCallback?(): void;
  contextConsumedCallback?(callback: (...args: unknown[]) => ContextValue): void;

  /**
   * Get the local name of this context from the registry
   */
  #getLocalNameOf(target: HTMLInjectorTarget, injectorRoot?: InjectorRoot): string | undefined {
    if (injectorRoot) {
      const injector = injectorRoot?.getInjectorOf(target);
      if (injector) {
        const registry = injector.get('customContextTypes');
        return registry?.getLocalNameOf(this.constructor as ImplementedContext<ContextValue>);
      }
    }

    return this.#getLocalNameOnTarget(target);
  }

  /**
   * Attach this context to a DOM node
   */
  async attach(target: HTMLInjectorTarget, futureInjectorRoot?: InjectorRoot): Promise<void> {
    const injectorRoot = futureInjectorRoot || InjectorRoot.getInjectorRootOf(target);

    if (!injectorRoot && !futureInjectorRoot) {
      throw Error('You must pass the future injectorRoot when attaching a context to an unconnected node.');
    }

    this.isAttached = true;
    this.#target = target;

    if (injectorRoot) {
      const injector = injectorRoot.ensureInjector(target);
      const localName = this.#getLocalNameOf(target, futureInjectorRoot);

      const parser = injector.consume('customPathExpressionParsers', target as HTMLElement);
      this.#pathExpressionParser = parser?.value;

      if (!localName) {
        throw Error('Undefined context on target');
      }

      injector.set(`customContexts:${localName}`, this);

      const Store = this.#getStore(injector);
      if (Store) {
        this.#store = new Store({
          initialState: this.#value,
        });
      }
    }

    this.attachedCallback?.();
  }

  /**
   * Detach this context from its target
   */
  detach(): void {
    this.isAttached = false;
    this.#target = undefined;
  }

  /**
   * Get the store implementation from the injector hierarchy
   */
  #getStore(injector: HTMLInjector): any {
    let currentInjector: Injector<HTMLProviderType, Node, HTMLInjectorTarget> | null = injector;
    do {
      const stores = currentInjector.get('customStores');
      if (stores) {
        const firstStore = (stores as any).values()[0];
        if (firstStore) {
          return firstStore;
        }
      }
    } while ((currentInjector = currentInjector.parentInjector));

    return null;
  }

  /**
   * Get the local name from the target's injector
   */
  #getLocalNameOnTarget(target: Node): string | undefined {
    const { constructor } = this;
    const localName = InjectorRoot.getLocalNameInProviderOf(target, 'customContextTypes', constructor);
    if (localName) {
      return localName;
    }

    return undefined;
  }
}
