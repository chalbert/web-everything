/**
 * CustomExpressionParser - Base class for expression parsers
 *
 * Expression parsers parse actual expression content (values, calls, pipes).
 * They are distinct from attribute parsers which handle attribute syntax/delimiters.
 *
 * Parsers are composable using the reduce pattern:
 * - Each parser can partially parse and return remaining text
 * - Parsers can optionally combine with a previous expression (e.g., pipe wrapping)
 *
 * @module webexpressions
 */

/**
 * Context query - resolved from injector chain
 */
export interface ContextQuery {
  type: 'context';
  /** Context name to query */
  context: string;
  /** Path within the context (optional) */
  path?: string;
}

/**
 * Magic query - runtime values provided by consumer
 */
export interface MagicQuery {
  type: 'magic';
  /** Magic variable name: 'event', 'element', 'target' */
  name: string;
}

/**
 * Union of all query types
 */
export type Query = ContextQuery | MagicQuery;

/**
 * Resolved values passed to evaluate()
 */
export interface ResolvedValues {
  /** Resolved contexts (from injector chain) */
  contexts: Record<string, unknown>;
  /** Magic values (from consumer runtime) */
  magic: Record<string, unknown>;
}

/**
 * Base interface for all parsed expressions.
 * Specific expression types extend this in the blocks layer.
 */
export interface ParsedExpression {
  /** Type discriminator for the expression */
  type: string;
  /** Raw expression string */
  raw: string;
  /** Queries this expression needs */
  queries: Query[];
  /** Evaluate with resolved values (optional, can be implemented by specific types) */
  evaluate?(resolved: ResolvedValues): unknown;
}

/**
 * Result of a composable parse operation
 */
export interface ParseResult<T = ParsedExpression> {
  /** The parsed expression data */
  parsed: T;
  /** Remaining unparsed text (for next parser in chain) */
  remaining: string;
}

/**
 * Context passed to parsers during reduce pattern
 */
export interface ParseContext {
  /**
   * The previously parsed expression (if any).
   * Used by combinators like pipe to wrap previous results.
   */
  previousExpression?: ParsedExpression;
}

/**
 * Base class for custom expression parsers
 *
 * Expression parsers parse the content of expressions, not their surrounding
 * syntax. They are used by attribute parsers to process expression content.
 *
 * Parsers are composable - each parser can:
 * 1. Attempt to parse the input
 * 2. Return parsed data with remaining text for the next parser
 * 3. Return null if it doesn't match the input
 * 4. Optionally use previous expression context for combining (e.g., pipes)
 *
 * @example
 * ```typescript
 * class MyParser extends CustomExpressionParser {
 *   tryParse(input: string, context?: ParseContext): ParseResult | null {
 *     // Parse input, return { parsed, remaining } or null
 *   }
 * }
 * ```
 */
export default abstract class CustomExpressionParser<T extends ParsedExpression = ParsedExpression> {
  /**
   * Local name when registered in a registry
   */
  localName: string | null = null;

  /**
   * Try to parse the input string.
   * Returns ParseResult with parsed data and remaining text, or null if no match.
   *
   * @param input - The input string to parse
   * @param context - Optional context containing previous expression for combinators
   * @returns ParseResult with parsed data and remaining text, or null
   */
  abstract tryParse(input: string, context?: ParseContext): ParseResult<T> | null;
}
