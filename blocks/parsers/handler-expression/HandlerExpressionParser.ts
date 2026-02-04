/**
 * HandlerExpressionParser - Parser for event handler expressions
 *
 * Parses function-call style expressions used in event handlers:
 * - `save()` (handler call)
 * - `save($event)` (with event)
 * - `save($event, @item.id)` (with context)
 * - `save(@item.id, count)` (mixed contexts)
 *
 * ## Context Resolution
 *
 * - `$event` - Magic variable, the DOM Event object
 * - `$element` - Magic variable, the target element
 * - `@name.path` - Named context lookup (e.g., @item, @theme, @t)
 * - `@state.path` - Explicit state context
 * - `bare.path` - Default context (configurable, defaults to state)
 *
 * @module blocks/expression-parser
 */

import { CustomAttributeParser } from '../../../plugs/webbehaviors/parsers';

/**
 * Parsed handler expression result
 */
export interface ParsedHandlerExpression {
  /** The handler/function name */
  handlerName: string;
  /** Parsed arguments */
  args: ParsedArgument[];
  /** Raw expression string */
  raw: string;
}

/**
 * Types of parsed arguments
 */
export type ParsedArgument =
  | { type: 'magic'; name: string }                    // $event, $element
  | { type: 'context'; context: string; path: string } // @item.id, @theme.primary
  | { type: 'state'; path: string }                    // count, user.name (default context)
  | { type: 'literal'; value: string | number | boolean | null };

/**
 * Runtime context for handler expression evaluation
 */
export interface HandlerContext {
  /** Magic variables ($event, $element, etc.) */
  magic: Record<string, unknown>;
  /** Named contexts (@item, @theme, etc.) */
  contexts: Map<string, unknown>;
  /** Default state context */
  state: unknown;
  /** Handler registry */
  handlers: Record<string, Function>;
}

/**
 * Parser configuration options
 */
export interface HandlerExpressionParserOptions {
  /** How to handle context shadowing: 'error' | 'warn' | 'allow' */
  shadowMode: 'error' | 'warn' | 'allow';
  /** Default context name for bare identifiers */
  defaultContext: string;
  /** Prefix for named contexts (default: '@') */
  contextPrefix: string;
  /** Prefix for magic variables (default: '$') */
  magicPrefix: string;
  /** Known magic variable names */
  magicVars: string[];
  /** Allowed global objects for expressions */
  allowedGlobals: string[];
}

