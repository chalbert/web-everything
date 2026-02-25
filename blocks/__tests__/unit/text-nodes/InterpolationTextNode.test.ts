/**
 * @file InterpolationTextNode.test.ts
 * @description Unit tests for InterpolationTextNode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InterpolationTextNode from '../../../../blocks/text-nodes/interpolation/InterpolationTextNode';
import CustomTextNode from '../../../../plugs/webexpressions/CustomTextNode';
import InjectorRoot from '../../../../plugs/webinjectors/InjectorRoot';
import CustomExpressionParserRegistry from '../../../../plugs/webexpressions/CustomExpressionParserRegistry';
import { ValueParser } from '../../../../blocks/parsers/value/ValueParser';
import { PipeParser } from '../../../../blocks/parsers/pipe/PipeParser';

describe('InterpolationTextNode', () => {
  let expressionParsers: CustomExpressionParserRegistry;
  let getProviderOfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Setup expression parser registry
    expressionParsers = new CustomExpressionParserRegistry();
    expressionParsers.define('value', new ValueParser());
    expressionParsers.define('pipe', new PipeParser());

    // Mock InjectorRoot.getProviderOf to return our test providers
    // This avoids needing a real DOM/injector chain (and happy-dom issues)
    getProviderOfSpy = vi.spyOn(InjectorRoot, 'getProviderOf');
  });

  afterEach(() => {
    getProviderOfSpy.mockRestore();
  });

  it('should extend CustomTextNode', () => {
    const node = new InterpolationTextNode({ children: 'test' });
    expect(node).toBeInstanceOf(CustomTextNode);
    expect(node).toBeInstanceOf(Text);
  });

  describe('connectedCallback()', () => {
    it('should evaluate a simple state reference', () => {
      const stateContext = { name: 'World' };

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        if (providerName === 'customContexts:state') return stateContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: 'name' });
      node.connectedCallback!();

      expect(node.textContent).toBe('World');
    });

    it('should evaluate a nested state path', () => {
      const stateContext = { user: { profile: { name: 'Jane' } } };

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        if (providerName === 'customContexts:state') return stateContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: 'user.profile.name' });
      node.connectedCallback!();

      expect(node.textContent).toBe('Jane');
    });

    it('should evaluate a named context reference', () => {
      const themeContext = { primary: '#6366f1' };

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        if (providerName === 'customContexts:theme') return themeContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: '@theme.primary' });
      node.connectedCallback!();

      expect(node.textContent).toBe('#6366f1');
    });

    it('should evaluate a pipe expression', () => {
      const stateContext = { name: 'world' };
      const filtersContext = {
        uppercase: (v: unknown) => String(v).toUpperCase(),
      };

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        if (providerName === 'customContexts:state') return stateContext;
        if (providerName === 'customContexts:filters') return filtersContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: 'name | uppercase' });
      node.connectedCallback!();

      expect(node.textContent).toBe('WORLD');
    });

    it('should render empty string for empty expression', () => {
      const node = new InterpolationTextNode({ children: '' });
      node.connectedCallback!();

      expect(node.textContent).toBe('');
    });

    it('should render empty string when parser registry not found', () => {
      getProviderOfSpy.mockReturnValue(undefined);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const node = new InterpolationTextNode({ children: 'name' });
      node.connectedCallback!();
      warnSpy.mockRestore();

      expect(node.textContent).toBe('');
    });

    it('should render empty string for unparseable expression', () => {
      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        return undefined;
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const node = new InterpolationTextNode({ children: '!@#$%' });
      node.connectedCallback!();
      warnSpy.mockRestore();

      expect(node.textContent).toBe('');
    });

    it('should render literal values', () => {
      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: '42' });
      node.connectedCallback!();

      expect(node.textContent).toBe('42');
    });

    it('should render null context as empty string', () => {
      const stateContext = { name: null };

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        if (providerName === 'customContexts:state') return stateContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: 'name' });
      node.connectedCallback!();

      expect(node.textContent).toBe('');
    });

    it('should be idempotent (guard against double calls)', () => {
      const stateContext = { name: 'World' };
      let callCount = 0;

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') {
          callCount++;
          return expressionParsers;
        }
        if (providerName === 'customContexts:state') return stateContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: 'name' });
      node.connectedCallback!();
      node.connectedCallback!(); // Second call should be a no-op

      expect(callCount).toBe(1);
      expect(node.textContent).toBe('World');
    });
  });

  describe('disconnectedCallback()', () => {
    it('should clear parse result and allow re-evaluation', () => {
      const stateContext = { name: 'World' };

      getProviderOfSpy.mockImplementation((_node: any, providerName: string) => {
        if (providerName === 'customExpressionParsers') return expressionParsers;
        if (providerName === 'customContexts:state') return stateContext;
        return undefined;
      });

      const node = new InterpolationTextNode({ children: 'name' });
      node.connectedCallback!();
      expect(node.textContent).toBe('World');

      node.disconnectedCallback!();

      // After disconnect, should be able to reconnect
      node.connectedCallback!();
      expect(node.textContent).toBe('World');
    });
  });
});
