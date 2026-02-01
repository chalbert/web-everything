/**
 * InjectorRoot - Global registry and manager for HTML injectors
 * 
 * Source: plateau/src/plugs/custom-injectors/InjectorRoot.ts
 * 
 * Provides:
 * - Global registry mapping root nodes to InjectorRoot instances
 * - Static utilities for provider lookup
 * - Management of injector lifecycle (upgrade/downgrade)
 * - MutationObserver integration for DOM changes
 * - Global creationInjector singleton for element creation context
 * 
 * @module webinjectors
 */

import HTMLRegistry, { BaseDefinition, ConstructorDefinition } from './HTMLRegistry';
import HTMLInjector, { HTMLInjectorTarget } from './HTMLInjector';
import CustomRegistry from '../core/CustomRegistry';

/**
 * TODO: These will be imported from webcontexts and other projects when migrated.
 * For now, using placeholder types.
 */
type CustomContext<T = any> = any;
type CustomContextRegistry = any;
type CustomCommentParserRegistry = any;
type CustomElementRegistry = any;

export interface InjectorRootOptions {
  extends?: InjectorRoot[];
}

export interface ProviderDefinition extends ConstructorDefinition<any> {}

/**
 * Type map for all provider types in the system.
 */
export type ProviderTypeMap = {
  [index: string]: CustomRegistry<any>;
  customContextTypes: CustomContextRegistry;
  customCommentParsers: CustomCommentParserRegistry;
} & Record<`customContexts:${string}`, CustomContext<any>>;

export type AnyProviderType = CustomRegistry<any> | CustomContext<any>;

/**
 * Global registry and manager for hierarchical dependency injection.
 * 
 * Each root node (document, shadow root) has an InjectorRoot that manages
 * the injectors within that subtree.
 */
export default class InjectorRoot {
  static #injectorRoots = new Map<RootNode, InjectorRoot>();

  /**
   * Get the InjectorRoot managing a node's subtree.
   */
  static getInjectorRootOf(node: Node): InjectorRoot | undefined {
    const rootNode = node.getRootNode();
    return this.#injectorRoots.get(rootNode);
  }

