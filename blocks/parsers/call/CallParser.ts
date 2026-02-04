/**
 * CallParser - Parser for function call expressions
 *
 * Parses function call syntax:
 * - `handler()` - No arguments
 * - `handler($event)` - With magic variable
 * - `handler($event, @item.id)` - Multiple arguments
 * - `save` - Simple handler name (no parens)
 *
 * Arguments are parsed recursively using the expression parser registry.
 *
 * @module blocks/parsers/call
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
import type { CallExpression } from '../types';

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
 * Create an evaluate function for a call expression
 */
function createCallEvaluate(
  name: string,
  args: ParsedExpression[]
): (resolved: ResolvedValues) => unknown {
  return (resolved: ResolvedValues): unknown => {
    const handlers = (resolved.contexts.handlers ?? {}) as Record<string, (...args: unknown[]) => unknown>;
    const handler = handlers[name];
    if (!handler) {
      console.warn(`[CallParser] Handler "${name}" not found`);
      return undefined;
    }
    const evaluatedArgs = args.map(arg => {
      if (arg.evaluate) {
        return arg.evaluate(resolved);
      }
      return undefined;
    });
    return handler(...evaluatedArgs);
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
 * Parser configuration options
 */
export interface CallParserOptions {
  /** Whether to allow handler without parens (e.g., 'save' instead of 'save()') */
  allowNoParens: boolean;
}

const DEFAULT_OPTIONS: CallParserOptions = {
  allowNoParens: true,
};

/**
 * Call Parser
 *
 * Parses function call expressions. Can recursively parse arguments
 * using the parser registry.
 *
 * @example
 * ```typescript
 * const parser = new CallParser();
 *
 * parser.tryParse('save()');
 * // { parsed: { type: 'call', name: 'save', args: [] }, remaining: '' }
 *
 * parser.tryParse('save($event, @item.id)');
 * // { parsed: { type: 'call', name: 'save', args: [...] }, remaining: '' }
 * ```
 */
export class CallParser extends CustomExpressionParser<CallExpression> {
  readonly options: CallParserOptions;

  /**
   * Optional parser registry for recursive argument parsing
   */
  #registry: CustomExpressionParserRegistry | null = null;

  constructor(options: Partial<CallParserOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Set the parser registry for recursive argument parsing
   */
  setRegistry(registry: CustomExpressionParserRegistry): void {
    this.#registry = registry;
  }

  /**
   * Try to parse a function call from the input
   */
  tryParse(input: string, _context?: ParseContext): ParseResult<CallExpression> | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try function call with parentheses: handler(args)
    const callResult = this.#tryParseCall(trimmed);
    if (callResult) return callResult;

    // Try simple handler name (no parens) if allowed
    if (this.options.allowNoParens) {
      const simpleResult = this.#tryParseSimple(trimmed);
      if (simpleResult) return simpleResult;
    }

    return null;
  }

  /**
   * Parse function call with parentheses: handler(args)
   */
  #tryParseCall(input: string): ParseResult<CallExpression> | null {
    // Match function name followed by (
    const nameMatch = input.match(/^(\w+)\s*\(/);
    if (!nameMatch) return null;

    const name = nameMatch[1];
    let pos = nameMatch[0].length;

    // Find matching closing paren, accounting for nested parens and strings
    const argsStart = pos;
    let depth = 1;
    let inString = false;
    let stringChar = '';

    while (pos < input.length && depth > 0) {
      const char = input[pos];

      if (inString) {
        if (char === stringChar && input[pos - 1] !== '\\') {
          inString = false;
        }
      } else {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        }
      }

      pos++;
    }

    // No matching closing paren
    if (depth !== 0) return null;

    const argsStr = input.slice(argsStart, pos - 1);
    const raw = input.slice(0, pos);
    const remaining = input.slice(pos);

    // Parse arguments
    const args = this.#parseArguments(argsStr);

    // Collect queries: handler context + all arg queries
    const queries: Query[] = [
      { type: 'context', context: 'handlers', path: name },
    ];
    for (const arg of args) {
      if (arg.queries) {
        queries.push(...arg.queries);
      }
    }

    return {
      parsed: {
        type: 'call',
        raw,
        queries,
        name,
        args,
        evaluate: createCallEvaluate(name, args),
      },
      remaining,
    };
  }

  /**
   * Parse simple handler name (no parens)
   * Only matches if not followed by ( or | or .
   */
  #tryParseSimple(input: string): ParseResult<CallExpression> | null {
    // Match identifier but not followed by ( or | or .
    const match = input.match(/^(\w+)/);
    if (!match) return null;

    const name = match[1];
    const remaining = input.slice(name.length);
    const trimmedRemaining = remaining.trimStart();

    // If followed by ( it's a function call with parens
    if (trimmedRemaining.startsWith('(')) return null;

    // If followed by . it's a path, not a handler
    if (trimmedRemaining.startsWith('.')) return null;

    // If followed by | it's a value being piped, not a handler
    if (trimmedRemaining.startsWith('|')) return null;

    const args: ParsedExpression[] = [];

    return {
      parsed: {
        type: 'call',
        raw: name,
        queries: [{ type: 'context', context: 'handlers', path: name }],
        name,
        args,
        evaluate: createCallEvaluate(name, args),
      },
      remaining,
    };
  }

  /**
   * Parse comma-separated arguments
   */
  #parseArguments(argsStr: string): ParsedExpression[] {
    const trimmed = argsStr.trim();
    if (!trimmed) return [];

    const args: ParsedExpression[] = [];
    const argStrings = this.#splitArguments(trimmed);

    for (const argStr of argStrings) {
      const parsed = this.#parseArgument(argStr.trim());
      if (parsed) {
        args.push(parsed);
      }
    }

    return args;
  }

  /**
   * Split argument string by commas, respecting nesting and strings
   */
  #splitArguments(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (const char of argsStr) {
      if (inString) {
        current += char;
        if (char === stringChar) inString = false;
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '(' || char === '[' || char === '{') {
        depth++;
        current += char;
        continue;
      }

      if (char === ')' || char === ']' || char === '}') {
        depth--;
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        args.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      args.push(current);
    }

    return args;
  }

  /**
   * Parse a single argument using the registry or fallback to inline parsing
   */
  #parseArgument(argStr: string): ParsedExpression | null {
    // If we have a registry, use it for recursive parsing
    if (this.#registry) {
      const result = this.#registry.parse(argStr);
      if (result.success && result.expressions.length > 0) {
        return result.expressions[0];
      }
    }

    // Fallback: create a value expression from the raw string
    return this.#parseValueFallback(argStr);
  }

  /**
   * Fallback value parsing when no registry is available
   */
  #parseValueFallback(argStr: string): ParsedExpression | null {
    const trimmed = argStr.trim();
    if (!trimmed) return null;

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
}

/**
 * Create a CallParser instance
 */
export function createCallParser(options?: Partial<CallParserOptions>): CallParser {
  return new CallParser(options);
}
