/**
 * Node.cloneNode.patch.ts - Enhanced cloneNode using pluggable handlers
 * 
 * Source: plateau/src/plugs/custom-elements/Node.patch.ts (lines 64-180)
 * 
 * This patch enhances Node.prototype.cloneNode to support custom node types
 * through a pluggable handler system. Each plug (webcomponents, webexpressions, etc.)
 * registers handlers for its node types, enabling modular cloning without
 * cross-dependencies.
 * 
 * @module webcomponents
 */

import { cloneHandlerRegistry } from '../core';
import { createPairedWalkers } from '../core/cloneUtils';

const baseDescriptor = { configurable: true, enumerable: true };

/**
 * Store original cloneNode descriptor (captured on module load).
 */
const cloneNodeDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'cloneNode');

/**
 * Apply cloneNode patch to Node.prototype.
 */
export function applyCloneNodePatch(): void {
  if (isCloneNodePatched()) {
    console.warn('Node.cloneNode patch already applied');
    return;
  }

  Object.defineProperty(Node.prototype, 'cloneNode', {
    ...baseDescriptor,
    value: function cloneNode(this: Node, deep: boolean = false): Node {
      const clone = cloneNodeDescriptor!.value!.call(this, deep);

      // For shallow clones, just process with handlers
      if (!deep) {
        return cloneHandlerRegistry.process({
          originalNode: this,
          clonedNode: clone,
          deep: false
        });
      }

      // For deep clones, walk the tree and process each node
      const [originalWalker, cloneWalker] = createPairedWalkers(this, clone);

      // Process children (skip root as it's handled at the end)
      while (originalWalker.nextNode() && cloneWalker.nextNode()) {
        const result = cloneHandlerRegistry.process({
          originalNode: originalWalker.currentNode,
          clonedNode: cloneWalker.currentNode,
          deep: true,
          originalWalker,
          clonedWalker: cloneWalker
        });
        
        // If handler replaced the node, update walker position
        if (result !== cloneWalker.currentNode && result.parentNode) {
          cloneWalker.currentNode = result;
        }
      }

      // Fix root clone prototype
      return cloneHandlerRegistry.process({
        originalNode: this,
        clonedNode: clone,
        deep: false
      });
    },
  });

  // Also add 'determined' property to HTMLElement.prototype (for elements) and Node.prototype (for all nodes)
  Object.defineProperty(HTMLElement.prototype, 'determined', {
    ...baseDescriptor,
    get() {
      return (this as any).localName !== 'undetermined';
    },
    set() {
      // Read-only (setter does nothing)
    },
  });

  Object.defineProperty(Node.prototype, 'determined', {
    ...baseDescriptor,
    get() {
      return (this as any).localName !== 'undetermined';
    },
    set() {
      // Read-only (setter does nothing)
    },
  });
}

/**
 * Remove cloneNode patch from Node.prototype.
 */
export function removeCloneNodePatch(): void {
  if (!isCloneNodePatched()) {
    console.warn('Node.cloneNode patch not applied');
    return;
  }

  if (cloneNodeDescriptor) {
    Object.defineProperty(Node.prototype, 'cloneNode', cloneNodeDescriptor);
  }

  delete (HTMLElement.prototype as any).determined;
  delete (Node.prototype as any).determined;
}

/**
 * Check if cloneNode patch is applied.
 */
export function isCloneNodePatched(): boolean {
  return 'determined' in Node.prototype;
}