const DEFAULT_OPTIONS: HandlerExpressionParserOptions = {
  shadowMode: 'warn',
  defaultContext: 'state',
  contextPrefix: '@',
  magicPrefix: '$',
  magicVars: ['event', 'element', 'target'],
  allowedGlobals: ['Math', 'Date', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite'],
};

/**
 * Handler Expression Parser
 *
 * Parses function-call style expressions and evaluates them against a context.
 * Extends CustomAttributeParser for integration with the attribute parser registry.
 *
 * @example
 * ```typescript
 * const parser = new HandlerExpressionParser();
 *
 * // Parse an expression
 * const parsed = parser.parse('save($event, @item.id)');
 * // { handlerName: 'save', args: [...], raw: 'save($event, @item.id)' }
 *
 * // Evaluate with context
 * const context = {
 *   magic: { event: clickEvent },
 *   contexts: new Map([['item', { id: 123 }]]),
 *   state: {},
 *   handlers: { save: (e, id) => console.log('Save', id) }
 * };
 * parser.evaluate(parsed, context);
 * ```
 */
export class HandlerExpressionParser extends CustomAttributeParser<ParsedHandlerExpression> {
  /** No opening identifier - parses raw value */
  openingIdentifier = '';
  /** No closing identifier - parses raw value */
  closingIdentifier = '';

  readonly options: HandlerExpressionParserOptions;

  constructor(options: Partial<HandlerExpressionParserOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse an expression string into a structured format
   * Overrides base class to handle handler expression syntax
   */
  override parse(expression: string): ParsedHandlerExpression | null {
    const raw = expression.trim();
    if (!raw) return null;

    // Simple handler name (no parens) - must be valid identifier
    if (!raw.includes('(')) {
      if (!/^\w+$/.test(raw)) {
        return null;
      }
      return {
        handlerName: raw,
        args: [],
        raw,
      };
    }

    // Handler call with arguments
    const match = raw.match(/^(\w+)\s*\((.*)\)$/s);
    if (!match) {
      return null;
    }

    const [, handlerName, argsStr] = match;
    const args = this.parseArguments(argsStr);

    return {
      handlerName,
      args,
      raw,
    };
  }

  /**
   * Parse argument list string
   */
  private parseArguments(argsStr: string): ParsedArgument[] {
    if (!argsStr.trim()) return [];

    const args: ParsedArgument[] = [];
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
        args.push(this.parseArgument(current.trim()));
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      args.push(this.parseArgument(current.trim()));
    }

    return args;
  }

  /**
   * Parse a single argument
   */
  private parseArgument(arg: string): ParsedArgument {
    const { contextPrefix, magicPrefix, magicVars } = this.options;

    // Magic variable: $event, $element
    if (arg.startsWith(magicPrefix)) {
      const name = arg.slice(magicPrefix.length).split('.')[0];
      if (magicVars.includes(name)) {
        return { type: 'magic', name: arg.slice(magicPrefix.length) };
      }
    }

    // Named context: @item.id, @theme.primary
    if (arg.startsWith(contextPrefix)) {
      const withoutPrefix = arg.slice(contextPrefix.length);
      const dotIndex = withoutPrefix.indexOf('.');
      if (dotIndex === -1) {
        return { type: 'context', context: withoutPrefix, path: '' };
      }
      const context = withoutPrefix.slice(0, dotIndex);
      const path = withoutPrefix.slice(dotIndex + 1);
      return { type: 'context', context, path };
    }

    // Literals
    if (arg === 'true') return { type: 'literal', value: true };
    if (arg === 'false') return { type: 'literal', value: false };
    if (arg === 'null') return { type: 'literal', value: null };
    if (/^-?\d+(\.\d+)?$/.test(arg)) return { type: 'literal', value: Number(arg) };
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
      return { type: 'literal', value: arg.slice(1, -1) };
    }

    // Default: state path
    return { type: 'state', path: arg };
  }

  /**
   * Evaluate a parsed expression against a context
   */
  evaluate(parsed: ParsedHandlerExpression, context: HandlerContext): unknown {
    const handler = context.handlers[parsed.handlerName];
    if (!handler) {
      console.warn(`[HandlerExpressionParser] Handler "${parsed.handlerName}" not found`);
      return undefined;
    }

    const args = parsed.args.map(arg => this.resolveArgument(arg, context));
    return handler(...args);
  }

  /**
   * Resolve a single argument to its value
   */
  resolveArgument(arg: ParsedArgument, context: HandlerContext): unknown {
    switch (arg.type) {
      case 'magic':
        return this.resolvePath(arg.name, context.magic);

      case 'context': {
        const contextValue = context.contexts.get(arg.context);
        if (contextValue === undefined) {
          console.warn(`[HandlerExpressionParser] Context "@${arg.context}" not found`);
          return undefined;
        }
        return arg.path ? this.resolvePath(arg.path, contextValue) : contextValue;
      }

      case 'state':
        return this.resolvePath(arg.path, context.state);

      case 'literal':
        return arg.value;

      default:
        return undefined;
    }
  }

  /**
   * Resolve a dot-separated path on an object
   */
  private resolvePath(path: string, obj: unknown): unknown {
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
   * Check for context shadowing
   */
  checkShadowing(newContext: string, existingContexts: Map<string, unknown>): void {
    if (!existingContexts.has(newContext)) return;

    const message = `Context "@${newContext}" shadows an existing context`;

    switch (this.options.shadowMode) {
      case 'error':
        throw new HandlerExpressionShadowError(message);
      case 'warn':
        console.warn(`[HandlerExpressionParser] ${message}`);
        break;
      case 'allow':
        // Silent
        break;
    }
  }

  /**
   * Stringify a parsed expression back to string format
   */
  override stringify(parsed: ParsedHandlerExpression): string {
    if (parsed.args.length === 0) {
      return `${parsed.handlerName}()`;
    }
    // Note: This is a simplified stringify that returns the raw value
    return parsed.raw;
  }
}

/**
 * Error thrown when expression parsing fails
 */
export class HandlerExpressionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandlerExpressionParseError';
  }
}

/**
 * Error thrown when context shadowing is not allowed
 */
export class HandlerExpressionShadowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandlerExpressionShadowError';
  }
}

/**
 * Create a handler expression parser instance
 */
export function createHandlerExpressionParser(
  options?: Partial<HandlerExpressionParserOptions>
): HandlerExpressionParser {
  return new HandlerExpressionParser(options);
}
