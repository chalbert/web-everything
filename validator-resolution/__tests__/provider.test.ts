/**
 * Resolution strategies — the #214 DoD: versioning (native-first default) and cancellation both decide
 * whether a freshly-arrived async answer is still current, and both stamp a generation `version` so the
 * source they emit feeds #212's `pending{version}` → `valid|invalid` merge input; the guard catches a
 * strategy that breaks that cross-plane contract.
 */
import { describe, it, expect } from 'vitest';
import {
  VersioningResolution,
  CancellationResolution,
  assertResolvedSource,
  isResolvedSource,
  SourceContractError,
} from '../provider.js';

describe('VersioningResolution (native-first default)', () => {
  it('stamps a monotonic per-field generation token', () => {
    const s = new VersioningResolution();
    expect(s.startValidation('email', 'a').version).toBe(1);
    expect(s.startValidation('email', 'ab').version).toBe(2);
    expect(s.startValidation('name', 'x').version).toBe(1); // generations are independent per field
  });

  it('applies only the current generation; drops a superseded one', () => {
    const s = new VersioningResolution();
    const h1 = s.startValidation('email', 'a');
    const h2 = s.startValidation('email', 'ab'); // input moved on
    expect(s.shouldApplyResult(h1, { state: 'valid' })).toBe(false); // late answer for stale input
    expect(s.shouldApplyResult(h2, { state: 'valid' })).toBe(true);
  });

  it('onInputChange supersedes an in-flight generation even before the next check starts', () => {
    const s = new VersioningResolution();
    const h = s.startValidation('email', 'a');
    s.onInputChange('email', 'ab');
    expect(s.shouldApplyResult(h, { state: 'valid' })).toBe(false);
  });
});

describe('CancellationResolution', () => {
  it('hands the validator an abort signal and aborts the prior request on a new check', () => {
    const s = new CancellationResolution();
    const h1 = s.startValidation('email', 'a');
    expect(h1.signal).toBeInstanceOf(AbortSignal);
    expect(h1.signal?.aborted).toBe(false);
    s.startValidation('email', 'ab'); // a fresh check tears down the prior in-flight request
    expect(h1.signal?.aborted).toBe(true);
  });

  it('drops an answer whose request was aborted', () => {
    const s = new CancellationResolution();
    const h1 = s.startValidation('email', 'a');
    s.startValidation('email', 'ab');
    expect(s.shouldApplyResult(h1, { state: 'valid' })).toBe(false);
  });

  it('onInputChange aborts the in-flight request', () => {
    const s = new CancellationResolution();
    const h = s.startValidation('email', 'a');
    s.onInputChange('email', 'ab');
    expect(h.signal?.aborted).toBe(true);
  });

  it('stamps a version so the emitted source carries the pending token', () => {
    const s = new CancellationResolution();
    expect(s.startValidation('a', 'x').version).toBe(1);
    expect(s.startValidation('b', 'y').version).toBe(2);
  });
});

describe('cross-plane source contract (feeds #212)', () => {
  it('accepts versioned pending|valid|invalid sources', () => {
    expect(isResolvedSource({ source: 'async', state: 'pending', version: 1 })).toBe(true);
    expect(isResolvedSource({ source: 'async', state: 'valid', version: 2 })).toBe(true);
    expect(isResolvedSource({ source: 'async', state: 'invalid', message: 'taken', version: 3 })).toBe(true);
  });

  it('rejects idle, unversioned, or malformed sources', () => {
    expect(isResolvedSource({ source: 'async', state: 'idle', version: 1 })).toBe(false); // the plane never emits idle
    expect(isResolvedSource({ source: 'async', state: 'valid' })).toBe(false); // no version token
    expect(isResolvedSource({ state: 'valid', version: 1 })).toBe(false); // no source name
    expect(isResolvedSource(null)).toBe(false);
  });

  it('assertResolvedSource throws SourceContractError on a malformed source', () => {
    expect(() => assertResolvedSource('rogue', { state: 'valid' })).toThrow(SourceContractError);
    expect(() => assertResolvedSource('rogue', { source: 'async', state: 'idle', version: 1 })).toThrow(SourceContractError);
  });
});
