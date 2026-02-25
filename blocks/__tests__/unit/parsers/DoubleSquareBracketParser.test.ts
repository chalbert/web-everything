/**
 * @file DoubleSquareBracketParser.test.ts
 * @description Unit tests for DoubleSquareBracketParser
 */

import { describe, it, expect } from 'vitest';
import DoubleSquareBracketParser from '../../../../blocks/parsers/text-node/double-square/DoubleSquareBracketParser';
import CustomTextNodeParser from '../../../../plugs/webexpressions/CustomTextNodeParser';
import UndeterminedTextNode from '../../../../plugs/webexpressions/UndeterminedTextNode';

describe('DoubleSquareBracketParser', () => {
  it('should be an instance of CustomTextNodeParser', () => {
    const parser = new DoubleSquareBracketParser();
    expect(parser).toBeInstanceOf(CustomTextNodeParser);
  });

  it('should use [[ as opening identifier', () => {
    const parser = new DoubleSquareBracketParser();
    expect(parser.openingIdentifier).toBe('[[');
  });

  it('should use ]] as closing identifier', () => {
    const parser = new DoubleSquareBracketParser();
    expect(parser.closingIdentifier).toBe(']]');
  });

  it('should parse [[expression]] into UndeterminedTextNode', () => {
    const parser = new DoubleSquareBracketParser();
    parser.localName = 'polymer';

    const result = parser.parse('Count: [[count]]');

    expect(result).toHaveLength(2);
    expect(result[0].textContent).toBe('Count: ');
    expect(result[1]).toBeInstanceOf(UndeterminedTextNode);
    expect(result[1].textContent).toBe('count');
  });

  it('should not match {{ }} delimiters', () => {
    const parser = new DoubleSquareBracketParser();
    const result = parser.parse('Hello {{name}}');

    expect(result).toHaveLength(1);
    expect(result[0].textContent).toBe('Hello {{name}}');
    expect(result[0]).not.toBeInstanceOf(UndeterminedTextNode);
  });
});
