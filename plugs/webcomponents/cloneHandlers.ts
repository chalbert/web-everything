/**
 * cloneHandlers.ts - Clone handlers for webcomponents
 * 
 * Registers handlers for cloning CustomElement instances and restoring
 * prototypes for HTML elements with overridden constructors.
 * 
 * @module webcomponents
 */

import { cloneHandlerRegistry, type CloneHandler, type CloneContext } from '../core';
import { 
  fixPrototype, 
  copyOptions, 
  reconstructNode,
  copyAttributes,
  moveChildren,
  replaceNode
} from '../core/cloneUtils';

/**
 * Store references to original HTML constructors.
 * Used to detect when elements have overridden prototypes.
 */
const originalElements: Record<string, any> = {};

/**
 * Initialize original HTML element constructors.
 */
function initializeOriginalElements(): void {
  [
    'HTMLElement',
    'HTMLDivElement',
    'HTMLSpanElement',
    'HTMLInputElement',
    'HTMLButtonElement',
    'HTMLFormElement',
    'HTMLAnchorElement',
    'HTMLImageElement',
    'HTMLTableElement',
    // Add more as discovered
  ].forEach((name) => {
    if ((window as any)[name]) {
      originalElements[name] = (window as any)[name];
    }
  });
}

/**
 * Handler for CustomElement instances with options.
 */
const customElementHandler: CloneHandler = {
  name: 'customElement',

  matches(node: Node): boolean {
    // Check if it's an element with custom options
    // Use nodeType to avoid instanceof issues across different global contexts
    return node.nodeType === 1 && 'options' in node;
  },

  clone(context: CloneContext): Node {
    const { originalNode, clonedNode } = context;
    const options = (originalNode as any).options;

    // Try to reconstruct the element with options
    try {
      const Constructor = originalNode.constructor as any;
      const newElement = reconstructNode(Constructor, options);
      
      // Copy attributes and children
      if (clonedNode instanceof Element && newElement instanceof Element) {
        copyAttributes(clonedNode, newElement);
        moveChildren(clonedNode, newElement);
      }
      
      // Preserve options
      copyOptions(originalNode, newElement);
      
      // Replace cloned node with reconstructed element in DOM
      if (replaceNode(clonedNode, newElement)) {
        return newElement;
      }
      
      // If replacement failed (node not in DOM yet), return reconstructed anyway
      return newElement;
    } catch {
      // If reconstruction fails, just fix prototype and copy options
      fixPrototype(originalNode, clonedNode);
      copyOptions(originalNode, clonedNode);
      return clonedNode;
    }
  }
};

/**
 * Handler for standard HTML elements with overridden prototypes.
 */
const overriddenElementHandler: CloneHandler = {
  name: 'overriddenElement',

  matches(node: Node): boolean {
    if (!(node instanceof HTMLElement)) return false;
    
    // Check if this element's constructor has been overridden
    const { name } = node.constructor;
    return originalElements[name] && node instanceof originalElements[name];
  },

  clone(context: CloneContext): Node {
    const { originalNode, clonedNode } = context;
    const { name } = clonedNode.constructor;

    // Set direct parent class to overridden class
    Object.setPrototypeOf(clonedNode, (window as any)[name].prototype);

    // Fix HTMLElement ancestor in prototype chain
    const proto1 = Object.getPrototypeOf(clonedNode);
    const proto2 = Object.getPrototypeOf(proto1);
    const proto3 = Object.getPrototypeOf(proto2);
    const BaseHTMLConstructor = proto3?.constructor;

    if (BaseHTMLConstructor === originalElements.HTMLElement) {
      Object.setPrototypeOf(proto2, window.HTMLElement.prototype);
    }

    return clonedNode;
  }
};

/**
 * Handler for generic HTML/DocumentFragment/Comment nodes.
 * Fixes prototype to match original constructor.
 * Excludes undetermined elements (handled by undeterminedElementHandler).
 */
const genericNodeHandler: CloneHandler = {
  name: 'genericNode',

  matches(node: Node): boolean {
    // Exclude undetermined elements - they have their own handler
    if (node instanceof HTMLElement && (node as any).localName === 'undetermined') {
      return false;
    }
    
    return (
      node instanceof HTMLElement ||
      node instanceof DocumentFragment ||
      node instanceof Comment
    );
  },

  clone(context: CloneContext): Node {
    fixPrototype(context.originalNode, context.clonedNode);
    return context.clonedNode;
  }
};

/**
 * Handler for undetermined elements.
 * Restores prototype and options for elements with localName === 'undetermined'.
 */
const undeterminedElementHandler: CloneHandler = {
  name: 'undeterminedElement',

  matches(node: Node): boolean {
    // Use nodeType check instead of instanceof to avoid global reference issues
    const isElement = node.nodeType === 1; // Node.ELEMENT_NODE
    const localName = (node as any).localName;
    const isUndetermined = localName === 'undetermined';
    
    return isElement && isUndetermined;
  },

  clone(context: CloneContext): Node {
    const { originalNode, clonedNode } = context;
    
    // Restore prototype
    const originalProto = Object.getPrototypeOf(originalNode);
    Object.setPrototypeOf(clonedNode, originalProto);
    
    // Copy options if present
    if ('options' in originalNode) {
      (clonedNode as any).options = (originalNode as any).options;
    }
    
    return clonedNode;
  }
};

/**
 * Register all webcomponents clone handlers.
 * Called when the webcomponents plug is loaded.
 */
export function registerCloneHandlers(): void {
  initializeOriginalElements();
  cloneHandlerRegistry.register(customElementHandler);
  cloneHandlerRegistry.register(overriddenElementHandler);
  cloneHandlerRegistry.register(undeterminedElementHandler);
  cloneHandlerRegistry.register(genericNodeHandler);
}

/**
 * Unregister all webcomponents clone handlers.
 * Called when cleaning up the plug.
 */
export function unregisterCloneHandlers(): void {
  cloneHandlerRegistry.unregister('customElement');
  cloneHandlerRegistry.unregister('overriddenElement');
  cloneHandlerRegistry.unregister('undeterminedElement');
  cloneHandlerRegistry.unregister('genericNode');
}
