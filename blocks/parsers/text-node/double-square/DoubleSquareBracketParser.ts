/**
 * DoubleSquareBracketParser - Text node parser for Polymer-style [[expression]] syntax
 *
 * Detects `[[` and `]]` delimiters in text content and splits the text into
 * static Text nodes and UndeterminedTextNode instances for expression content.
 *
 * @module blocks/parsers/text-node/double-square
 *
 * @example
 * ```typescript
 * const parser = new DoubleSquareBracketParser();
 * const nodes = parser.parse('Count: [[count]]');
 * // [Text("Count: "), UndeterminedTextNode("count"), Text("")]
 * ```
 */

import CustomTextNodeParser from '../../../../plugs/webexpressions/CustomTextNodeParser';

export default class DoubleSquareBracketParser extends CustomTextNodeParser {
  openingIdentifier = '[[';
  closingIdentifier = ']]';
}

export { DoubleSquareBracketParser };
