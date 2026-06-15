/**
 * The CEL cross-field pivot (#504, ratified #465). Pins the subset parser + the per-dialect transpilers
 * — the canonical representation a WE-compliant component carries; boundary formats normalize in/out of it.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCel, CelParseError, referencedFields, toJs, toPython, transpileRules, JS_DIALECT, PY_DIALECT,
} from '../cel';

describe('parseCel — the subset', () => {
  it('parses a comparison into the neutral AST', () => {
    expect(parseCel('endDate > startDate')).toEqual({
      type: 'binary', op: '>',
      left: { type: 'id', path: ['endDate'] },
      right: { type: 'id', path: ['startDate'] },
    });
  });

  it('parses literals, member access, logic, and the conditional', () => {
    const ast = parseCel("category == 'gift' ? giftLetter != null : true");
    expect(ast.type).toBe('ternary');
  });

  it('honours precedence (&& binds tighter than ||)', () => {
    const ast = parseCel('a || b && c');
    expect(ast).toMatchObject({ type: 'binary', op: '||', right: { type: 'binary', op: '&&' } });
  });

  it('rejects anything outside the subset (function/macro calls)', () => {
    expect(() => parseCel('has(foo)')).toThrow(CelParseError);
    expect(() => parseCel('size(items) > 0')).toThrow(CelParseError);
    expect(() => parseCel('a >')).toThrow(CelParseError);
    expect(() => parseCel('')).toThrow(CelParseError);
  });

  it('collects referenced fields', () => {
    expect([...referencedFields(parseCel('a.b > c && d == 1'))].sort()).toEqual(['a.b', 'c', 'd']);
  });
});

describe('transpile — dialects', () => {
  it('JS: identifiers resolve against `data`, == becomes ===', () => {
    expect(toJs('endDate > startDate')).toBe('(data.endDate > data.startDate)');
    expect(toJs("category == 'gift' ? giftLetter != null : true")).toBe(
      "((data.category === \"gift\") ? (data.giftLetter !== null) : true)",
    );
  });

  it('Python: identifiers resolve against `self`, &&→and, ternary→`a if c else b`', () => {
    expect(toPython('endDate > startDate')).toBe('(self.endDate > self.startDate)');
    expect(toPython("a == 'x' && b != null")).toBe('((self.a == "x") and (self.b != None))');
    expect(toPython("c == 1 ? x : y")).toBe('(self.x if (self.c == 1) else self.y)');
  });

  it('transpileRules partitions the subset from the unsupported', () => {
    const { transpiled, unsupported } = transpileRules(
      [{ rule: 'a > b', message: 'm' }, { rule: 'has(x)' }],
      JS_DIALECT,
    );
    expect(transpiled).toEqual([{ rule: 'a > b', message: 'm', code: '(data.a > data.b)' }]);
    expect(unsupported).toEqual(['has(x)']);
  });
});
