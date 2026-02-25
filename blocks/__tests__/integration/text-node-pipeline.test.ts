/**
 * @file text-node-pipeline.test.ts
 * @description Integration tests for the full text node expression pipeline
 *
 * Tests the complete flow of component composition:
 * 1. Text node parsers (DoubleCurlyBracketParser, DoubleSquareBracketParser) split text
 * 2. Expression parsers (ValueParser, PipeParser) parse expressions
 * 3. Context resolution maps queries to values
 * 4. Expression evaluation produces rendered values
 *
 * These tests verify that the components integrate correctly by testing the
 * pipeline step by step. Full DOM integration is verified by E2E tests
 * in a real browser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CustomExpressionParserRegistry from '../../../plugs/webexpressions/CustomExpressionParserRegistry';
import CustomTextNodeParserRegistry from '../../../plugs/webexpressions/CustomTextNodeParserRegistry';
import UndeterminedTextNode from '../../../plugs/webexpressions/UndeterminedTextNode';
import type { ResolvedValues } from '../../../plugs/webexpressions';
import { ValueParser } from '../../parsers/value/ValueParser';
import { PipeParser } from '../../parsers/pipe/PipeParser';
import DoubleCurlyBracketParser from '../../parsers/text-node/double-curly/DoubleCurlyBracketParser';
import DoubleSquareBracketParser from '../../parsers/text-node/double-square/DoubleSquareBracketParser';

describe('Text Node Pipeline Integration', () => {
  let expressionParsers: CustomExpressionParserRegistry;
  let textNodeParsers: CustomTextNodeParserRegistry;

  beforeEach(() => {
    // Setup expression parser registry (real parsers, matching bootstrap order)
    expressionParsers = new CustomExpressionParserRegistry();
    expressionParsers.define('value', new ValueParser());
    expressionParsers.define('pipe', new PipeParser());

    // Setup text node parser registry (real parsers)
    textNodeParsers = new CustomTextNodeParserRegistry();
    textNodeParsers.define('mustache', new DoubleCurlyBracketParser());
    textNodeParsers.define('polymer', new DoubleSquareBracketParser());
  });

  /**
   * Run the full pipeline: parse text → extract expressions → evaluate → join results
   */
  function runPipeline(text: string, resolved: ResolvedValues): string {
    // Step 1: Parse with all text node parsers
    const parsers = textNodeParsers.values();
    let nodes: Text[] = [new Text(text)];

    for (const parser of parsers) {
      const nextNodes: Text[] = [];
      for (const node of nodes) {
        // Skip nodes already claimed by a previous parser
        if (node instanceof UndeterminedTextNode) {
          nextNodes.push(node);
          continue;
        }
        if (node.textContent) {
          const parsed = parser.parse(node.textContent);
          nextNodes.push(...(parsed.length > 0 ? parsed : [node]));
        } else {
          nextNodes.push(node);
        }
      }
      nodes = nextNodes;
    }

    // Step 2 & 3: For expression nodes, parse and evaluate the expression
    return nodes.map(node => {
      if (node instanceof UndeterminedTextNode && node.parserName) {
        const expression = node.textContent?.trim() || '';
        const parseResult = expressionParsers.parse(expression);

        if (parseResult.success && parseResult.expressions.length > 0) {
          const expr = parseResult.expressions[parseResult.expressions.length - 1];
          const value = expr.evaluate?.(resolved);
          return value !== null && value !== undefined ? String(value) : '';
        }
        return '';
      }
      return node.textContent || '';
    }).join('');
  }

  it('should render a simple {{name}} expression', () => {
    const resolved: ResolvedValues = {
      contexts: { state: { name: 'John' } },
      magic: {},
    };

    expect(runPipeline('Hello {{name}}!', resolved)).toBe('Hello John!');
  });

  it('should render nested path expression', () => {
    const resolved: ResolvedValues = {
      contexts: { state: { user: { profile: { name: 'Jane' } } } },
      magic: {},
    };

    expect(runPipeline('User: {{user.profile.name}}', resolved)).toBe('User: Jane');
  });

  it('should render named context expression', () => {
    const resolved: ResolvedValues = {
      contexts: { theme: { primary: '#6366f1' } },
      magic: {},
    };

    expect(runPipeline('Color: {{@theme.primary}}', resolved)).toBe('Color: #6366f1');
  });

  it('should render pipe expression', () => {
    const resolved: ResolvedValues = {
      contexts: {
        state: { name: 'world' },
        filters: { uppercase: (v: unknown) => String(v).toUpperCase() },
      },
      magic: {},
    };

    expect(runPipeline('{{name | uppercase}}', resolved)).toBe('WORLD');
  });

  it('should render multiple expressions in one text node', () => {
    const resolved: ResolvedValues = {
      contexts: { state: { first: 'Jane', last: 'Doe' } },
      magic: {},
    };

    expect(runPipeline('{{first}} {{last}}', resolved)).toBe('Jane Doe');
  });

  it('should render Polymer-style [[expression]]', () => {
    const resolved: ResolvedValues = {
      contexts: { state: { count: 42 } },
      magic: {},
    };

    expect(runPipeline('Count: [[count]]', resolved)).toBe('Count: 42');
  });

  it('should render mixed {{ }} and [[ ]] syntax', () => {
    const resolved: ResolvedValues = {
      contexts: { state: { name: 'World', count: 42 } },
      magic: {},
    };

    expect(runPipeline('{{name}} / [[count]]', resolved)).toBe('World / 42');
  });

  it('should leave plain text unchanged', () => {
    const resolved: ResolvedValues = { contexts: {}, magic: {} };
    expect(runPipeline('No expressions here', resolved)).toBe('No expressions here');
  });

  it('should render literal values', () => {
    const resolved: ResolvedValues = { contexts: {}, magic: {} };
    expect(runPipeline('{{42}} and {{true}}', resolved)).toBe('42 and true');
  });

  it('should correctly parse then evaluate expressions end-to-end', () => {
    // Verify the complete pipeline produces correct query → resolve → evaluate flow
    const mustacheParser = textNodeParsers.get('mustache')!;

    // Step 1: Parse text with mustache parser
    const parsed = mustacheParser.parse('Hello {{user.name}}!');
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toBeInstanceOf(Text);
    expect(parsed[0].textContent).toBe('Hello ');
    expect(parsed[1]).toBeInstanceOf(UndeterminedTextNode);
    expect(parsed[1].textContent).toBe('user.name');
    expect(parsed[2].textContent).toBe('!');

    // Step 2: Parse expression
    const parseResult = expressionParsers.parse('user.name');
    expect(parseResult.success).toBe(true);
    expect(parseResult.queries).toHaveLength(1);
    expect(parseResult.queries[0]).toEqual({
      type: 'context',
      context: 'state',
      path: 'user.name',
    });

    // Step 3: Resolve and evaluate
    const resolved: ResolvedValues = {
      contexts: { state: { user: { name: 'Alice' } } },
      magic: {},
    };
    const value = parseResult.expressions[0].evaluate?.(resolved);
    expect(value).toBe('Alice');
  });
});
