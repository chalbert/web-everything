/**
 * @file CustomTextNodeParser.test.ts
 * @description Unit tests for CustomTextNodeParser abstract base class
 */

import { describe, it, expect } from 'vitest';
import CustomTextNodeParser from '../../CustomTextNodeParser';
import UndeterminedTextNode from '../../UndeterminedTextNode';

// Concrete test implementation
class TestParser extends CustomTextNodeParser {
  openingIdentifier = '{{';
  closingIdentifier = '}}';
}

describe('CustomTextNodeParser', () => {
  describe('Construction', () => {
    it('should have null localName by default', () => {
      const parser = new TestParser();
      expect(parser.localName).toBeNull();
    });

    it('should allow setting localName', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      expect(parser.localName).toBe('mustache');
    });
  });

  describe('parse()', () => {
    it('should return empty array for empty string', () => {
      const parser = new TestParser();
      const result = parser.parse('');
      expect(result).toEqual([]);
    });

    it('should return single Text node for text without expressions', () => {
      const parser = new TestParser();
      const result = parser.parse('Hello World');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Text);
      expect(result[0].textContent).toBe('Hello World');
    });

    it('should parse a single expression', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{name}}');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[0].textContent).toBe('name');
    });

    it('should parse expression with surrounding text', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('Hello {{name}}!');

      expect(result).toHaveLength(3);

      // Static text before
      expect(result[0]).toBeInstanceOf(Text);
      expect(result[0].textContent).toBe('Hello ');

      // Expression
      expect(result[1]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[1].textContent).toBe('name');

      // Static text after
      expect(result[2]).toBeInstanceOf(Text);
      expect(result[2].textContent).toBe('!');
    });

    it('should parse multiple expressions', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('Hello {{first}} {{last}}!');

      expect(result).toHaveLength(5);

      expect(result[0].textContent).toBe('Hello ');
      expect(result[1]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[1].textContent).toBe('first');
      expect(result[2].textContent).toBe(' ');
      expect(result[3]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[3].textContent).toBe('last');
      expect(result[4].textContent).toBe('!');
    });

    it('should trim whitespace from expression content', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{  name  }}');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[0].textContent).toBe('name');
    });

    it('should handle unclosed delimiter as static text', () => {
      const parser = new TestParser();
      const result = parser.parse('Hello {{unclosed');

      expect(result).toHaveLength(2);
      expect(result[0].textContent).toBe('Hello ');
      expect(result[1].textContent).toBe('{{unclosed');
      // The second node is a plain Text, not UndeterminedTextNode
      expect(result[1]).not.toBeInstanceOf(UndeterminedTextNode);
    });

    it('should set parserName on UndeterminedTextNode instances', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{name}}');

      const undetermined = result[0] as UndeterminedTextNode;
      expect(undetermined.parserName).toBe('mustache');
    });

    it('should set determined=false on UndeterminedTextNode instances', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{name}}');

      const undetermined = result[0] as UndeterminedTextNode;
      expect(undetermined.determined).toBe(false);
    });

    it('should handle adjacent expressions', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{a}}{{b}}');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[0].textContent).toBe('a');
      expect(result[1]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[1].textContent).toBe('b');
    });

    it('should handle expression with dot path', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{user.profile.name}}');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[0].textContent).toBe('user.profile.name');
    });

    it('should handle expression with pipe syntax', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{name | uppercase}}');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[0].textContent).toBe('name | uppercase');
    });

    it('should handle expression with @ context prefix', () => {
      const parser = new TestParser();
      parser.localName = 'mustache';
      const result = parser.parse('{{@item.id}}');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[0].textContent).toBe('@item.id');
    });
  });

  describe('Different delimiters', () => {
    class SquareBracketParser extends CustomTextNodeParser {
      openingIdentifier = '[[';
      closingIdentifier = ']]';
    }

    it('should work with [[ ]] delimiters', () => {
      const parser = new SquareBracketParser();
      parser.localName = 'polymer';
      const result = parser.parse('Count: [[count]]');

      expect(result).toHaveLength(2);
      expect(result[0].textContent).toBe('Count: ');
      expect(result[1]).toBeInstanceOf(UndeterminedTextNode);
      expect(result[1].textContent).toBe('count');
    });
  });
});
