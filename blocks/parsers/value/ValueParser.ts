/**
 * ValueParser - Parser for value reference expressions
 *
 * Parses value references:
 * - `$event` - Magic variable (DOM Event)
 * - `$element` - Magic variable (target element)
 * - `@context.path` - Named context lookup
 * - `bare.path` - Default state context
 * - Literals: true, false, null, numbers, strings
 *
 * @module blocks/parsers/value
 */

import {
  CustomExpressionParser,
  type ParseResult,
  type ParseContext,
  type Query,
  type ResolvedValues,
} from '../../../plugs/webexpressions';
import type { ValueExpression, ParsedValue } from '../types';

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
 * Create an evaluate function for a parsed value
 */
function createEvaluate(value: ParsedValue): (resolved: ResolvedValues) => unknown {
  return (resolved: ResolvedValues): unknown => {
    switch (value.type) {
      case 'magic':
        return resolvePath(value.name, resolved.magic);

      case 'context': {
        const contextValue = resolved.contexts[value.context];
        if (contextValue === undefined) {
          console.warn(`[ValueParser] Context "@${value.context}" not found`);
          return undefined;
        }
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
export interface ValueParserOptions {
  /** Prefix for magic variables (default: '$') */
  magicPrefix: string;
  /** Prefix for named contexts (default: '@') */
  contextPrefix: string;
  /** Known magic variable names */
  magicVars: string[];
}

const DEFAULT_OPTIONS: ValueParserOptions = {
  magicPrefix: '$',
  contextPrefix: '@',
  magicVars: ['event', 'element', 'target'],
};

/**
 * Value Parser
 *
 * Parses value references and literals. Returns parsed value with
 * remaining text for the next parser in the chain.
 *
 * @example
 * ```typescript
 * const parser = new ValueParser();
 *
 * parser.tryParse('$event');
 * // { parsed: { type: 'value', value: { type: 'magic', name: 'event' } }, remaining: '' }
 *
 * parser.tryParse('@item.id | uppercase');
 * // { parsed: { type: 'value', value: { type: 'context', context: 'item', path: 'id' } }, remaining: '| uppercase' }
 * ```
 */
export class ValueParser extends CustomExpressionParser<ValueExpression> {
  readonly options: ValueParserOptions;

  constructor(options: Partial<ValueParserOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Try to parse a value reference from the input
   */
  tryParse(input: string, _context?: ParseContext): ParseResult<ValueExpression> | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try magic variable: $event, $element
    const magicResult = this.#tryParseMagic(trimmed);
    if (magicResult) return magicResult;

    // Try named context: @item.path
    const contextResult = this.#tryParseContext(trimmed);
    if (contextResult) return contextResult;

    // Try literal: true, false, null, numbers, strings
    const literalResult = this.#tryParseLiteral(trimmed);
    if (literalResult) return literalResult;

    // Try state reference: bare.path (identifier that's not a function call)
    const stateResult = this.#tryParseState(trimmed);
    if (stateResult) return stateResult;

    return null;
  }

  /**
   * Parse magic variable ($event, $element, etc.)
   */
  #tryParseMagic(input: string): ParseResult<ValueExpression> | null {
    const { magicPrefix, magicVars } = this.options;

    if (!input.startsWith(magicPrefix)) return null;

    // Match magic var name and optional path
    const match = input.match(/^\$(\w+(?:\.\w+)*)/);
    if (!match) return null;

    const fullPath = match[1];
    const rootName = fullPath.split('.')[0];

    // Check if it's a known magic var
    if (!magicVars.includes(rootName)) return null;

    const raw = match[0];
    const remaining = input.slice(raw.length);
    const value: ParsedValue = { type: 'magic', name: fullPath };

    return {
      parsed: {
        type: 'value',
        raw,
        queries: [{ type: 'magic', name: rootName }],
        value,
        evaluate: createEvaluate(value),
      },
      remaining,
    };
  }

  /**
   * Parse named context (@context.path)
   */
  #tryParseContext(input: string): ParseResult<ValueExpression> | null {
    const { contextPrefix } = this.options;

    if (!input.startsWith(contextPrefix)) return null;

    // Match @context.path
    const match = input.match(/^@(\w+)(?:\.(\w+(?:\.\w+)*))?/);
    if (!match) return null;

    const context = match[1];
    const path = match[2] || '';
    const raw = match[0];
    const remaining = input.slice(raw.length);
    const value: ParsedValue = { type: 'context', context, path };

    return {
      parsed: {
        type: 'value',
        raw,
        queries: [{ type: 'context', context, path }],
        value,
        evaluate: createEvaluate(value),
      },
      remaining,
    };
  }

  /**
   * Parse literal values (true, false, null, numbers, strings)
   * Literals have no queries - they're self-contained values
   */
  #tryParseLiteral(input: string): ParseResult<ValueExpression> | null {
    // Boolean literals
    if (input.startsWith('true')) {
      const remaining = input.slice(4);
      // Make sure it's not part of a longer identifier
      if (remaining && /^\w/.test(remaining)) return null;
      const value: ParsedValue = { type: 'literal', value: true };
      return {
        parsed: {
          type: 'value',
          raw: 'true',
          queries: [],
          value,
          evaluate: createEvaluate(value),
        },
        remaining,
      };
    }

    if (input.startsWith('false')) {
      const remaining = input.slice(5);
      if (remaining && /^\w/.test(remaining)) return null;
      const value: ParsedValue = { type: 'literal', value: false };
      return {
        parsed: {
          type: 'value',
          raw: 'false',
          queries: [],
          value,
          evaluate: createEvaluate(value),
        },
        remaining,
      };
    }

    if (input.startsWith('null')) {
      const remaining = input.slice(4);
      if (remaining && /^\w/.test(remaining)) return null;
      const value: ParsedValue = { type: 'literal', value: null };
      return {
        parsed: {
          type: 'value',
          raw: 'null',
          queries: [],
          value,
          evaluate: createEvaluate(value),
        },
        remaining,
      };
    }

    // Number literal
    const numMatch = input.match(/^-?\d+(?:\.\d+)?/);
    if (numMatch) {
      const remaining = input.slice(numMatch[0].length);
      // Make sure it's not part of an identifier
      if (remaining && /^\w/.test(remaining)) return null;
      const value: ParsedValue = { type: 'literal', value: Number(numMatch[0]) };
      return {
        parsed: {
          type: 'value',
          raw: numMatch[0],
          queries: [],
          value,
          evaluate: createEvaluate(value),
        },
        remaining,
      };
    }

    // String literal (single or double quotes)
    if (input.startsWith('"') || input.startsWith("'")) {
      const quote = input[0];
      let i = 1;
      let escaped = false;

      while (i < input.length) {
        const char = input[i];
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          const raw = input.slice(0, i + 1);
          const strValue = input.slice(1, i);
          const value: ParsedValue = { type: 'literal', value: strValue };
          return {
            parsed: {
              type: 'value',
              raw,
              queries: [],
              value,
              evaluate: createEvaluate(value),
            },
            remaining: input.slice(i + 1),
          };
        }
        i++;
      }
      // Unclosed string
      return null;
    }

    return null;
  }

  /**
   * Parse state reference (bare identifier or path)
   * Only matches if it's not followed by ( which would make it a function call
   */
  #tryParseState(input: string): ParseResult<ValueExpression> | null {
    // Match identifier with optional path, but not followed by (
    const match = input.match(/^(\w+(?:\.\w+)*)/);
    if (!match) return null;

    const path = match[1];
    const remaining = input.slice(path.length);

    // If followed by (, it's a function call, not a value
    if (remaining.trimStart().startsWith('(')) return null;

    const value: ParsedValue = { type: 'state', path };

    return {
      parsed: {
        type: 'value',
        raw: path,
        queries: [{ type: 'context', context: 'state', path }],
        value,
        evaluate: createEvaluate(value),
      },
      remaining,
    };
  }

  /**
   * Resolve a parsed value against a context
   */
  resolve(value: ParsedValue, context: ValueResolverContext): unknown {
    switch (value.type) {
      case 'magic':
        return this.#resolvePath(value.name, context.magic);

      case 'context': {
        const contextValue = context.contexts.get(value.context);
        if (contextValue === undefined) {
          console.warn(`[ValueParser] Context "@${value.context}" not found`);
          return undefined;
        }
        return value.path ? this.#resolvePath(value.path, contextValue) : contextValue;
      }

      case 'state':
        return this.#resolvePath(value.path, context.state);

      case 'literal':
        return value.value;

      default:
        return undefined;
    }
  }

  /**
   * Resolve a dot-separated path on an object
   */
  #resolvePath(path: string, obj: unknown): unknown {
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
}

/**
 * Context for resolving values
 */
export interface ValueResolverContext {
  /** Magic variables ($event, $element, etc.) */
  magic: Record<string, unknown>;
  /** Named contexts (@item, @theme, etc.) */
  contexts: Map<string, unknown>;
  /** Default state context */
  state: unknown;
}

/**
 * Create a ValueParser instance
 */
export function createValueParser(options?: Partial<ValueParserOptions>): ValueParser {
  return new ValueParser(options);
}
