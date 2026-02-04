/**
 * OnEventAttribute - Generic event handler block for on:* attributes
 *
 * Provides declarative event binding with expression syntax:
 *
 * ```html
 * <button on:click="save($event)">Save</button>
 * <button on:click="delete($event, @item.id)">Delete</button>
 * <button on:click="update(count, @item.name)">Update</button>
 * <button on:click="name | uppercase">Display name</button>
 * ```
 *
 * ## Expression Parsing
 * The attribute value IS the expression directly - no delimiters needed.
 * Parsing is delegated to CustomExpressionParserRegistry which uses
 * the reduce pattern with no knowledge of specific parser types.
 *
 * ## Context Resolution (all via injector chain)
 * - `$event` - The DOM Event object
 * - `$element` - The target element
 * - `@name.path` - Named context (e.g., @item, @theme) → customContexts:name
 * - `@state.path` - Explicit state context → customContexts:state
 * - `bare.path` - Default state context → customContexts:state
 * - handlers - Handler registry → customContexts:handlers
 * - filters - Filter registry → customContexts:filters
 *
 * @module blocks/on-event
 */

import CustomAttribute, {
  type CustomAttributeOptions,
  type ImplementedAttribute,
} from '../../../plugs/webbehaviors/CustomAttribute';
import type {
  CustomExpressionParserRegistry,
  ParsedExpression,
  Query,
  ResolvedValues,
} from '../../../plugs/webexpressions';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';

/**
 * Error thrown when no parser registry is found in the injector chain
 */
export class MissingParsersError extends Error {
  constructor(element: HTMLElement) {
    super(
      `No CustomExpressionParserRegistry found for element <${element.tagName.toLowerCase()}>. ` +
      `Register via injector.set('customExpressionParsers', registry)`
    );
    this.name = 'MissingParsersError';
  }
}

/**
 * Handler function signature
 */
export type EventHandler = (...args: unknown[]) => void;

/**
 * Filter function signature
 */
export type FilterFunction = (value: unknown, ...args: unknown[]) => unknown;

/**
 * Handler registry interface - maps handler names to functions
 */
export interface HandlerRegistry {
  [name: string]: EventHandler;
}

/**
 * Filter registry interface - maps filter names to functions
 */
export interface FilterRegistry {
  [name: string]: FilterFunction;
}

/**
 * Options for OnEventAttribute
 */
export interface OnEventOptions extends CustomAttributeOptions {
  /**
   * The event type to listen for (e.g., 'click', 'submit')
   * If not provided, extracted from attribute name (on:click → click)
   */
  eventType?: string;
}

/**
 * Factory function to create an OnEventAttribute class
 *
 * All context (handlers, state, named contexts) is resolved via the injector chain:
 * - handlers: customContexts:handlers
 * - state: customContexts:state
 * - filters: customContexts:filters
 * - @name: customContexts:name
 *
 * Expression parsing is delegated to CustomExpressionParserRegistry obtained
 * from the injector chain. The registry handles the reduce pattern internally.
 *
 * @param _config - Deprecated, no longer used
 * @returns A CustomAttribute class for handling events
 *
 * @example
 * ```typescript
 * // Setup: provide parser registry via injector
 * const registry = new CustomExpressionParserRegistry();
 * registry.define('call', new CallParser());
 * registry.define('value', new ValueParser());
 * registry.define('pipe', new PipeParser());
 * injector.set('customExpressionParsers', registry);
 *
 * // Provide handlers and state via injector
 * injector.set('customContexts:handlers', {
 *   save: ($event) => console.log('Save clicked'),
 *   delete: ($event, id) => console.log('Delete', id),
 * });
 * injector.set('customContexts:state', { count: 0 });
 *
 * // Create and register attribute
 * const OnClickAttribute = createOnEventAttribute();
 * attributes.define('on:click', OnClickAttribute);
 * ```
 */
