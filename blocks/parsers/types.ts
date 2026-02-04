/**
 * Expression Types - Specific parsed expression types for the blocks layer
 *
 * These types extend the generic ParsedExpression from webexpressions
 * with specific structures for values, calls, and pipes.
 *
 * @module blocks/parsers
 */

import type { ParsedExpression } from '../../plugs/webexpressions';

/**
 * Types of parsed value references
 */
export type ParsedValue =
  | { type: 'magic'; name: string } // $event, $element
  | { type: 'context'; context: string; path: string } // @item.id, @theme.primary
  | { type: 'state'; path: string } // count, user.name (default context)
  | { type: 'literal'; value: string | number | boolean | null };

/**
 * A value reference expression ($event, @context.path, state.path)
 */
export interface ValueExpression extends ParsedExpression {
  type: 'value';
  /** The parsed value reference */
  value: ParsedValue;
}

/**
 * A function call expression (handler(args))
 */
export interface CallExpression extends ParsedExpression {
  type: 'call';
  /** The function/handler name */
  name: string;
  /** Parsed arguments */
  args: ParsedExpression[];
}

/**
 * A pipe/filter expression (value | filter)
 */
export interface PipeExpression extends ParsedExpression {
  type: 'pipe';
  /** The input expression */
  input: ParsedExpression;
  /** The filter name */
  filter: string;
  /** Optional filter arguments */
  filterArgs: ParsedExpression[];
}
