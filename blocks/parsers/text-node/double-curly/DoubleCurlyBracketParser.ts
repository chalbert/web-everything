/**
 * DoubleCurlyBracketParser - Text node parser for Mustache-style {{expression}} syntax
 *
 * Detects `{{` and `}}` delimiters in text content and splits the text into
 * static Text nodes and UndeterminedTextNode instances for expression content.
 *
 * @module blocks/parsers/text-node/double-curly
 *
 * @example
 * ```typescript
 * const parser = new DoubleCurlyBracketParser();
 * const nodes = parser.parse('Hello {{name}}!');
 * // [Text("Hello "), UndeterminedTextNode("name"), Text("!")]
 * ```
 */

import CustomTextNodeParser from '../../../../plugs/webexpressions/CustomTextNodeParser';

export default class DoubleCurlyBracketParser extends CustomTextNodeParser {
  openingIdentifier = '{{';
  closingIdentifier = '}}';
}

export { DoubleCurlyBracketParser };
