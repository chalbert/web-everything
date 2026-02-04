/**
 * PipeParser - Parser for pipe/filter expressions
 *
 * Parses filter syntax (Angular/Vue style):
 * - `value | filter` - Simple filter
 * - `value | filter:arg` - Filter with argument
 * - `value | filter:arg1:arg2` - Filter with multiple arguments
 * - `value | filter1 | filter2` - Chained filters
 *
 * The pipe parser is unique - it uses context.previousExpression from the
 * registry's reduce pattern to wrap the previous result. This keeps the
 * registry generic with no knowledge of pipe-specific logic.
 *
 * @module blocks/parsers/pipe
 */

import {
  CustomExpressionParser,
  CustomExpressionParserRegistry,
  type ParseResult,
  type ParsedExpression,
  type ParseContext,
  type Query,
  type ResolvedValues,
} from '../../../plugs/webexpressions';
import type { PipeExpression } from '../types';

/**
 * Resolve a dot-separated path on an object
 */
function resolvePath(path: string, obj: unknown): unknown {
  if (!path) return obj;
  if (obj === null || obj === undefined) return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Create an evaluate function for a pipe expression
 */
function createPipeEvaluate(
  input: ParsedExpression,
  filter: string,
  filterArgs: ParsedExpression[]
): (resolved: ResolvedValues) => unknown {
  return (resolved: ResolvedValues): unknown => {
    // Evaluate input
    const inputValue = input.evaluate ? input.evaluate(resolved) : undefined;

    // Get filter function
    const filters = (resolved.contexts.filters ?? {}) as Record<string, (value: unknown, ...args: unknown[]) => unknown>;
    const filterFn = filters[filter];
    if (!filterFn) {
      console.warn(`[PipeParser] Filter "${filter}" not found`);
      return inputValue;
    }

    // Evaluate filter arguments
    const evaluatedArgs = filterArgs.map(arg => {
      if (arg.evaluate) {
        return arg.evaluate(resolved);
      }
      return undefined;
    });

    return filterFn(inputValue, ...evaluatedArgs);
  };
}

/**
 * Value types for fallback parsing
 */
type FallbackValue =
  | { type: 'magic'; name: string }
  | { type: 'context'; context: string; path: string }
  | { type: 'state'; path: string }
  | { type: 'literal'; value: string | number | boolean | null };

/**
 * Create an evaluate function for fallback values
 */
function createValueEvaluate(value: FallbackValue): (resolved: ResolvedValues) => unknown {
  return (resolved: ResolvedValues): unknown => {
    switch (value.type) {
      case 'magic':
        return resolvePath(value.name, resolved.magic);
      case 'context': {
        const contextValue = resolved.contexts[value.context];
        if (contextValue === undefined) return undefined;
        return value.path ? resolvePath(value.path, contextValue) : contextValue;
      }
      case 'state':
        return resolvePath(value.path, resolved.contexts.state);
      case 'literal':
        return value.value;
      default:
        return undefined;
    }
  };
}

/**
 * Pipe Parser
 *
 * This parser is different from others - it doesn't parse the initial value,
 * but rather transforms remaining text that starts with `|` into a pipe expression
 * by combining with context.previousExpression.
 *
 * The registry's reduce pattern passes the previous expression via context,
 * enabling this parser to work without the registry knowing about pipes.
 *
 * @example
 * ```typescript
 * // Used in conjunction with registry:
 * // Input: 'name | uppercase'
 * //
 * // 1. ValueParser parses 'name' → { type: 'value', ... }, remaining: ' | uppercase'
 * // 2. Registry continues with remaining, passes previousExpression in context
 * // 3. PipeParser matches '|', uses context.previousExpression to wrap
 * // 4. Returns: { type: 'pipe', input: {...}, filter: 'uppercase' }
 * ```
 */
export class PipeParser extends CustomExpressionParser<PipeExpression> {
  /**
   * The pipe operator character
   */
  static readonly PIPE_CHAR = '|';

  /**
   * The argument separator character
   */
  static readonly ARG_SEPARATOR = ':';

  /**
   * Optional parser registry for parsing filter arguments
   */
  #registry: CustomExpressionParserRegistry | null = null;

  /**
   * Set the parser registry for parsing filter arguments
   */
  setRegistry(registry: CustomExpressionParserRegistry): void {
    this.#registry = registry;
  }

  /**
   * Try to parse a pipe expression.
   *
   * Uses context.previousExpression to wrap the previous result.
   * This enables the registry to be generic - it just passes context,
   * and this parser uses it for combining.
   *
   * @param input - The input string (must start with |)
   * @param context - Context containing previousExpression to wrap
   */
  tryParse(input: string, context?: ParseContext): ParseResult<PipeExpression> | null {
    const trimmed = input.trim();

    // Must start with pipe operator
    if (!trimmed.startsWith(PipeParser.PIPE_CHAR)) return null;

    // Must have a previous expression to pipe from
    // This is critical - without it, we can't create a valid pipe
    const previousExpression = context?.previousExpression;
    if (!previousExpression) return null;

    // Parse: | filterName:arg1:arg2
    let pos = 1; // Skip the |
    while (pos < trimmed.length && /\s/.test(trimmed[pos])) pos++; // Skip whitespace

    // Parse filter name
    const filterStart = pos;
    while (pos < trimmed.length && /\w/.test(trimmed[pos])) pos++;

    if (pos === filterStart) return null; // No filter name

    const filter = trimmed.slice(filterStart, pos);

    // Parse optional arguments (colon-separated)
    const filterArgs: ParsedExpression[] = [];

    while (pos < trimmed.length && trimmed[pos] === PipeParser.ARG_SEPARATOR) {
      pos++; // Skip :

      // Parse argument
      const argResult = this.#parseArg(trimmed.slice(pos));
      if (argResult) {
        filterArgs.push(argResult.parsed);
        pos += argResult.consumed;
      } else {
        break;
      }
    }

    const pipeRaw = trimmed.slice(0, pos);
    const remaining = trimmed.slice(pos);

    // Collect queries: input queries + filter context + filter arg queries
    const queries: Query[] = [];

    // Add queries from input expression
    if (previousExpression.queries) {
      queries.push(...previousExpression.queries);
    }

    // Add filter query
    queries.push({ type: 'context', context: 'filters', path: filter });

    // Add queries from filter arguments
    for (const arg of filterArgs) {
      if (arg.queries) {
        queries.push(...arg.queries);
      }
    }

    // Combine with previous expression
    return {
      parsed: {
        type: 'pipe',
        raw: `${previousExpression.raw} ${pipeRaw}`,
        queries,
        input: previousExpression,
        filter,
        filterArgs,
        evaluate: createPipeEvaluate(previousExpression, filter, filterArgs),
      },
      remaining,
    };
  }

  /**
   * Parse a filter argument (until next : or | or end)
   */
  #parseArg(input: string): { parsed: ParsedExpression; consumed: number } | null {
    let pos = 0;
    let depth = 0;
    let inString = false;
    let stringChar = '';

    while (pos < input.length) {
      const char = input[pos];

      if (inString) {
        if (char === stringChar && input[pos - 1] !== '\\') {
          inString = false;
        }
        pos++;
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        pos++;
        continue;
      }

      if (char === '(' || char === '[' || char === '{') {
        depth++;
        pos++;
        continue;
      }

      if (char === ')' || char === ']' || char === '}') {
        depth--;
        pos++;
        continue;
      }

      // Stop at next : or | at depth 0
      if (depth === 0 && (char === ':' || char === '|' || /\s/.test(char))) {
        break;
      }

      pos++;
    }

    if (pos === 0) return null;

    const argStr = input.slice(0, pos).trim();
    if (!argStr) return null;

    // Parse the argument
    const parsed = this.#parseValue(argStr);
    if (!parsed) return null;

    return { parsed, consumed: pos };
  }

  /**
   * Parse a value for filter argument
   */
  #parseValue(argStr: string): ParsedExpression | null {
    // If we have a registry, use it
    if (this.#registry) {
      const result = this.#registry.parse(argStr);
      if (result.success && result.expressions.length > 0) {
        return result.expressions[0];
      }
    }

    // Fallback parsing
    const trimmed = argStr.trim();

    // Magic variable
    if (trimmed.startsWith('$')) {
      const match = trimmed.match(/^\$(\w+(?:\.\w+)*)/);
      if (match) {
        const rootName = match[1].split('.')[0];
        const value: FallbackValue = { type: 'magic', name: match[1] };
        return {
          type: 'value',
          raw: match[0],
          queries: [{ type: 'magic', name: rootName }],
          value,
          evaluate: createValueEvaluate(value),
        } as any;
      }
    }

    // Named context
    if (trimmed.startsWith('@')) {
      const match = trimmed.match(/^@(\w+)(?:\.(\w+(?:\.\w+)*))?/);
      if (match) {
        const context = match[1];
        const path = match[2] || '';
        const value: FallbackValue = { type: 'context', context, path };
        return {
          type: 'value',
          raw: match[0],
          queries: [{ type: 'context', context, path }],
          value,
          evaluate: createValueEvaluate(value),
        } as any;
      }
    }

    // Literals (no queries needed)
    if (trimmed === 'true') {
      const value: FallbackValue = { type: 'literal', value: true };
      return { type: 'value', raw: 'true', queries: [], value, evaluate: createValueEvaluate(value) } as any;
    }
    if (trimmed === 'false') {
      const value: FallbackValue = { type: 'literal', value: false };
      return { type: 'value', raw: 'false', queries: [], value, evaluate: createValueEvaluate(value) } as any;
    }
    if (trimmed === 'null') {
      const value: FallbackValue = { type: 'literal', value: null };
      return { type: 'value', raw: 'null', queries: [], value, evaluate: createValueEvaluate(value) } as any;
    }

    // Number
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      const value: FallbackValue = { type: 'literal', value: Number(trimmed) };
      return { type: 'value', raw: trimmed, queries: [], value, evaluate: createValueEvaluate(value) } as any;
    }

    // String literal
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      const value: FallbackValue = { type: 'literal', value: trimmed.slice(1, -1) };
      return { type: 'value', raw: trimmed, queries: [], value, evaluate: createValueEvaluate(value) } as any;
    }

    // State reference
    if (/^\w+(?:\.\w+)*$/.test(trimmed)) {
      const value: FallbackValue = { type: 'state', path: trimmed };
      return { type: 'value', raw: trimmed, queries: [{ type: 'context', context: 'state', path: trimmed }], value, evaluate: createValueEvaluate(value) } as any;
    }

    return null;
  }

  /**
   * Combine a pipe expression with its input expression.
   * @deprecated Use context.previousExpression in tryParse instead
   */
  static withInput(pipe: PipeExpression, input: ParsedExpression): PipeExpression {
    return {
      ...pipe,
      input,
      raw: `${input.raw} ${pipe.raw}`,
    };
  }
}

/**
 * Create a PipeParser instance
 */
export function createPipeParser(): PipeParser {
  return new PipeParser();
}
