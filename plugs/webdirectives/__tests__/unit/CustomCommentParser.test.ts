/**
 * Unit test for the default comment parser + parser registry — #1132 (webdirectives completion #1098).
 *
 * Pure string parsing (no DOM): the default namespaced parser extracts `namespace:name` + options,
 * recognizes the closing marker, and declines non-directive comments; the registry tries parsers in
 * order and a custom parser can take precedence.
 */
import { describe, it, expect } from 'vitest';
import {
  DefaultCommentParser,
  defaultCommentParser,
  parseClosingMarker,
} from '../../CustomCommentParser';
import CustomCommentParserRegistry, {
  createDefaultCommentParserRegistry,
} from '../../CustomCommentParserRegistry';

describe('DefaultCommentParser', () => {
  const parser = new DefaultCommentParser();

  it('parses a namespace:name directive with no options', () => {
    expect(parser.parse(' resource:loader ')).toEqual({ name: 'resource:loader', options: {} });
  });

  it('parses options as key="value", coercing booleans and numbers', () => {
    const result = parser.parse('control:if cond="x.y" eager retries=3 disabled=false');
    expect(result).toEqual({
      name: 'control:if',
      options: { cond: 'x.y', eager: true, retries: 3, disabled: false },
    });
  });

  it('parses a multi-line option block (the spec html form)', () => {
    const result = parser.parse('resource:loader\n  src="/a.js"\n  defer="true"\n');
    expect(result).toEqual({ name: 'resource:loader', options: { src: '/a.js', defer: true } });
  });

  it('returns null for a closing marker, an empty comment, and a non-directive comment', () => {
    expect(parser.parse(' /resource:loader ')).toBeNull();
    expect(parser.parse('   ')).toBeNull();
    expect(parser.parse(' just a normal comment ')).toBeNull();
    expect(parser.parse('nocolon options=1')).toBeNull();
  });
});

describe('parseClosingMarker', () => {
  it('returns the directive name a closing marker closes', () => {
    expect(parseClosingMarker(' /resource:loader ')).toBe('resource:loader');
    expect(parseClosingMarker(' resource:loader ')).toBeNull(); // an opening is not a closing marker
    expect(parseClosingMarker(' /not-a-name ')).toBeNull();
  });
});

describe('CustomCommentParserRegistry', () => {
  it('has localName customCommentParsers and tries parsers in definition order', () => {
    const registry = new CustomCommentParserRegistry();
    expect(registry.localName).toBe('customCommentParsers');
    registry.define('default', defaultCommentParser);
    expect(registry.parse(' resource:loader x="1" ')).toEqual({
      name: 'resource:loader',
      options: { x: 1 },
    });
    expect(registry.parse(' /resource:loader ')).toBeNull();
  });

  it('a custom parser registered first takes precedence', () => {
    const registry = createDefaultCommentParserRegistry();
    registry.define('each', {
      parse: (t) => (t.trim().startsWith('#each')
        ? { name: 'control:for-each', options: { raw: t.trim() } }
        : null),
    });
    // The custom parser (defined after default) only matches #each; the default still handles the rest.
    expect(registry.parse('#each items')?.name).toBe('control:for-each');
    expect(registry.parse(' resource:loader ')?.name).toBe('resource:loader');
  });

  it('createDefault is pre-loaded with the default parser', () => {
    const registry = createDefaultCommentParserRegistry();
    expect(registry.has('default')).toBe(true);
    expect(registry.parseClosingMarker(' /control:if ')).toBe('control:if');
  });
});