  /**
   * Get a provider from a node's injector chain.
   * 
   * Walks up the injector hierarchy until a matching provider is found.
   */
  static getProviderOf<ProviderName extends keyof ProviderTypeMap>(
    node: Node | Comment,
    providerName: ProviderName
  ): ProviderTypeMap[ProviderName] | undefined {
    const injectors = (node as any).injectors?.();
    if (!injectors) return undefined;

    let currentInjector: HTMLInjector;
    while ((currentInjector = injectors.next().value)) {
      const provider = currentInjector.get(providerName) as ProviderTypeMap[ProviderName];
      if (provider) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Get all providers available to a node.
   * 
   * Collects unique providers from the entire injector chain,
   * with closer injectors taking precedence.
   */
  static getProvidersOf(node: Node): Map<string, HTMLRegistry<any, any>> {
    const injectors = (node as any).injectors?.();
    const providers = new Map<string, HTMLRegistry<any, any>>();

    if (!injectors) return providers;

    let currentInjector: HTMLInjector;
    while ((currentInjector = injectors.next().value)) {
      const entries = currentInjector.entries();
      Array.from(entries).forEach(([providerName, provider]) => {
        if (typeof providerName === 'string' && !providers.has(providerName)) {
          providers.set(providerName, provider as HTMLRegistry<any, any>);
        }
      });
    }

    return providers;
  }

  /**
   * Get a definition from a provider by constructor.
   */
  static getDefinitionInProviderOf(
    node: Node,
    providerName: string,
    constructor: ConstructorDefinition<any>['constructor']
  ): BaseDefinition | undefined {
    const injectors = (node as any).injectors?.();
    if (!injectors) return undefined;

    let currentInjector: HTMLInjector;
    while ((currentInjector = injectors.next()?.value)) {
      const provider = currentInjector.get(providerName);
      if (provider instanceof HTMLRegistry) {
        const localElementName = provider.getLocalNameOf(constructor);
        if (localElementName) {
          const result = provider.getDefinition(localElementName);
          if (typeof result !== 'undefined') return result;
        }
      }
    }
    return undefined;
  }

  /**
   * Get a constructor from a provider by constructor reference.
   */
  static getValueInProviderOf(
    node: Node,
    providerName: string,
    constructor: ConstructorDefinition<any>['constructor']
  ): Function | undefined {
    const definition = this.getDefinitionInProviderOf(node, providerName, constructor);
    return definition?.constructor;
  }

  /**
   * Get a value from a provider by local name.
   */
  static getValueInProviderByLocalNameOf(
    node: Node,
    providerName: string,
    localName: string
  ): any {
    const injectors = (node as any).injectors?.();
    if (!injectors) return undefined;

    let currentInjector: HTMLInjector;
    while ((currentInjector = injectors.next()?.value)) {
      const provider = currentInjector.get(providerName);
      if (provider instanceof HTMLRegistry) {
        const result = provider.get(localName);
        if (typeof result !== 'undefined') return result;
      }
    }
    return undefined;
  }

  /**
   * Get the local name for a constructor in a provider.
   */
  static getLocalNameInProviderOf(
    node: Node,
    providerName: string,
    constructor: ConstructorDefinition<any>['constructor']
  ): string | undefined {
    const injectors = (node as any).injectors?.();
    if (!injectors) return undefined;

    let currentInjector: HTMLInjector;
    while ((currentInjector = injectors.next()?.value)) {
      const provider = currentInjector.get(providerName);
      if (provider instanceof HTMLRegistry) {
        const localElementName = provider.getLocalNameOf(constructor);
        if (localElementName) {
          return localElementName;
        }
      }
    }
    return undefined;
  }

  /**
   * Global singleton tracking the injector of the currently created element.
   * 
   * CRITICAL: This is set during element creation to provide injection context
   * before the element is attached to the DOM.
   */
  static creationInjector: HTMLInjector | null = null;

  localName = 'customProviders';

  #observers: Map<Node, MutationObserver> = new Map();

  // Holds elements with actual injectors
  #injectors = new Map<HTMLInjectorTarget, HTMLInjector>();

  /**
   * Get the injector for a target element.
   */
  getInjectorOf(target: HTMLInjectorTarget): HTMLInjector | null {
    return this.#injectors.get(target) || null;
  }

  /**
   * Upgrade an element tree with injectors.
   * 
   * Adds injectors to the tree and starts observing for changes.
   */
  upgrade(element: HTMLInjectorTarget): void {
    if (element.getRootNode() !== element) {
      this.#addInjectorsOnTree(element);
      this.#observe(element as Element);
    }
  }

  /**
   * Downgrade an element tree by removing injectors.
   * 
   * Removes injectors from the tree and stops observing.
   */
  downgrade(element: Element | RootNode): void {
    if (element.getRootNode() !== element) {
      this.#removeInjectorsFromTree(element);
      this.#disconnect(element as Element);
    }
  }

  /**
   * Register a provider on an element.
   * 
   * Creates an injector for the element if needed and adds the provider to it.
   */
  register<Definition extends BaseDefinition>(
    element: HTMLInjectorTarget,
    provider: HTMLRegistry<Definition, any> | CustomRegistry<any>
  ): void {
    this.#addInjector(element);
    const injector = this.#injectors.get(element) as HTMLInjector;
    const existingProvider = injector.get(provider.localName);

    if (existingProvider !== provider) {
      if (existingProvider) {
        // TODO: Handle provider replacement
        // existingProvider.detach(target);
      }

      injector.set(provider.localName, provider);

      // TODO: Check if provider is CustomElementRegistry when that's migrated
      if (!(provider as any).define) {
        this.upgrade(element);
      }
    }
  }

  /**
   * Unregister a provider from an element.
   */
  unregister<Definition extends BaseDefinition>(
    element: HTMLInjectorTarget,
    provider: HTMLRegistry<Definition, any>
  ): void {
    const injector = this.#injectors.get(element) as HTMLInjector;
    const existingProvider = injector.get(provider.localName);
    if (
      existingProvider === provider &&
      'downgrade' in existingProvider &&
      typeof existingProvider.downgrade === 'function'
    ) {
      existingProvider.downgrade(element);
      injector.delete(provider.localName);
    }
  }

  /**
   * Attach this InjectorRoot to a root node.
   */
  attach(root: RootNode): void {
    const rootInjector = new HTMLInjector(root);
    this.#injectors.set(root, rootInjector);

    InjectorRoot.#injectorRoots.set(root, this);
    this.upgrade(root);
  }

  /**
   * Detach this InjectorRoot from a root node.
   */
  detach(root: RootNode): void {
    InjectorRoot.#injectorRoots.delete(root);
    this.downgrade(root);
  }

  /**
   * Ensure an injector exists for a target.
   * 
   * Creates a new injector if needed and wires it into the hierarchy.
   */
  ensureInjector(target: HTMLInjectorTarget, parentInjector?: HTMLInjector): HTMLInjector {
    const injector = this.#injectors.get(target);
    if (!injector) {
      const closestInjector = (target as any).getClosestInjector?.() || parentInjector;
      const newInjector = new HTMLInjector(target, closestInjector);
      this.#injectors.set(target, newInjector);

      parentInjector?.childInjectors.forEach((currentInjector) => {
        // If the new injector is between the parent and a child, 
        // it becomes the child's new parent injector
        if (target !== currentInjector.target && target.contains(currentInjector.target)) {
          parentInjector.childInjectors.delete(currentInjector);
          newInjector.childInjectors.add(currentInjector);
          currentInjector.parentInjector = newInjector;
        }
      });

      return newInjector;
    }
    return injector;
  }

  /**
   * Update an element's injector based on attribute changes.
   */
  #update(element: HTMLElement, changedAttributeName: string): void {
    if (changedAttributeName === 'providers') {
      this.#updateProviders(element);
    } else {
      const hasAttribute = changedAttributeName in element.attributes;

      if (hasAttribute) {
        this.#addInjector(element);
      } else {
        this.#removeInjector(element);
      }
    }
  }

  /**
   * Add an injector to an element.
   */
  #addInjector(element: HTMLInjectorTarget): void {
    this.ensureInjector(element);
    this.#updateProviders(element);
  }

