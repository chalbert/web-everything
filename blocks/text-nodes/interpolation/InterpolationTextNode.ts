/**
 * InterpolationTextNode - Reactive text node that evaluates expressions
 *
 * Connects the text node parsing pipeline to the expression parser system.
 * When connected to the DOM, it:
 * 1. Extracts the expression from its text content (set by the text node parser)
 * 2. Parses it via the CustomExpressionParserRegistry
 * 3. Resolves context queries from the injector chain
 * 4. Evaluates the expression and renders the result as text
 *
 * Phase 1 limitation: Evaluates once on connect. No reactive auto-update.
 *
 * @module blocks/text-nodes/interpolation
 *
 * @example
 * ```html
 * <!-- In HTML, after bootstrap registers parsers: -->
 * <div>Hello {{user.name}}!</div>
 * <!-- Renders as: Hello John! -->
 * ```
 */

import CustomTextNode, { type CustomTextNodeOptions } from '../../../plugs/webexpressions/CustomTextNode';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';
import type {
  RegistryParseResult,
  Query,
  ResolvedValues,
} from '../../../plugs/webexpressions';
import type CustomExpressionParserRegistry from '../../../plugs/webexpressions/CustomExpressionParserRegistry';

export interface InterpolationTextNodeOptions extends CustomTextNodeOptions {
  children: string;
}

/**
 * A custom text node that evaluates expression content and renders the result.
 *
 * Created by text node parsers (e.g., DoubleCurlyBracketParser) when they
 * detect expression syntax like `{{name}}` in text content. The raw expression
 * (e.g., "name") is stored as the text content of the UndeterminedTextNode,
 * which is then upgraded to an InterpolationTextNode by the CustomTextNodeRegistry.
 *
 * On `connectedCallback`, the node:
 * - Parses the expression via the expression parser registry
 * - Resolves context queries from the injector chain
 * - Evaluates and sets its text content to the result
 */
export default class InterpolationTextNode extends CustomTextNode<InterpolationTextNodeOptions> {
  /** The raw expression string extracted from the delimiters */
  #expression: string = '';

  /** The parsed result from the expression parser registry */
  #parseResult: RegistryParseResult | null = null;

  /** Guard against duplicate connectedCallback calls */
  #evaluated: boolean = false;

  connectedCallback(): void {
    // Guard against duplicate calls (e.g., happy-dom's _connectToNode + explicit call)
    if (this.#evaluated) return;
    this.#evaluated = true;

    // Only extract expression from textContent on first connect.
    // On reconnect, reuse the stored expression (textContent may have been
    // overwritten with the evaluated result).
    if (!this.#expression) {
      this.#expression = this.textContent?.trim() || '';
    }

    if (!this.#expression) {
      this.#setTextSafe('');
      return;
    }

    // Get the expression parser registry from the injector chain
    const parserRegistry = InjectorRoot.getProviderOf(
      this,
      'customExpressionParsers' as any,
    ) as CustomExpressionParserRegistry | undefined;

    if (!parserRegistry) {
      console.warn('[InterpolationTextNode] No expression parser registry found in injector chain');
      this.#setTextSafe('');
      return;
    }

    // Parse the expression
    this.#parseResult = parserRegistry.parse(this.#expression);

    if (!this.#parseResult.success || this.#parseResult.expressions.length === 0) {
      console.warn(`[InterpolationTextNode] Failed to parse expression: "${this.#expression}"`);
      this.#setTextSafe('');
      return;
    }

    // Resolve and evaluate
    this.#evaluate();
  }

  disconnectedCallback(): void {
    this.#parseResult = null;
    this.#evaluated = false;
  }

  /** Resolve queries from the injector chain and evaluate the expression */
  #evaluate(): void {
    if (!this.#parseResult || this.#parseResult.expressions.length === 0) return;

    // Use the last expression (after reduce/pipe composition)
    const expression = this.#parseResult.expressions[this.#parseResult.expressions.length - 1];
    const resolved = this.#resolveQueries(this.#parseResult.queries);

    try {
      const value = expression.evaluate?.(resolved);
      this.#setTextSafe(value !== null && value !== undefined ? String(value) : '');
    } catch (error) {
      console.warn(`[InterpolationTextNode] Error evaluating "${this.#expression}":`, error);
      this.#setTextSafe('');
    }
  }

  /**
   * Safely set text content, handling environments where the Text node's
   * internal state may not be fully initialized during connection.
   */
  #setTextSafe(value: string): void {
    try {
      this.textContent = value;
    } catch {
      // In some DOM environments (e.g., happy-dom), the ownerDocument may not
      // be available during _connectToNode. Defer to microtask.
      queueMicrotask(() => {
        try { this.textContent = value; } catch { /* best effort */ }
      });
    }
  }

  /** Resolve all queries from the injector chain */
  #resolveQueries(queries: Query[]): ResolvedValues {
    const resolved: ResolvedValues = {
      contexts: {},
      magic: {},
    };

    for (const query of queries) {
      if (query.type === 'context') {
        // Resolve context from injector chain
        if (!(query.context in resolved.contexts)) {
          const contextValue = InjectorRoot.getProviderOf(
            this,
            `customContexts:${query.context}` as any,
          );
          if (contextValue !== undefined) {
            resolved.contexts[query.context] = contextValue;
          }
        }
      }
      // Magic variables ($event, $element) are not relevant for text interpolation
    }

    return resolved;
  }
}

export { InterpolationTextNode };
