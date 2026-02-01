/**
 * @file Node.contexts.patch.ts
 * @description Adds custom context methods to Node.prototype
 * @source Migrated from plateau/src/plugs/custom-elements/Node.patch.ts (lines 274-447)
 */

import InjectorRoot from '../webinjectors/InjectorRoot';
import HTMLInjector from '../webinjectors/HTMLInjector';
import type CustomContext from './CustomContext';

// Store original methods
const OriginalNode = Node;
let _patchApplied = false;

/**
 * Check if the contexts patch has been applied
 */
export function isContextsPatchApplied(): boolean {
  return _patchApplied;
}

/**
 * Apply the contexts patch to Node.prototype
 * Adds context management methods to DOM nodes
 */
export function applyNodeContextsPatch(): void {
  if (_patchApplied) {
    console.warn('Node.contexts patch already applied');
    return;
  }

  const baseDescriptor = {
    configurable: true,
    enumerable: false,
    writable: true,
  };

  // createElement: Enhanced to support custom element lookup via injectors
  Object.defineProperty(Node.prototype, 'createElement', {
    ...baseDescriptor,
    value(this: Node, tagName: string, options?: ElementCreationOptions) {
      const elementLookup = options?.is || tagName;
      if (elementLookup.includes('-')) {
        const injectors = this.injectors();
        let currentInjector: HTMLInjector;
        while ((currentInjector = injectors.next()?.value)) {
          const customElements = currentInjector.get('customElements');
          const Element = customElements?.get(elementLookup);
          if (Element) {
            return Reflect.construct(Element, []);
          }
        }
      }

      return document.createElement(tagName as keyof HTMLElementTagNameMap, options);
    },
  });

  // createContext: Creates a new context instance by traversing injectors
  Object.defineProperty(Node.prototype, 'createContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string): CustomContext<any> | undefined {
      const injectors = this.injectors();
      let currentInjector: HTMLInjector;
      while ((currentInjector = injectors.next()?.value)) {
        const customContextTypes = currentInjector.get('customContextTypes');
        const Context = customContextTypes?.get(contextType);
        if (Context) {
          return Reflect.construct(Context, []);
        }
      }
      return undefined;
    },
  });

  // getContext: Retrieves an existing context by traversing the injector hierarchy
  Object.defineProperty(Node.prototype, 'getContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string): CustomContext<any> | undefined {
      const injectors = this.injectors();
      let currentInjector: HTMLInjector;
      while ((currentInjector = injectors.next()?.value)) {
        const customContext = currentInjector.get(`customContexts:${contextType}`);
        if (customContext) {
          return customContext;
        }
      }
      return undefined;
    },
  });

  // ensureContext: Gets existing or creates new context
  Object.defineProperty(Node.prototype, 'ensureContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string): CustomContext<any> {
      const existingContext = this.getOwnContext(contextType);
      if (existingContext) {
        return existingContext;
      }
      const newContext: CustomContext<any> = this.createContext(contextType);
      newContext.attach(this);
      return newContext;
    },
  });

  // getOwnContext: Gets context directly attached to this node
  Object.defineProperty(Node.prototype, 'getOwnContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string): CustomContext<any> | null {
      const injectorRoot = InjectorRoot.getInjectorRootOf(this);
      if (injectorRoot) {
        const injector = injectorRoot.ensureInjector(this);
        if (injector) {
          const context = injector.get(`customContexts:${contextType}`);
          return context || null;
        }
      }
      return null;
    },
  });

  // hasContext: Checks if context exists in hierarchy
  Object.defineProperty(Node.prototype, 'hasContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string): boolean {
      return Boolean(this.getContext(contextType));
    },
  });

  // hasOwnContext: Checks if context is directly attached to this node
  Object.defineProperty(Node.prototype, 'hasOwnContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string): boolean {
      const injectorRoot = InjectorRoot.getInjectorRootOf(this);
      if (injectorRoot) {
        const injector = injectorRoot.ensureInjector(this);
        if (injector) {
          const context = injector.get(`customContexts:${contextType}`);
          return Boolean(context);
        }
      }
      return false;
    },
  });

  // queryContext: Queries context with path expression
  Object.defineProperty(Node.prototype, 'queryContext', {
    ...baseDescriptor,
    value(this: Node, contextType: string, query: any): any {
      const currentInjector = this.getClosestInjector();
      const consumable = currentInjector.consume(`customContexts:${contextType}/${query}`, this);
      return consumable;
    },
  });

  _patchApplied = true;
  console.log('[webcontexts] Node.contexts patch applied');
}

/**
 * Remove the contexts patch from Node.prototype
 */
export function removeNodeContextsPatch(): void {
  if (!_patchApplied) {
    console.warn('Node.contexts patch not applied, nothing to remove');
    return;
  }

  // Remove all added methods
  delete (Node.prototype as any).createElement;
  delete (Node.prototype as any).createContext;
  delete (Node.prototype as any).getContext;
  delete (Node.prototype as any).ensureContext;
  delete (Node.prototype as any).getOwnContext;
  delete (Node.prototype as any).hasContext;
  delete (Node.prototype as any).hasOwnContext;
  delete (Node.prototype as any).queryContext;

  _patchApplied = false;
  console.log('[webcontexts] Node.contexts patch removed');
}

// Type augmentation for TypeScript
declare global {
  interface Node {
    /**
     * Create an element, checking custom element registries in the injector hierarchy
     */
    createElement(tagName: string, options?: ElementCreationOptions): HTMLElement;

    /**
     * Create a new context instance of the specified type
     */
    createContext(contextType: string): CustomContext<any> | undefined;

    /**
     * Get an existing context by traversing the injector hierarchy
     */
    getContext(contextType: string): CustomContext<any> | undefined;

    /**
     * Get existing or create new context
     */
    ensureContext(contextType: string): CustomContext<any>;

    /**
     * Get context directly attached to this node (does not traverse hierarchy)
     */
    getOwnContext(contextType: string): CustomContext<any> | null;

    /**
     * Check if context exists in the injector hierarchy
     */
    hasContext(contextType: string): boolean;

    /**
     * Check if context is directly attached to this node
     */
    hasOwnContext(contextType: string): boolean;

    /**
     * Query a context with a path expression
     */
    queryContext(contextType: string, query: any): any;
  }
}
