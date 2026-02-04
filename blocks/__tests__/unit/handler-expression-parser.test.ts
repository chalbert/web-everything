/**
 * Unit tests for HandlerExpressionParser
 *
 * Tests the parser in isolation without DOM or injector dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HandlerExpressionParser,
  HandlerExpressionShadowError,
  type ParsedHandlerExpression,
  type HandlerContext,
} from '../../parsers/handler-expression/HandlerExpressionParser';

describe('HandlerExpressionParser', () => {
  let parser: HandlerExpressionParser;

  beforeEach(() => {
    parser = new HandlerExpressionParser();
  });

  describe('parse', () => {
    describe('handler name only', () => {
      it('should parse simple handler name without parens', () => {
        const result = parser.parse('save');
        expect(result).toEqual({
          handlerName: 'save',
          args: [],
          raw: 'save',
        });
      });

      it('should parse handler name with empty parens', () => {
        const result = parser.parse('save()');
        expect(result).toEqual({
          handlerName: 'save',
          args: [],
          raw: 'save()',
        });
      });

      it('should trim whitespace', () => {
        const result = parser.parse('  save  ');
        expect(result).toEqual({
          handlerName: 'save',
          args: [],
          raw: 'save',
        });
      });

      it('should return null for empty string', () => {
        expect(parser.parse('')).toBeNull();
        expect(parser.parse('   ')).toBeNull();
      });
    });

    describe('magic variables', () => {
      it('should parse $event', () => {
        const result = parser.parse('handler($event)');
        expect(result?.args).toEqual([
          { type: 'magic', name: 'event' },
        ]);
      });

      it('should parse $element', () => {
        const result = parser.parse('handler($element)');
        expect(result?.args).toEqual([
          { type: 'magic', name: 'element' },
        ]);
      });

      it('should parse $target', () => {
        const result = parser.parse('handler($target)');
        expect(result?.args).toEqual([
          { type: 'magic', name: 'target' },
        ]);
      });

      it('should parse magic variable with path', () => {
        const result = parser.parse('handler($event.target.value)');
        expect(result?.args).toEqual([
          { type: 'magic', name: 'event.target.value' },
        ]);
      });
    });

    describe('named contexts', () => {
      it('should parse @context without path', () => {
        const result = parser.parse('handler(@item)');
        expect(result?.args).toEqual([
          { type: 'context', context: 'item', path: '' },
        ]);
      });

      it('should parse @context with path', () => {
        const result = parser.parse('handler(@item.id)');
        expect(result?.args).toEqual([
          { type: 'context', context: 'item', path: 'id' },
        ]);
      });

      it('should parse @context with nested path', () => {
        const result = parser.parse('handler(@user.profile.name)');
        expect(result?.args).toEqual([
          { type: 'context', context: 'user', path: 'profile.name' },
        ]);
      });

      it('should parse @state explicitly', () => {
        const result = parser.parse('handler(@state.count)');
        expect(result?.args).toEqual([
          { type: 'context', context: 'state', path: 'count' },
        ]);
      });
    });

    describe('state paths (bare identifiers)', () => {
      it('should parse simple identifier as state', () => {
        const result = parser.parse('handler(count)');
        expect(result?.args).toEqual([
          { type: 'state', path: 'count' },
        ]);
      });

      it('should parse dotted path as state', () => {
        const result = parser.parse('handler(user.name)');
        expect(result?.args).toEqual([
          { type: 'state', path: 'user.name' },
        ]);
      });
    });

    describe('literals', () => {
      it('should parse true', () => {
        const result = parser.parse('handler(true)');
        expect(result?.args).toEqual([
          { type: 'literal', value: true },
        ]);
      });

      it('should parse false', () => {
        const result = parser.parse('handler(false)');
        expect(result?.args).toEqual([
          { type: 'literal', value: false },
        ]);
      });

      it('should parse null', () => {
        const result = parser.parse('handler(null)');
        expect(result?.args).toEqual([
          { type: 'literal', value: null },
        ]);
      });

      it('should parse integers', () => {
        const result = parser.parse('handler(42)');
        expect(result?.args).toEqual([
          { type: 'literal', value: 42 },
        ]);
      });

      it('should parse negative numbers', () => {
        const result = parser.parse('handler(-5)');
        expect(result?.args).toEqual([
          { type: 'literal', value: -5 },
        ]);
      });

      it('should parse floats', () => {
        const result = parser.parse('handler(3.14)');
        expect(result?.args).toEqual([
          { type: 'literal', value: 3.14 },
        ]);
      });

      it('should parse double-quoted strings', () => {
        const result = parser.parse('handler("hello")');
        expect(result?.args).toEqual([
          { type: 'literal', value: 'hello' },
        ]);
      });

      it('should parse single-quoted strings', () => {
        const result = parser.parse("handler('world')");
        expect(result?.args).toEqual([
          { type: 'literal', value: 'world' },
        ]);
      });
    });

    describe('multiple arguments', () => {
      it('should parse multiple arguments', () => {
        const result = parser.parse('save($event, @item.id, count)');
        expect(result?.args).toEqual([
          { type: 'magic', name: 'event' },
          { type: 'context', context: 'item', path: 'id' },
          { type: 'state', path: 'count' },
        ]);
      });

      it('should handle whitespace around arguments', () => {
        const result = parser.parse('handler(  $event  ,  @item  ,  42  )');
        expect(result?.args).toHaveLength(3);
        expect(result?.args[0]).toEqual({ type: 'magic', name: 'event' });
        expect(result?.args[1]).toEqual({ type: 'context', context: 'item', path: '' });
        expect(result?.args[2]).toEqual({ type: 'literal', value: 42 });
      });

      it('should handle mixed argument types', () => {
        const result = parser.parse('complex($event, @form.field, state.value, true, 42, "text")');
        expect(result?.args).toHaveLength(6);
      });
    });

    describe('edge cases', () => {
      it('should handle nested parentheses in strings', () => {
        const result = parser.parse('handler("(nested)")');
        expect(result?.args).toEqual([
          { type: 'literal', value: '(nested)' },
        ]);
      });

      it('should return null for invalid syntax', () => {
        expect(parser.parse('handler(')).toBeNull();
        expect(parser.parse('handler)')).toBeNull();
      });
    });
  });

  describe('evaluate', () => {
    it('should call the handler with resolved arguments', () => {
      const handler = vi.fn();
      const parsed = parser.parse('myHandler($event, @item.id)');
      const context: HandlerContext = {
        magic: { event: { type: 'click' } },
        contexts: new Map([['item', { id: 123 }]]),
        state: {},
        handlers: { myHandler: handler },
      };

      parser.evaluate(parsed!, context);

      expect(handler).toHaveBeenCalledWith({ type: 'click' }, 123);
    });

    it('should warn and return undefined for missing handler', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const parsed = parser.parse('missing()');
      const context: HandlerContext = {
        magic: {},
        contexts: new Map(),
        state: {},
        handlers: {},
      };

      const result = parser.evaluate(parsed!, context);

      expect(result).toBeUndefined();
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Handler "missing" not found')
      );

      consoleWarn.mockRestore();
    });

    it('should resolve nested state paths', () => {
      const handler = vi.fn();
      const parsed = parser.parse('handler(user.profile.name)');
      const context: HandlerContext = {
        magic: {},
        contexts: new Map(),
        state: { user: { profile: { name: 'John' } } },
        handlers: { handler },
      };

      parser.evaluate(parsed!, context);

      expect(handler).toHaveBeenCalledWith('John');
    });

    it('should warn for missing context', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handler = vi.fn();
      const parsed = parser.parse('handler(@missing.value)');
      const context: HandlerContext = {
        magic: {},
        contexts: new Map(),
        state: {},
        handlers: { handler },
      };

      parser.evaluate(parsed!, context);

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Context "@missing" not found')
      );
      expect(handler).toHaveBeenCalledWith(undefined);

      consoleWarn.mockRestore();
    });
  });

  describe('checkShadowing', () => {
    it('should not warn when no shadowing', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const contexts = new Map([['existing', {}]]);

      parser.checkShadowing('newContext', contexts);

      expect(consoleWarn).not.toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it('should warn when shadowing in warn mode (default)', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const contexts = new Map([['item', {}]]);

      parser.checkShadowing('item', contexts);

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('shadows an existing context')
      );
      consoleWarn.mockRestore();
    });

    it('should throw in error mode', () => {
      const errorParser = new HandlerExpressionParser({ shadowMode: 'error' });
      const contexts = new Map([['item', {}]]);

      expect(() => errorParser.checkShadowing('item', contexts))
        .toThrow(HandlerExpressionShadowError);
    });

    it('should be silent in allow mode', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const allowParser = new HandlerExpressionParser({ shadowMode: 'allow' });
      const contexts = new Map([['item', {}]]);

      allowParser.checkShadowing('item', contexts);

      expect(consoleWarn).not.toHaveBeenCalled();
      consoleWarn.mockRestore();
    });
  });

  describe('options', () => {
    it('should use custom context prefix', () => {
      const customParser = new HandlerExpressionParser({ contextPrefix: '#' });
      const result = customParser.parse('handler(#item.id)');
      expect(result?.args).toEqual([
        { type: 'context', context: 'item', path: 'id' },
      ]);
    });

    it('should use custom magic prefix', () => {
      const customParser = new HandlerExpressionParser({ magicPrefix: '~' });
      const result = customParser.parse('handler(~event)');
      expect(result?.args).toEqual([
        { type: 'magic', name: 'event' },
      ]);
    });

    it('should use custom magic vars', () => {
      const customParser = new HandlerExpressionParser({
        magicVars: ['ev', 'el'],
        magicPrefix: '$'
      });
      const result = customParser.parse('handler($ev)');
      expect(result?.args).toEqual([
        { type: 'magic', name: 'ev' },
      ]);
    });
  });
});
