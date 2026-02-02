/**
 * cloneHandlers.ts - Clone handlers for webexpressions
 * 
 * Registers handlers for cloning CustomTextNode instances, including
 * undetermined nodes that need prototype restoration.
 * 
 * @module webexpressions
 */

import { cloneHandlerRegistry, type CloneHandler, type CloneContext } from '../core';
import { reconstructNode, replaceNode } from '../core/cloneUtils';

/**
 * Handler for CustomTextNode instances.
 */
const customTextNodeHandler: CloneHandler = {
  name: 'customTextNode',

  matches(node: Node): boolean {
    return (node as any).constructor?.name === 'CustomTextNode';
  },

  clone(context: CloneContext): Node {
    const { originalNode, clonedNode } = context;
    
    try {
      const Constructor = originalNode.constructor as any;
      const textContent = (originalNode as any).textContent;
      const options = (originalNode as any).options;
      
      const newTextNode = reconstructNode(Constructor, {
        children: textContent,
        ...options,
      });
      
      // Replace in parent if possible
      replaceNode(clonedNode, newTextNode);
      
      return newTextNode;
    } catch {
      // If reconstruction fails, keep original clone
      return clonedNode;
    }
  }
};

/**
 * Handler for undetermined CustomTextNode instances in deep clones.
 * Restores prototype and properties for text nodes that haven't been determined yet.
 */
const undeterminedTextNodeHandler: CloneHandler = {
  name: 'undeterminedTextNode',

  matches(node: Node): boolean {
    return (
      node.nodeType === Node.TEXT_NODE &&
      (node as any).constructor?.name === 'CustomTextNode' &&
      (node as any).determined === false
    );
  },

  clone(context: CloneContext): Node {
    const { originalNode, clonedNode } = context;
    
    // Restore prototype
    Object.setPrototypeOf(clonedNode, originalNode.constructor.prototype);
    
    // Restore properties
    if ((originalNode as any).parserName) {
      (clonedNode as any).parserName = (originalNode as any).parserName;
    }
    
    (clonedNode as any).options = {
      children: (originalNode as any).textContent,
    };
    
    return clonedNode;
  }
};

/**
 * Register all webexpressions clone handlers.
 * Called when the webexpressions plug is loaded.
 */
export function registerCloneHandlers(): void {
  cloneHandlerRegistry.register(customTextNodeHandler);
  cloneHandlerRegistry.register(undeterminedTextNodeHandler);
}

/**
 * Unregister all webexpressions clone handlers.
 * Called when cleaning up the plug.
 */
export function unregisterCloneHandlers(): void {
  cloneHandlerRegistry.unregister('customTextNode');
  cloneHandlerRegistry.unregister('undeterminedTextNode');
}
