/**
 * @module webexpressions
 * @description Custom Text Node system for reactive text content
 * 
 * Web Expressions enable reactive text nodes with lifecycle management and
 * parser integration for declarative syntax (e.g., template expressions).
 * 
 * @example
 * ```typescript
 * import { CustomTextNode, CustomTextNodeRegistry } from '@web-everything/webexpressions';
 * 
 * // Define a custom text node
 * class ExpressionTextNode extends CustomTextNode {
 *   connectedCallback() {
 *     console.log('Expression connected:', this.textContent);
 *   }
 * 
 *   textChangedCallback(oldValue, newValue) {
 *     console.log('Text changed:', oldValue, '->', newValue);
 *   }
 * }
 * 
 * // Register and activate
 * const registry = new CustomTextNodeRegistry();
 * registry.define('expression', ExpressionTextNode);
 * registry.upgrade(document.body);
 * 
 * // Create programmatically
 * const expr = new ExpressionTextNode({ children: 'Hello World' });
 * document.body.appendChild(expr);
 * ```
 * 
 * @see https://github.com/chalbert/web-everything/tree/main/plugs/webexpressions
 */

export { default as CustomTextNode } from './CustomTextNode';
export { default as CustomTextNodeRegistry } from './CustomTextNodeRegistry';
export { default as UndeterminedTextNode } from './UndeterminedTextNode';
export { registerCloneHandlers, unregisterCloneHandlers } from './cloneHandlers';

export type {
  CustomTextNodeOptions,
  ImplementedTextNode,
} from './CustomTextNode';

export type {
  TextNodeDefinition,
} from './CustomTextNodeRegistry';

/**
 * Apply webexpressions patches (registers clone handlers).
 */
export function applyPatches(): void {
  registerCloneHandlers();
  console.log('[webexpressions] Clone handlers registered');
}

/**
 * Remove webexpressions patches (unregisters clone handlers).
 */
export function removePatches(): void {
  unregisterCloneHandlers();
  console.log('[webexpressions] Clone handlers unregistered');
}

// Log module load in development
if (process.env.NODE_ENV !== 'production') {
  console.log('[webexpressions] Custom Text Node system ready');
}
