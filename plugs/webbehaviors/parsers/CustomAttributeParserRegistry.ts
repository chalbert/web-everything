/**
 * CustomAttributeParserRegistry - Registry for attribute syntax parsers
 *
 * Manages custom attribute parsers that handle attribute syntax
 * (like delimiter patterns {{ }}).
 *
 * For expression parsing, use CustomExpressionParserRegistry from webexpressions.
 *
 * @module webbehaviors/parsers
 */

import CustomRegistry from '../../core/CustomRegistry';
import CustomAttributeParser from './CustomAttributeParser';

export interface CustomAttributeParserRegistryOptions {
  extends?: CustomAttributeParserRegistry[];
}

/**
 * Registry for custom attribute parsers
 *
 * @example
 * ```typescript
 * const parsers = new CustomAttributeParserRegistry();
 *
 * // Define attribute syntax parsers
 * parsers.define('mustache', new MustacheParser()); // Handles {{ }}
 * parsers.define('bracket', new BracketParser());   // Handles [ ]
 *
 * // Register with injector
 * injector.set('customAttributeParsers', parsers);
 *
 * // Get a specific parser
 * const mustache = parsers.get('mustache');
 * const content = mustache?.parse('{{ user.name }}');
 * ```
 */
export default class CustomAttributeParserRegistry extends CustomRegistry<CustomAttributeParser<unknown>> {
  localName = 'customAttributeParsers';

  /**
   * Define a parser with a name
   *
   * @param name - The parser name
   * @param parser - The parser instance
   */
  define(name: string, parser: CustomAttributeParser<unknown>): void {
    parser.localName = name;
    this.set(name, parser);
  }

  /**
   * Get all parsers in definition order
   */
  *parsers(): Generator<CustomAttributeParser<unknown>> {
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
