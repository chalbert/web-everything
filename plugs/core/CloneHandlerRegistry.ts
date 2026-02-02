/**
 * CloneHandlerRegistry.ts - Registry for node cloning handlers
 * 
 * Enables pluggable cloning behavior where each plug (webcomponents, webexpressions, etc.)
 * can register its own clone handler for specific node types.
 * 
 * @module core
 */

/**
 * Context passed to clone handlers.
 */
export interface CloneContext {
  /** The original node being cloned */
  originalNode: Node;
  /** The cloned node from native cloneNode */
  clonedNode: Node;
  /** Whether this is a deep clone */
  deep: boolean;
  /** TreeWalker positioned at current original node (for deep clones) */
  originalWalker?: TreeWalker;
  /** TreeWalker positioned at current cloned node (for deep clones) */
  clonedWalker?: TreeWalker;
}

/**
 * Clone handler interface that plugs implement.
 */
export interface CloneHandler {
  /**
   * Name of the handler (for debugging).
   */
  name: string;

  /**
   * Check if this handler should process the given node.
   */
  matches(node: Node): boolean;

  /**
   * Clone the node with custom logic.
   * 
   * @param context - Cloning context
   * @returns The cloned node (may be different from context.clonedNode if replaced)
   */
  clone(context: CloneContext): Node;
}

/**
 * Registry for managing clone handlers from different plugs.
 * 
 * Each plug registers handlers for its node types, enabling modular
 * cloning behavior without cross-dependencies.
 * 
 * @example
 * ```typescript
 * // webcomponents plug
 * cloneHandlerRegistry.register({
 *   name: 'customElement',
 *   matches: (node) => node instanceof CustomElement,
 *   clone: (context) => { ... }
 * });
 * 
 * // webexpressions plug  
 * cloneHandlerRegistry.register({
 *   name: 'customTextNode',
 *   matches: (node) => node.constructor.name === 'CustomTextNode',
 *   clone: (context) => { ... }
 * });
 * ```
 */
export class CloneHandlerRegistry {
  private handlers: CloneHandler[] = [];

  /**
   * Register a clone handler.
   * 
   * @param handler - The handler to register
   */
  register(handler: CloneHandler): void {
    // Avoid duplicate registrations
    if (this.handlers.some(h => h.name === handler.name)) {
      console.warn(`Clone handler "${handler.name}" already registered`);
      return;
    }
    this.handlers.push(handler);
  }

  /**
   * Unregister a clone handler by name.
   * 
   * @param name - Name of the handler to remove
   */
  unregister(name: string): void {
    const index = this.handlers.findIndex(h => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Process a node with all registered handlers.
   * 
   * @param context - Cloning context
   * @returns The final cloned node (may be replaced by handlers)
   */
  process(context: CloneContext): Node {
    let result = context.clonedNode;
    
    for (const handler of this.handlers) {
      if (handler.matches(context.originalNode)) {
        result = handler.clone({ ...context, clonedNode: result });
      }
    }
    
    return result;
  }

  /**
   * Get all registered handlers.
   */
  getHandlers(): ReadonlyArray<CloneHandler> {
    return this.handlers;
  }

  /**
   * Clear all handlers (useful for testing).
   */
  clear(): void {
    this.handlers = [];
  }
}

/**
 * Global clone handler registry instance.
 */
export const cloneHandlerRegistry = new CloneHandlerRegistry();
