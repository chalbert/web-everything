/**
 * @file CustomTextNodeParserRegistry.ts
 * @description Registry for managing custom text node parsers
 * @source Ported from plateau/src/plugs/custom-text-node-parsers/CustomTextNodeParserRegistry.ts
 */

import CustomRegistry from '../core/CustomRegistry';
import type CustomTextNodeParser from './CustomTextNodeParser';

/**
 * Registry for custom text node parsers.
 *
 * Manages parsers that detect expression syntax in text content
 * (e.g., `{{expression}}`, `[[expression]]`). Parsers are registered
 * by name and evaluated in registration order — the first parser whose
 * delimiters match wins.
 *
 * @example
 * ```typescript
 * const registry = new CustomTextNodeParserRegistry();
 *
 * registry.define('mustache', new DoubleCurlyBracketParser());
 * registry.define('polymer', new DoubleSquareBracketParser());
 *
 * // Parsers are available via values()
 * for (const parser of registry.values()) {
 *   const nodes = parser.parse(text);
 * }
 * ```
 */
export default class CustomTextNodeParserRegistry extends CustomRegistry<CustomTextNodeParser> {
  /**
   * Local name for this registry type (used by InjectorRoot)
   */
  localName = 'customTextNodeParsers';

  /**
   * Define a new text node parser.
   *
   * Sets the parser's `localName` to the registered name so that
   * UndeterminedTextNode instances created by the parser carry
   * a reference back to the parser that created them.
   *
   * @param name - The parser name (e.g., 'mustache', 'polymer')
   * @param parser - The CustomTextNodeParser instance
   */
  override define(name: string, parser: CustomTextNodeParser): void {
    parser.localName = name;
    this.set(name, parser);
  }

  /**
   * No-op — text node parsers don't require DOM upgrades.
   */
  upgrade(): void {
    // Parsers are stateless; no DOM operations needed
  }

  /**
   * No-op — text node parsers don't require DOM downgrades.
   */
  downgrade(): void {
    // Parsers are stateless; no DOM operations needed
  }
}
