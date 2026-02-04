/**
 * CustomExpressionParserRegistry - Registry for expression parsers
 *
 * Manages custom expression parsers with a generic reduce-based parsing strategy.
 * The registry has NO knowledge of specific parser types - it simply iterates
 * parsers in definition order and passes context.
 *
 * The reduce pattern works as follows:
 * 1. Start with input and null previous expression
 * 2. Try each parser in order with current input and context
 * 3. First parser that matches returns parsed result and remaining text
 * 4. Continue with remaining text, passing parsed result as previous expression
 * 5. Repeat until no parser matches or no remaining text
 *
 * This enables combinators like pipe to wrap previous results without
 * the registry knowing about pipe-specific logic.
 *
 * @module webexpressions
 */

import CustomRegistry from '../core/CustomRegistry';
import CustomExpressionParser, {
  type ParseResult,
  type ParsedExpression,
  type ParseContext,
  type Query,
} from './CustomExpressionParser';

/**
 * Result of parsing through the registry
 */
export interface RegistryParseResult {
  /** Successfully parsed expressions */
  expressions: ParsedExpression[];
  /** Aggregated queries from all expressions (deduplicated) */
  queries: Query[];
  /** Any remaining unparsed text */
  remaining: string;
  /** Whether parsing was successful (no remaining text) */
  success: boolean;
}

/**
 * Registry for custom expression parsers
 *
 * Uses a generic reduce pattern - no knowledge of specific parser types.
 *
 * @example
 * ```typescript
 * const registry = new CustomExpressionParserRegistry();
 *
 * // Define parsers in order of precedence
 * registry.define('value', new ValueParser());
 * registry.define('call', new CallParser());
 * registry.define('pipe', new PipeParser());
 *
 * // Parse an expression - registry just iterates parsers
 * const result = registry.parse('name | uppercase');
 * // 1. ValueParser matches 'name', returns { parsed, remaining: ' | uppercase' }
 * // 2. PipeParser matches '| uppercase' with previousExpression, combines them
 * // 3. Result: { expressions: [PipeExpression], remaining: '', success: true }
 * ```
 */
export default class CustomExpressionParserRegistry extends CustomRegistry<CustomExpressionParser> {
  localName = 'customExpressionParsers';

  /**
   * Define a parser with a name
   *
   * @param name - The parser name
   * @param parser - The parser instance
   */
  define(name: string, parser: CustomExpressionParser): void {
    parser.localName = name;
    this.set(name, parser);
  }

  /**
   * Parse input through all registered parsers using reduce pattern.
   *
   * The registry is GENERIC - it has no knowledge of specific parser types.
   * It simply:
   * 1. Tries each parser in definition order
   * 2. Passes context with previous expression to each parser
   * 3. First parser that matches wins
   * 4. Continues with remaining text
   *
   * This allows combinators (like pipe) to work by receiving and combining
   * with the previous expression via context.
   *
   * @param input - The input string to parse
   * @returns RegistryParseResult with expressions and remaining text
   */
  parse(input: string): RegistryParseResult {
    const expressions: ParsedExpression[] = [];
    let remaining = input.trim();
    let previousExpression: ParsedExpression | undefined = undefined;

    // Keep parsing until no more input or no parser matches
    while (remaining) {
      const context: ParseContext = { previousExpression };
      const result = this.#tryParsers(remaining, context);

      if (result) {
        // Parser matched - update state
        previousExpression = result.parsed;
        remaining = result.remaining.trim();
      } else {
        // No parser matched - stop
        break;
      }
    }

    // Add the final parsed expression (if any)
    if (previousExpression) {
      expressions.push(previousExpression);
    }

    // Aggregate queries from all expressions
    const queries = this.#aggregateQueries(expressions);

    return {
      expressions,
      queries,
      remaining,
      success: remaining === '',
    };
  }

  /**
   * Aggregate and deduplicate queries from all expressions
   */
  #aggregateQueries(expressions: ParsedExpression[]): Query[] {
    const seen = new Set<string>();
    const queries: Query[] = [];

    for (const expr of expressions) {
      if (!expr.queries) continue;

      for (const query of expr.queries) {
        const key = query.type === 'magic'
          ? `magic:${query.name}`
          : `context:${query.context}`;

        if (!seen.has(key)) {
          seen.add(key);
          queries.push(query);
        }
      }
    }

    return queries;
  }

  /**
   * Try all parsers in definition order on the input.
   * Returns first successful parse result.
   */
  #tryParsers(input: string, context: ParseContext): ParseResult | null {
    const parsers = this.values();

    for (const parser of parsers) {
      const result = parser.tryParse(input, context);
      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * Get all parsers in definition order
   */
  *parsers(): Generator<CustomExpressionParser> {
    for (const parser of this.values()) {
      yield parser;
    }
  }

  upgrade(): void {
    // No DOM upgrade needed for parsers
  }

  downgrade(): void {
    // No DOM downgrade needed for parsers
  }
}