export function createOnEventAttribute(): ImplementedAttribute {
  return class OnEventAttribute extends CustomAttribute<OnEventOptions, HTMLElement> {
    #boundHandler: ((e: Event) => void) | null = null;
    #eventType: string | null = null;
    #parsedExpression: ParsedExpression | null = null;

    connectedCallback(): void {
      const expression = this.value;
      if (!expression || !this.target) return;

      // Extract event type from attribute name (on:click → click)
      this.#eventType = this.#getEventType();
      if (!this.#eventType) return;

      // Parse and setup expression handler
      this.#setupHandler(expression);

      // Add event listener
      if (this.#boundHandler) {
        this.target.addEventListener(this.#eventType, this.#boundHandler);
      }
    }

    disconnectedCallback(): void {
      if (this.#boundHandler && this.#eventType && this.target) {
        this.target.removeEventListener(this.#eventType, this.#boundHandler);
      }
      this.#boundHandler = null;
      this.#eventType = null;
      this.#parsedExpression = null;
    }

    /**
     * Get the parser registry from the injector chain.
     */
    #getRegistry(): CustomExpressionParserRegistry {
      if (!this.target) {
        throw new MissingParsersError(this.target!);
      }

      const registry = InjectorRoot.getProviderOf(
        this.target,
        'customExpressionParsers'
      ) as CustomExpressionParserRegistry | undefined;

      if (!registry || typeof registry.parse !== 'function') {
        throw new MissingParsersError(this.target);
      }

      return registry;
    }

    /**
     * Setup handler by parsing the expression via the registry
     */
    #setupHandler(expression: string): void {
      const registry = this.#getRegistry();
      const result = registry.parse(expression);

      if (!result.success || result.expressions.length === 0) {
        console.error(`[on:${this.#eventType}] Failed to parse expression: ${expression}`);
        if (result.remaining) {
          console.error(`[on:${this.#eventType}] Unparsed text: "${result.remaining}"`);
        }
        return;
      }

      // Expression attribute expects a single expression
      this.#parsedExpression = result.expressions[0];

      // Store queries for context resolution
      const queries = result.queries;

      this.#boundHandler = (event: Event) => {
        if (!this.#parsedExpression || !this.target) return;

        // Resolve queries into ResolvedValues
        const resolved = this.#resolveQueries(queries, event);

        try {
          // Delegate evaluation to the expression itself
          if (this.#parsedExpression.evaluate) {
            this.#parsedExpression.evaluate(resolved);
          }
        } catch (error) {
          console.error(`[on:${this.#eventType}] Error evaluating expression:`, error);
        }
      };
    }

    /**
     * Resolve queries into ResolvedValues
     */
    #resolveQueries(queries: Query[], event: Event): ResolvedValues {
      const resolved: ResolvedValues = {
        contexts: {},
        magic: {
          event,
          element: this.target,
          target: event.target,
        },
      };

      // Resolve each context query from injector chain
      for (const query of queries) {
        if (query.type === 'context' && !resolved.contexts[query.context]) {
          const contextValue = this.#queryContext(query.context);
          if (contextValue !== undefined) {
            resolved.contexts[query.context] = contextValue;
          }
        }
        // Magic queries are already provided above
      }

      return resolved;
    }

    /**
     * Extract event type from attribute name
     */
    #getEventType(): string | null {
      const attrName = this.name;
      if (attrName.startsWith('on:')) {
        return attrName.slice(3);
      }
      return this.options.eventType || null;
    }

    /**
     * Query a single context by name from the injector chain.
     */
    #queryContext(contextName: string): unknown {
      if (!this.target) return undefined;
      return InjectorRoot.getProviderOf(
        this.target,
        `customContexts:${contextName}` as keyof import('../../../plugs/webinjectors/InjectorRoot').ProviderTypeMap
      );
    }

  };
}

/**
 * Create a set of on:* attribute classes for common events
 *
 * @returns Object with attribute classes for click, submit, change, input, etc.
 */
export function createEventAttributes(): Record<string, ImplementedAttribute> {
  const OnEvent = createOnEventAttribute();

  return {
    'on:click': OnEvent,
    'on:submit': OnEvent,
    'on:change': OnEvent,
    'on:input': OnEvent,
    'on:focus': OnEvent,
    'on:blur': OnEvent,
    'on:keydown': OnEvent,
    'on:keyup': OnEvent,
    'on:keypress': OnEvent,
    'on:mouseenter': OnEvent,
    'on:mouseleave': OnEvent,
    'on:mouseover': OnEvent,
    'on:mouseout': OnEvent,
    'on:touchstart': OnEvent,
    'on:touchend': OnEvent,
    'on:scroll': OnEvent,
    'on:resize': OnEvent,
    'on:load': OnEvent,
    'on:error': OnEvent,
  };
}

/**
 * Register all on:* event attributes with a CustomAttributeRegistry
 *
 * @param registry - The attribute registry to register with
 */
export function registerEventAttributes(
  registry: { define: (name: string, constructor: ImplementedAttribute) => void }
): void {
  const attributes = createEventAttributes();

  for (const [name, AttributeClass] of Object.entries(attributes)) {
    registry.define(name, AttributeClass);
  }
}
