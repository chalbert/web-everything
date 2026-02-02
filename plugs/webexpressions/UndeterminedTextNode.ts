/**
 * @file UndeterminedTextNode.ts
 * @description Placeholder for text nodes that haven't been resolved yet
 * @source Migrated from plateau/src/plugs/custom-text-nodes/UndeterminedTextNode.ts
 */

import CustomTextNode from './CustomTextNode';

/**
 * Placeholder class for undetermined custom text nodes
 * 
 * This class represents text nodes created before their type can be determined,
 * typically when parsers identify special syntax but the registry isn't available yet.
 * 
 * @example
 * ```typescript
 * const undetermined = new UndeterminedTextNode({ children: '{{expression}}' });
 * undetermined.parserName = 'expression';
 * undetermined.determined = false;
 * // Later, when registry is available, upgrade to ExpressionTextNode
 * ```
 */
export default class UndeterminedTextNode extends CustomTextNode {
  /**
   * Parser name for this undetermined text node
   * Set by parsers to indicate which text node type to resolve to
   */
  parserName: string | null = null;

  /**
   * Always false for undetermined text nodes
   * Indicates this node needs resolution
   */
  determined = false;
}
