/**
 * Validity-merge strategies — the #212 DoD: source-reduction (native-first default) and
 * last-write-wins (degenerate) both emit the #004 OP-1 surface contract; the guard catches a
 * strategy that breaks it.
 */
import { describe, it, expect } from 'vitest';
import {
  SourceReductionStrategy,
  LastWriteWinsStrategy,
  assertMergedValidity,
  isMergedValidity,
  SurfaceContractError,
  type SourceResult,
} from '../provider.js';

const src = (source: string, state: SourceResult['state'], extra: Partial<SourceResult> = {}): SourceResult => ({
  source,
  state,
  ...extra,
});

describe('SourceReductionStrategy (native-first default)', () => {
  const strategy = new SourceReductionStrategy();

  it('is idle when every source is idle or there are none', () => {
    expect(strategy.merge([]).state).toBe('idle');
    expect(strategy.merge([src('native', 'idle'), src('schema', 'idle')]).state).toBe('idle');
  });

  it('is valid only when no source is pending or invalid', () => {
    const merged = strategy.merge([src('native', 'valid'), src('schema', 'valid')]);
    expect(merged).toMatchObject({ state: 'valid', valid: true, pending: false, blocking: null });
  });

  it('pending wins over valid/invalid — a value still being checked is not yet decided', () => {
    const merged = strategy.merge([src('native', 'invalid', { message: 'x' }), src('async', 'pending', { version: 7 })]);
    expect(merged).toMatchObject({ state: 'pending', pending: true, valid: false, blocking: null, version: 7 });
  });

  it('any invalid source fails the field (strictest-wins)', () => {
    const merged = strategy.merge([src('native', 'valid'), src('schema', 'invalid', { message: 'too short' })]);
    expect(merged).toMatchObject({ state: 'invalid', valid: false, blocking: 'schema' });
    expect(merged.messages).toEqual([{ source: 'schema', message: 'too short' }]);
  });

  it('declared precedence orders messages and picks the blocking source', () => {
    const merged = strategy.merge([
      src('manual', 'invalid', { message: 'server says no' }),
      src('native', 'invalid', { message: 'required' }),
    ]);
    // native precedes manual in DEFAULT_PRECEDENCE → native blocks and leads the messages
    expect(merged.blocking).toBe('native');
    expect(merged.messages).toEqual([
      { source: 'native', message: 'required' },
      { source: 'manual', message: 'server says no' },
    ]);
  });

  it('honours an injected precedence', () => {
    const manualFirst = new SourceReductionStrategy(['manual', 'native']);
    const merged = manualFirst.merge([
      src('native', 'invalid', { message: 'required' }),
      src('manual', 'invalid', { message: 'server says no' }),
    ]);
    expect(merged.blocking).toBe('manual');
  });

  it('carries the latest generation token as the merged version (stable-id)', () => {
    expect(strategy.merge([src('native', 'valid', { version: 3 }), src('async', 'valid', { version: 9 })]).version).toBe(9);
  });
});

describe('LastWriteWinsStrategy (degenerate single-source reduction)', () => {
  const strategy = new LastWriteWinsStrategy();

  it('is idle for an empty source set', () => {
    expect(strategy.merge([]).state).toBe('idle');
  });

  it('the most recently written source clobbers the rest', () => {
    const merged = strategy.merge([
      src('native', 'invalid', { message: 'required', version: 1 }),
      src('async', 'valid', { version: 2 }),
    ]);
    // async wrote last → valid wins even though native is invalid (the "flat flag")
    expect(merged).toMatchObject({ state: 'valid', valid: true, blocking: null, version: 2 });
  });

  it('surfaces the last source as blocking when it is invalid', () => {
    const merged = strategy.merge([src('native', 'valid', { version: 1 }), src('manual', 'invalid', { message: 'taken', version: 2 })]);
    expect(merged).toMatchObject({ state: 'invalid', blocking: 'manual' });
    expect(merged.messages).toEqual([{ source: 'manual', message: 'taken' }]);
  });
});

describe('surface contract (#004 OP-1)', () => {
  it('both shipped strategies emit a conformant MergedValidity', () => {
    const sources = [src('native', 'invalid', { message: 'x', version: 1 }), src('async', 'pending', { version: 2 })];
    expect(isMergedValidity(new SourceReductionStrategy().merge(sources))).toBe(true);
    expect(isMergedValidity(new LastWriteWinsStrategy().merge(sources))).toBe(true);
  });

  it('rejects non-conformant shapes', () => {
    expect(isMergedValidity(null)).toBe(false);
    expect(isMergedValidity({ state: 'valid' })).toBe(false);
    expect(isMergedValidity({ state: 'bogus', valid: false, pending: false, messages: [], blocking: null, version: 0 })).toBe(false);
  });

  it('assertMergedValidity catches a custom strategy that breaks the surface', () => {
    // valid/state disagree — a computation bug that must not reach the view layer
    const broken = { state: 'invalid', valid: true, pending: false, messages: [], blocking: 'x', version: 0 };
    expect(() => assertMergedValidity('rogue', broken)).toThrow(SurfaceContractError);
    expect(() => assertMergedValidity('rogue', { not: 'a surface' })).toThrow(SurfaceContractError);
  });
});
