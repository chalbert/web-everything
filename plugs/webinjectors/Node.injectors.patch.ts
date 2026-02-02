/**
 * Node.injectors.patch.ts - Adds injector traversal methods to Node.prototype
 * 
 * Source: plateau/src/plugs/custom-elements/Node.patch.ts (lines 181-273)
 * 
 * This patch adds injector-related methods to Node.prototype:
 * - getOwnInjector(): Get the injector directly attached to this node
 * - hasOwnInjector(): Check if this node has its own injector
 * - getClosestInjector(): Find the nearest injector in the hierarchy
 * - injectors(): Generator that yields all injectors up the chain
 * 
 * Also tracks creation injectors via WeakMap for nodes created during injection.
 * 
 * @module webinjectors
 */

import HTMLInjector, { HTMLInjectorTarget } from './HTMLInjector';
import InjectorRoot from './InjectorRoot';

const baseDescriptor = { configurable: true, enumerable: true };

/**
 * Tracks the injector context when a node is created.
 * Set by InjectorRoot.creationInjector during element creation.
 */
const creationInjectors = new WeakMap<Node, HTMLInjector>();

/**
 * Store reference to original Node constructor (captured on module load).
 */
const OriginalNode = window.Node;

/**
 * Store reference to original document.createElement (captured on module load).
 */
const originalCreateElement = Document.prototype.createElement;

/**
 * Apply injector patches to Node.prototype.
 */
export function applyNodeInjectorsPatches(): void {
  if (isNodeInjectorsPatched()) {
    console.warn('Node.injectors patches already applied');
    return;
  }

  // Intercept Node constructor to capture creation injector
  function PatchedNode(this: any) {
    const node = Reflect.construct(OriginalNode, arguments, new.target || PatchedNode);
    if (InjectorRoot.creationInjector) {
      creationInjectors.set(node, InjectorRoot.creationInjector);
    }
    return node;
  }

  // Ensure instanceof checks still work
  Object.defineProperty(PatchedNode, Symbol.hasInstance, {
    value: (instance: any) => {
      return instance instanceof OriginalNode;
    },
  });

  // Share the same prototype so added properties are visible
  PatchedNode.prototype = OriginalNode.prototype;
  Object.setPrototypeOf(PatchedNode, Object.getPrototypeOf(OriginalNode));

  Object.defineProperty(window, 'Node', {
    ...baseDescriptor,
    value: PatchedNode,
  });

  // Patch document.createElement to track creation injectors
  Document.prototype.createElement = function(tagName: string, options?: ElementCreationOptions): HTMLElement {
    const element = originalCreateElement.call(this, tagName, options);
    if (InjectorRoot.creationInjector) {
      creationInjectors.set(element, InjectorRoot.creationInjector);
    }
    return element;
  };

  // Add injector methods to Node.prototype
  Object.defineProperties(OriginalNode.prototype, {
    getOwnInjector: {
      ...baseDescriptor,
      value(this: Node) {
        if (this instanceof HTMLElement) {
          const root = this.getRootNode();
          const target = root === document ? window : (root as ShadowRoot);
          const registry = (target as any).injectors;
          if (registry) {
            const elementInjector = registry.getInjectorOf(this);
            return elementInjector;
          }
        }

        return null;
      },
    },

    hasOwnInjector: {
      ...baseDescriptor,
      value(this: Node) {
        return Boolean(this.getOwnInjector());
      },
    },

    getClosestInjector: {
      ...baseDescriptor,
      value(this: Node) {
        const rootNode = this.getRootNode();
        const root =
          rootNode instanceof DocumentFragment
            ? (rootNode as any).ownerTemplate?.getRootNode()
            : rootNode;
        const target = root === document ? window : (root as ShadowRoot);
        const registry = (target as any)?.injectors;

        if (registry) {
          if (root === this) {
            return registry.getInjectorOf(this as RootNode);
          }

          let currentElement: Node | null = this;

          if (currentElement) {
            do {
              if (currentElement instanceof HTMLElement || (currentElement as any).constructor.name === 'CustomComment') {
                const injector = registry.getInjectorOf(currentElement as HTMLElement);
                if (injector) return injector;
              }

              // Check previous siblings for injectors (handles CustomComment case)
              let currentSibling: Node | null = currentElement;
              const closedComments: Comment[] = [];
              while ((currentSibling = currentSibling?.previousSibling)) {
                // TODO: Import ClosingComment when webcomments is migrated
                if ((currentSibling as any).constructor.name === 'ClosingComment') {
                  closedComments.push(currentSibling as Comment);
                } else if (
                  (currentSibling as any).constructor.name === 'CustomComment' &&
                  !closedComments.includes(currentSibling as Comment)
                ) {
                  const injectorRoot = InjectorRoot.getInjectorRootOf(currentSibling);
                  const injector = injectorRoot?.getInjectorOf(currentSibling as any);
                  if (injector) {
                    return injector;
                  }
                }
              }

              currentElement =
                currentElement instanceof DocumentFragment
                  ? (currentElement as any).ownerTemplate
                  : currentElement.parentElement;
            } while (currentElement);

            const newRootNode = this.getRootNode() as HTMLInjectorTarget;
            return registry.getInjectorOf(newRootNode);
          }
        }

        // Fallback to creation injector
        const creationInjector = creationInjectors.get(this);
        if (creationInjector) {
          return creationInjector;
        }

        return null;
      },
    },

    injectors: {
      ...baseDescriptor,
      *value(this: Node): Generator<HTMLInjector> {
        let injector = (this as any).getClosestInjector();
        while (injector) {
          yield injector;
          injector = injector.parentInjector;
        }
      },
    },
  });
}

/**
 * R// Restore original createElement
    Document.prototype.createElement = originalCreateElement;

    emove injector patches from Node.prototype.
 */
export function removeNodeInjectorsPatches(): void {
  if (OriginalNode) {
    Object.defineProperty(window, 'Node', {
      ...baseDescriptor,
      value: OriginalNode,
    });

    delete (OriginalNode.prototype as any).getOwnInjector;
    delete (OriginalNode.prototype as any).hasOwnInjector;
    delete (OriginalNode.prototype as any).getClosestInjector;
    delete (OriginalNode.prototype as any).injectors;
  }
}

/**
 * Check if Node.injectors patches are applied.
 */
export function isNodeInjectorsPatched(): boolean {
  return 'injectors' in Node.prototype;
}
