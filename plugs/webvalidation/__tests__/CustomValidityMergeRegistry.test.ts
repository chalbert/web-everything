/**
 * Runtime `customValidityMerge` registry (#215): the live plug fulfils the same
 * `define`/`resolve` surface as the standalone model (#212), but as a core `CustomRegistry` so it is
 * injector-chain-resolvable and inheritable via `extends`.
 */
import { describe, it, expect } from 'vitest';
import CustomValidityMergeRegistry, {
  createDefaultValidityMergeRegistry,
} from '../CustomValidityMergeRegistry';
import {
  SourceReductionStrategy,
  LastWriteWinsStrategy,
  type CustomValidityMergeStrategy,
  type MergedValidity,
  type SourceResult,
} from '../../../validity-merge/provider.js';
import { UnknownStrategyError } from '../../../validity-merge/registry.js';

describe('CustomValidityMergeRegistry', () => {
  it('is a core CustomRegistry with the customValidityMerge localName', () => {
    const registry = new CustomValidityMergeRegistry();
    expect(registry.localName).toBe('customValidityMerge');
    // Inherits the CustomRegistry surface (so the injector chain can store + resolve it).
    expect(typeof registry.has).toBe('function');
    expect(typeof registry.keys).toBe('function');
  });

  it('define(strategy) keys by the strategy.key and marks the first as default', () => {
    const registry = new CustomValidityMergeRegistry();
    registry.define(new SourceReductionStrategy());
    expect(registry.has('source-reduction')).toBe(true);
    expect(registry.defaultKey).toBe('source-reduction');
    expect(registry.resolve().key).toBe('source-reduction');
  });

  it('define(strategy, asDefault=true) overrides the default even when not first', () => {
    const registry = new CustomValidityMergeRegistry();
    registry.define(new SourceReductionStrategy());
    registry.define(new LastWriteWinsStrategy(), true);
    expect(registry.defaultKey).toBe('last-write-wins');
    expect(registry.resolve().key).toBe('last-write-wins');
  });

  it('resolve(key) returns the named strategy', () => {
    const registry = createDefaultValidityMergeRegistry();
    expect(registry.resolve('source-reduction').key).toBe('source-reduction');
    expect(registry.resolve('last-write-wins').key).toBe('last-write-wins');
  });

  it('resolve throws UnknownStrategyError for an unregistered name', () => {
    const registry = createDefaultValidityMergeRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownStrategyError);
  });

  it('resolve() throws when nothing is registered (no default)', () => {
    const registry = new CustomValidityMergeRegistry();
    expect(() => registry.resolve()).toThrow(UnknownStrategyError);
  });

  it('custom strategies are first-class — registered and resolved like the shipped ones', () => {
    const registry = createDefaultValidityMergeRegistry();
    const firstInvalid: CustomValidityMergeStrategy = {
      key: 'first-invalid',
      merge(sources: SourceResult[]): MergedValidity {
        const bad = sources.find((s) => s.state === 'invalid');
        const version = sources.reduce((m, s) => Math.max(m, s.version ?? 0), 0);
        return bad
          ? {
              state: 'invalid',
              valid: false,
              pending: false,
              messages: bad.message ? [{ source: bad.source, message: bad.message }] : [],
              blocking: bad.source,
              version,
            }
          : { state: 'valid', valid: true, pending: false, messages: [], blocking: null, version };
      },
    };
    registry.define(firstInvalid);
    expect(registry.resolve('first-invalid')).toBe(firstInvalid);
  });

  it('createDefaultValidityMergeRegistry ships both strategies, source-reduction default', () => {
    const registry = createDefaultValidityMergeRegistry();
    expect([...registry.keys()].sort()).toEqual(['last-write-wins', 'source-reduction']);
    expect(registry.defaultKey).toBe('source-reduction');
  });

  it('is inheritable — a child registry resolves a parent-registered strategy (scope cascade)', () => {
    const parent = createDefaultValidityMergeRegistry();
    const child = new CustomValidityMergeRegistry({ extends: [parent] });
    // The child sees the parent's strategies through the CustomRegistry `extends` chain.
    expect(child.has('source-reduction')).toBe(true);
    // ...and can override with its own without touching the parent.
    child.define(new LastWriteWinsStrategy(), true);
    expect(child.defaultKey).toBe('last-write-wins');
    expect(parent.defaultKey).toBe('source-reduction');
  });
});
