/**
 * CustomAttributeParser - Base class for attribute syntax parsers
 *
 * Attribute parsers handle the SURROUNDING SYNTAX of attribute values,
 * such as delimiter patterns (e.g., `{{ expression }}`).
 *
 * For parsing actual expression content (values, calls, pipes),
 * use CustomExpressionParser from webexpressions.
 *
 * @module webbehaviors/parsers
 */

/**
 * Result of parsing an attribute value
 */
export interface ParsedAttributeValue {
  /** The raw attribute value */
  raw: string;
  /** Parser-specific parsed data */
  [key: string]: unknown;
}

/**
 * Base class for custom attribute parsers
 *
 * Attribute parsers handle attribute syntax - typically delimiter patterns
 * like `{{ expression }}` or `[expression]`. They extract the expression
 * content which can then be parsed by expression parsers.
 *
 * @example
 * ```typescript
 * // An attribute parser that handles {{ }} syntax
 * class MustacheParser extends CustomAttributeParser<string> {
 *   openingIdentifier = '{{';
 *   closingIdentifier = '}}';
 *
 *   protected transform(content: string): string {
 *     return content.trim();
 *   }
 * }
 *
 * const parser = new MustacheParser();
 * parser.parse('{{ user.name }}'); // Returns 'user.name'
 * ```
 */
export default abstract class CustomAttributeParser<T = string> {
  /**
   * Opening identifier for the parser syntax
   */
  openingIdentifier: string = '';

  /**
   * Closing identifier for the parser syntax
   */
  closingIdentifier: string = '';

  /**
   * Local name when registered in a registry
   */
  localName: string | null = null;

  /**
   * Parse an attribute value string
   *
   * Extracts content between opening and closing identifiers.
   *
   * @param value - The attribute value to parse
   * @returns The parsed content or null if not matching
   */
  parse(value: string): T | null {
    if (!this.openingIdentifier && !this.closingIdentifier) {
      return null;
    }
    const opening = this.openingIdentifier.replace(/[[\]]/g, '\\$&');
    const closing = this.closingIdentifier.replace(/[[\]]/g, '\\$&');
    const regExp = new RegExp(`^${opening}(.*)${closing}$`);
    const matches = regExp.exec(value);
    if (matches) {
      return this.transform(matches[1]);
    }
    return null;
  }

  /**
   * Transform the extracted content
   * Override this to provide custom transformation logic
   *
   * @param content - The content extracted between identifiers
   * @returns The transformed result
   */
  protected transform(content: string): T {
    return content as unknown as T;
  }

  /**
   * Stringify a parsed value back to attribute format
   *
   * @param value - The value to stringify
   * @returns The stringified attribute value
   */
  stringify(value: T): string {
    return `${this.openingIdentifier}${value}${this.closingIdentifier}`;
  }
}
