/**
 * @file CustomTextNodeParser.ts
 * @description Abstract base class for text node parsers that detect expression syntax
 * and split text into static segments and UndeterminedTextNode instances.
 * @source Ported from plateau/src/plugs/custom-text-node-parsers/CustomTextNodeParser.ts
 */

import UndeterminedTextNode from './UndeterminedTextNode';

/**
 * Abstract base class for text node parsers.
 *
 * Text node parsers detect delimiter patterns (e.g., `{{` / `}}`) in text content
 * and split the text into regular Text nodes (for static content) and
 * UndeterminedTextNode instances (for expression content).
 *
 * The UndeterminedTextNode instances are later upgraded by the CustomTextNodeRegistry
 * to specific CustomTextNode implementations (e.g., InterpolationTextNode).
 *
 * @example
 * ```typescript
 * class DoubleCurlyParser extends CustomTextNodeParser {
 *   openingIdentifier = '{{';
 *   closingIdentifier = '}}';
 * }
 *
 * const parser = new DoubleCurlyParser();
 * parser.localName = 'mustache';
 *
 * const nodes = parser.parse('Hello {{name}}!');
 * // [Text("Hello "), UndeterminedTextNode("name"), Text("!")]
 * ```
 */
export default abstract class CustomTextNodeParser {
  /**
   * Opening delimiter that marks the start of an expression.
   * E.g., `{{` for Mustache-style, `[[` for Polymer-style.
   */
  abstract openingIdentifier: string;

  /**
   * Closing delimiter that marks the end of an expression.
   * E.g., `}}` for Mustache-style, `]]` for Polymer-style.
   */
  abstract closingIdentifier: string;

  /**
   * The registered name of this parser. Set by the registry on `define()`.
   * Used as the `parserName` on UndeterminedTextNode instances so the
   * CustomTextNodeRegistry knows which text node type to upgrade to.
   */
  localName: string | null = null;

  /**
   * Parse a text string, splitting it into Text and UndeterminedTextNode instances.
   *
   * Static text segments become regular Text nodes.
   * Content between delimiters becomes UndeterminedTextNode instances with:
   * - `parserName` set to this parser's `localName`
   * - `determined` set to `false`
   * - `textContent` set to the trimmed expression content
   *
   * @param text - The raw text string to parse
   * @returns Array of Text and UndeterminedTextNode instances
   */
  parse(text: string): Text[] {
    if (!text) return [];

    const nodes: Text[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const openIndex = remaining.indexOf(this.openingIdentifier);

      if (openIndex === -1) {
        // No more opening delimiters — rest is static text
        nodes.push(new Text(remaining));
        break;
      }

      // Static text before the opening delimiter
      if (openIndex > 0) {
        nodes.push(new Text(remaining.slice(0, openIndex)));
      }

      // Find the closing delimiter after the opening identifier
      const afterOpen = openIndex + this.openingIdentifier.length;
      const closeIndex = remaining.indexOf(this.closingIdentifier, afterOpen);

      if (closeIndex === -1) {
        // No closing delimiter found — treat remainder as static text
        nodes.push(new Text(remaining.slice(openIndex)));
        break;
      }

      // Extract and trim expression content between delimiters
      const expressionContent = remaining.slice(afterOpen, closeIndex).trim();

      // Create UndeterminedTextNode for the expression
      const undetermined = new UndeterminedTextNode({ children: expressionContent });
      undetermined.parserName = this.localName;
      nodes.push(undetermined);

      // Move past the closing delimiter
      remaining = remaining.slice(closeIndex + this.closingIdentifier.length);
    }

    return nodes;
  }
}
