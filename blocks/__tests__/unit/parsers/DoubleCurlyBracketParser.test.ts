/**
 * @file DoubleCurlyBracketParser.test.ts
 * @description Unit tests for DoubleCurlyBracketParser
 */

import { describe, it, expect } from 'vitest';
import DoubleCurlyBracketParser from '../../../../blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser';
import CustomTextNodeParser from '../../../../plugs/webexpressions/CustomTextNodeParser';
import UndeterminedTextNode from '../../../../plugs/webexpressions/UndeterminedTextNode';

describe('DoubleCurlyBracketParser', () => {
  it('should be an instance of CustomTextNodeParser', () => {
    const parser = new DoubleCurlyBracketParser();
    expect(parser).toBeInstanceOf(CustomTextNodeParser);
  });

  it('should use {{ as opening identifier', () => {
    const parser = new DoubleCurlyBracketParser();
    expect(parser.openingIdentifier).toBe('{{');
  });

  it('should use }} as closing identifier', () => {
    const parser = new DoubleCurlyBracketParser();
    expect(parser.closingIdentifier).toBe('}}');
  });

  it('should parse {{expression}} into UndeterminedTextNode', () => {
    const parser = new DoubleCurlyBracketParser();
    parser.localName = 'mustache';

    const result = parser.parse('Hello {{name}}!');

    expect(result).toHaveLength(3);
    expect(result[0].textContent).toBe('Hello ');
    expect(result[1]).toBeInstanceOf(UndeterminedTextNode);
    expect(result[1].textContent).toBe('name');
    expect(result[2].textContent).toBe('!');
  });

  it('should handle multiple expressions', () => {
    const parser = new DoubleCurlyBracketParser();
    parser.localName = 'mustache';

    const result = parser.parse('{{a}} and {{b}}');

    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
    expect(result[0].textContent).toBe('a');
    expect(result[1].textContent).toBe(' and ');
    expect(result[2]).toBeInstanceOf(UndeterminedTextNode);
    expect(result[2].textContent).toBe('b');
  });
});
