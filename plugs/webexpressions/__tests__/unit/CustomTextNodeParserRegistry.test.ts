/**
 * @file CustomTextNodeParserRegistry.test.ts
 * @description Unit tests for CustomTextNodeParserRegistry
 */

import { describe, it, expect } from 'vitest';
import CustomTextNodeParserRegistry from '../../CustomTextNodeParserRegistry';
import CustomTextNodeParser from '../../CustomTextNodeParser';

class TestParser extends CustomTextNodeParser {
  openingIdentifier = '{{';
  closingIdentifier = '}}';
}

describe('CustomTextNodeParserRegistry', () => {
  describe('Construction', () => {
    it('should have localName "customTextNodeParsers"', () => {
      const registry = new CustomTextNodeParserRegistry();
      expect(registry.localName).toBe('customTextNodeParsers');
    });

    it('should start empty', () => {
      const registry = new CustomTextNodeParserRegistry();
      expect(registry.size).toBe(0);
    });
  });

  describe('define()', () => {
    it('should register a parser by name', () => {
      const registry = new CustomTextNodeParserRegistry();
      const parser = new TestParser();

      registry.define('mustache', parser);

      expect(registry.has('mustache')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should set parser localName', () => {
      const registry = new CustomTextNodeParserRegistry();
      const parser = new TestParser();

      registry.define('mustache', parser);

      expect(parser.localName).toBe('mustache');
    });

    it('should allow multiple parsers', () => {
      const registry = new CustomTextNodeParserRegistry();
      const parser1 = new TestParser();
      const parser2 = new TestParser();

      registry.define('mustache', parser1);
      registry.define('polymer', parser2);

      expect(registry.size).toBe(2);
      expect(registry.has('mustache')).toBe(true);
      expect(registry.has('polymer')).toBe(true);
    });
  });

  describe('get()', () => {
    it('should retrieve a registered parser', () => {
      const registry = new CustomTextNodeParserRegistry();
      const parser = new TestParser();

      registry.define('mustache', parser);

      expect(registry.get('mustache')).toBe(parser);
    });

    it('should return undefined for unregistered name', () => {
      const registry = new CustomTextNodeParserRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('values()', () => {
    it('should return all registered parsers', () => {
      const registry = new CustomTextNodeParserRegistry();
      const parser1 = new TestParser();
      const parser2 = new TestParser();

      registry.define('mustache', parser1);
      registry.define('polymer', parser2);

      const values = registry.values();
      expect(values).toHaveLength(2);
      expect(values).toContain(parser1);
      expect(values).toContain(parser2);
    });
  });

  describe('upgrade() / downgrade()', () => {
    it('should be no-ops', () => {
      const registry = new CustomTextNodeParserRegistry();

      // Should not throw
      expect(() => registry.upgrade()).not.toThrow();
      expect(() => registry.downgrade()).not.toThrow();
    });
  });
});
