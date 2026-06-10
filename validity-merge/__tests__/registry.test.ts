/**
 * Registry + auto-stamping orchestrator (#212): named strategies register and resolve, custom
 * strategies are first-class, generation tokens are auto-stamped, and the surface contract is
 * enforced at the merge boundary.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomValidityMergeRegistry,
  ValiditySourceOrchestrator,
  UnknownStrategyError,
} from '../registry.js';
import {
  SourceReductionStrategy,
  LastWriteWinsStrategy,
  type CustomValidityMergeStrategy,
  type MergedValidity,
} from '../provider.js';
import { createDefaultRegistry, createDefaultOrchestrator } from '../index.js';

describe('CustomValidityMergeRegistry', () => {
  it('registers, resolves by name, and falls back to the default', () => {
    const registry = new CustomValidityMergeRegistry();
    registry.define(new SourceReductionStrategy(), true);
    registry.define(new LastWriteWinsStrategy());

    expect(registry.keys()).toEqual(['source-reduction', 'last-write-wins']);
    expect(registry.resolve('last-write-wins').key).toBe('last-write-wins');
    expect(registry.resolve().key).toBe('source-reduction'); // default
  });

  it('the first registered strategy becomes the default when none is flagged', () => {
    const registry = new CustomValidityMergeRegistry();
    registry.define(new LastWriteWinsStrategy());
    expect(registry.resolve().key).toBe('last-write-wins');
  });

  it('throws on an unknown strategy rather than substituting silently', () => {
    const registry = createDefaultRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownStrategyError);
    expect(() => new CustomValidityMergeRegistry().resolve()).toThrow(UnknownStrategyError);
  });

  it('treats a custom strategy as first-class', () => {
    const allInvalid: CustomValidityMergeStrategy = {
      key: 'always-invalid',
      merge: (sources): MergedValidity => ({
        state: 'invalid',
        valid: false,
        pending: false,
        messages: sources.flatMap((s) => (s.message ? [{ source: s.source, message: s.message }] : [])),
        blocking: sources[0]?.source ?? 'custom',
        version: 0,
      }),
    };
    const registry = createDefaultRegistry();
    registry.define(allInvalid);
    expect(registry.resolve('always-invalid').merge([]).state).toBe('invalid');
  });
});

describe('ValiditySourceOrchestrator (auto-stamping)', () => {
  it('auto-stamps a monotonic generation token so devs never hand-author ids', () => {
    const orch = createDefaultOrchestrator();
    orch.set('native', { state: 'valid' }); // version 1
    const merged = orch.set('manual', { state: 'invalid', message: 'taken' }); // version 2
    expect(merged.state).toBe('invalid');
    expect(orch.sources().map((s) => s.version)).toEqual([1, 2]);
  });

  it('honours an explicit version for deliberate stale-control', () => {
    const orch = createDefaultOrchestrator();
    orch.set('async', { state: 'pending', version: 42 });
    expect(orch.sources()[0].version).toBe(42);
  });

  it('recomputes the merged validity as sources change and clear', () => {
    const orch = createDefaultOrchestrator();
    orch.set('native', { state: 'valid' });
    expect(orch.set('schema', { state: 'invalid', message: 'bad' }).state).toBe('invalid');
    expect(orch.clear('schema').state).toBe('valid'); // back to valid once the invalid source is gone
  });

  it('swaps strategy at runtime (scope re-resolution)', () => {
    const orch = createDefaultOrchestrator();
    orch.set('native', { state: 'invalid', message: 'required' }); // v1
    orch.set('async', { state: 'valid' }); // v2 — last write
    expect(orch.merged().state).toBe('invalid'); // source-reduction: any invalid fails
    orch.useStrategy(new LastWriteWinsStrategy());
    expect(orch.merged().state).toBe('valid'); // last-write-wins: async (v2) wins
  });

  it('enforces the surface contract at the merge boundary', () => {
    const rogue: CustomValidityMergeStrategy = {
      key: 'rogue',
      // valid/state disagree — a malformed surface that must not reach the view layer
      merge: () => ({ state: 'valid', valid: false, pending: false, messages: [], blocking: null, version: 0 }),
    };
    const orch = new ValiditySourceOrchestrator(rogue);
    expect(() => orch.merged()).toThrow(/surface contract/);
  });
});