  /**
   * Remove an injector from an element.
   */
  #removeInjector(element: HTMLElement): void {
    this.#injectors.delete(element);
    // Don't call downgrade here - it's already handled by the tree traversal
    this.#updateProviders(element);
  }

  /**
   * Update providers based on element's "providers" attribute.
   */
  #updateProviders(target: HTMLInjectorTarget): void {
    const injector = this.#injectors.get(target);

    if (injector && target instanceof HTMLElement) {
      const providersAttr = target.getAttribute('providers');
      const providers = providersAttr?.split(' ') || [];
      const actualProviders = providers.reduce((result, providerName) => {
        const providerInstance = injector.get(providerName);
        if (providerInstance instanceof HTMLRegistry) {
          const CurrentHTMLProvider = providerInstance.get(providerName)?.constructor;
          if (CurrentHTMLProvider) {
            // @ts-ignore
            const newProviderInstance = new CurrentHTMLProvider();
            result.set(providerName, newProviderInstance);
          }
        }
        return result;
      }, new Map<string, HTMLRegistry<any, any>>());

      const actualProvidersAttr = Array.from(actualProviders.keys()).join(' ');

      if (providersAttr !== actualProvidersAttr) {
        target.setAttribute('injectors', actualProvidersAttr);
      }
    }
  }

  /**
   * Add injectors to an entire tree.
   */
  #addInjectorsOnTree(tree: Node): void {
    this.#applyOnTree(tree, 'add');
  }

  /**
   * Remove injectors from an entire tree.
   */
  #removeInjectorsFromTree(tree: Node): void {
    this.#applyOnTree(tree, 'remove');
  }

  /**
   * Apply add/remove action to all elements in a tree.
   */
  #applyOnTree(tree: Node, action: 'add' | 'remove'): void {
    if (tree.parentElement) {
      const treeWalker = document.createTreeWalker(tree, NodeFilter.SHOW_ELEMENT);
      do {
        if (treeWalker.currentNode instanceof HTMLElement) {
          if (action === 'add') {
            if (treeWalker.currentNode.hasAttribute('injectors')) {
              this.#addInjector(treeWalker.currentNode);
            }
          } else {
            this.#removeInjector(treeWalker.currentNode);
          }
        }
      } while (treeWalker.nextNode());
    }
  }

  /**
   * Start observing an element for changes.
   */
  #observe(element: Element): void {
    const observer = this.#getRootObserver(element);

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributeFilter: ['injectors', 'providers'],
      attributes: true,
      attributeOldValue: true,
    });
  }

  /**
   * Stop observing an element.
   */
  #disconnect(element: Element): void {
    const observer = this.#getRootObserver(element);
    observer?.disconnect();
  }

  /**
   * Get or create observer for an element.
   */
  #getRootObserver(element: Element): MutationObserver {
    if (this.#observers.has(element)) {
      return this.#observers.get(element) as MutationObserver;
    }

    const observer = this.#getObserver();
    this.#observers.set(element, observer);
    return observer;
  }

  /**
   * Create a new MutationObserver.
   */
  #getObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const isAttributeMutation =
          mutation.target instanceof HTMLElement && mutation.attributeName;

        if (isAttributeMutation) {
          this.#update(mutation.target, mutation.attributeName);
        } else {
          if (mutation.addedNodes) {
            Array.from(mutation.addedNodes).forEach((addedNode) => {
              this.#addInjectorsOnTree(addedNode);
            });
          }

          if (mutation.removedNodes) {
            Array.from(mutation.removedNodes).forEach((removedNode) => {
              this.#removeInjectorsFromTree(removedNode);
            });
          }
        }
      }
    });
  }
}
