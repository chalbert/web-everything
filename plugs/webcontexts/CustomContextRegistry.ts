/**
 * @file CustomContextRegistry.ts
 * @description Registry for managing custom context types and instances
 * @source Migrated from plateau/src/plugs/custom-contexts/CustomContextRegistry.ts
 */

import HTMLRegistry from '../core/HTMLRegistry';
import type { BaseDefinition } from '../core/HTMLRegistry';
import CustomContext, { type ImplementedContext } from './CustomContext';

export interface CustomContextRegistryOptions {
  extends?: CustomContextRegistry[];
}

/**
 * Context definition with lifecycle callbacks
 */
export interface ContextDefinition<ContextValue> extends BaseDefinition {
  constructor: ImplementedContext<any>;
  attachedCallback?(): void;
  detachedCallback?(): void;
  contextConsumedCallback?(callback: (...args: unknown[]) => ContextValue): void;
  observedContexts?: Set<string>;
}

type RootNode = Document | DocumentFragment | ShadowRoot | HTMLElement;

/**
 * CustomContextRegistry manages context type registration and instance tracking
 * 
 * Features:
 * - Register context types with lifecycle callbacks
 * - Automatically upgrade DOM trees to attach contexts
 * - Track context instances per element
 * - Use MutationObserver for dynamic DOM changes
 * - Support for <script type="context"> declarative contexts
 */
export default class CustomContextRegistry extends HTMLRegistry<
  ContextDefinition<any>,
  ImplementedContext<any>
> {
  localName = 'customContextTypes';

  #observers: Map<RootNode, MutationObserver> = new Map();
  #registrations = new Map<Element, Map<ImplementedContext<any>, CustomContext<any>>>();

  /**
   * Upgrade method required by HTMLRegistry
   */
  upgrade(root: Node): void {
    this.#addContextsOnTree(root as RootNode);
    this.#disconnect(root as RootNode);
    this.#observe(root as RootNode);
  }

  /**
   * Downgrade method required by HTMLRegistry
   */
  downgrade(root: Node): void {
    this.#removeContextsFromTree(root as RootNode);
    this.#disconnect(root as RootNode);
  }

  /**
   * Define a new context type
   */
  define(name: string, Context: ImplementedContext<any>): void {
    // Create a temporary instance to get instance properties
    const tempInstance = new Context();
    
    const definition: ContextDefinition<any> = {
      constructor: Context,
      connectedCallback: tempInstance.connectedCallback || Context.prototype.connectedCallback,
      disconnectedCallback: tempInstance.disconnectedCallback || Context.prototype.disconnectedCallback,
      adoptedCallback: tempInstance.adoptedCallback || Context.prototype.adoptedCallback,
      observedContexts: new Set(Context.observedContexts || []),
    };

    this.set(name, definition);
  }

  /**
   * Upgrade a root node by adding contexts and observing changes
   */
  upgrade(root: RootNode): void {
    this.#addContextsOnTree(root);
    this.#disconnect(root);
    this.#observe(root);
  }

  /**
   * Downgrade a root node by removing contexts and disconnecting observer
   */
  downgrade(root: RootNode): void {
    this.#removeContextsFromTree(root);
    this.#disconnect(root);
  }

  /**
   * Get a specific context instance by name from an element
   */
  getContextByName(node: Element, name: string): CustomContext<any> | null {
    const definition = this.getDefinition(name);
    if (definition) {
      return this.#registrations.get(node)?.get(definition.constructor) || null;
    }

    return null;
  }

  /**
   * Get the definition for a context type
   */
  getDefinition(name: string): ContextDefinition<any> | undefined {
    // Call HTMLRegistry's getDefinition, not its get()
    return super.getDefinition(name);
  }

  /**
   * Get constructor for a context type (matches HTMLRegistry pattern)
   */
  get(name: string): ImplementedContext<any> | undefined {
    const definition = this.getDefinition(name);
    return definition?.constructor;
  }

  /**
   * Get all context instances attached to an element
   */
  getContextAll(node: Element): Map<ImplementedContext<any>, CustomContext<any>> | null {
    return this.#registrations.get(node) || null;
  }

  /**
   * Add a context instance to an element
   */
  #addContext(element: HTMLElement, contextScript: HTMLScriptElement): void {
    const name = contextScript.getAttribute('context') as string;
    const contextDefinition = this.get(name);
    
    if (contextDefinition) {
      const Context = contextDefinition.constructor;
      const contextInstance = new Context();
      contextInstance.attach(element);

      if (!this.#registrations.has(element)) {
        this.#registrations.set(element, new Map());
      }

      this.#registrations.get(element)?.set(Context, contextInstance);

      contextDefinition.attachedCallback?.();

      if (element.isConnected) {
        contextInstance.connectedCallback?.();
      }
    }
  }

  /**
   * Remove context instances from an element
   */
  #removeContext(element: HTMLElement): void {
    const contextMap = this.#registrations.get(element);
    
    if (contextMap) {
      // Call disconnectedCallback for all contexts
      contextMap.forEach((context) => {
        context.disconnectedCallback?.();
        context.detach();
      });
      
      this.#registrations.delete(element);
    }
  }

  /**
   * Add contexts to all elements in a tree
   */
  #addContextsOnTree(tree: Node): void {
    this.#applyOnTree(tree, 'add');
  }

  /**
   * Remove contexts from all elements in a tree
   */
  #removeContextsFromTree(tree: Node): void {
    this.#applyOnTree(tree, 'remove');
  }

  /**
   * Apply an action (add/remove) to all context scripts in a tree
   */
  #applyOnTree(tree: Node, action: 'add' | 'remove'): void {
    const treeWalker = document.createTreeWalker(tree, NodeFilter.SHOW_ELEMENT);
    
    do {
      if (treeWalker.currentNode instanceof HTMLElement) {
        if (action === 'add') {
          const isContextScript =
            treeWalker.currentNode.tagName === 'SCRIPT' &&
            (treeWalker.currentNode as HTMLScriptElement).type === 'context' &&
            treeWalker.currentNode.getAttribute('context');

          if (isContextScript) {
            this.#addContext(
              treeWalker.currentNode.parentElement as HTMLElement,
              treeWalker.currentNode as HTMLScriptElement
            );
          }
        } else {
          this.#removeContext(treeWalker.currentNode);
        }
      }
    } while (treeWalker.nextNode());
  }

  /**
   * Start observing a root node for DOM changes
   */
  #observe(root: RootNode): void {
    const observer = this.#getRootObserver(root);

    observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stop observing a root node
   */
  #disconnect(root: RootNode): void {
    const observer = this.#observers.get(root);
    observer?.disconnect();
  }

  /**
   * Get or create a MutationObserver for a root node
   */
  #getRootObserver(root: RootNode): MutationObserver {
    if (this.#observers.has(root)) {
      return this.#observers.get(root) as MutationObserver;
    }

    const observer = this.#getObserver();
    this.#observers.set(root, observer);
    return observer;
  }

  /**
   * Create a new MutationObserver that handles context updates
   */
  #getObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes) {
          Array.from(mutation.addedNodes).forEach((addedNode) => {
            this.#addContextsOnTree(addedNode);
          });
        }

        if (mutation.removedNodes) {
          Array.from(mutation.removedNodes).forEach((removedNode) => {
            this.#removeContextsFromTree(removedNode);
          });
        }
      }
    });
  }
}
