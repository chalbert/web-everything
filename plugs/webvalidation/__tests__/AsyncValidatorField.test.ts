/**
 * `<async-validator-field>` (#224): the async driver resolves a `customValidatorResolution` strategy
 * per-scope, runs an async validator under it, and feeds the **surviving** answer into a target merge
 * field's `async` source — emitting the cross-plane `pending{version}` → `valid|invalid` contract.
 *
 * These are the runtime-conformance peers of #215's: versioning drops a superseded generation;
 * cancellation aborts the in-flight request; the emitted source conforms to the contract. The target
 * merge field is a recording stub (the real `<validity-merge-field>` is proven in its own suite).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import AsyncValidatorField, { type AsyncSourceTarget } from '../AsyncValidatorField';
import { createDefaultValidatorResolutionRegistry } from '../CustomValidatorResolutionRegistry';
import type { SourceUpdate } from '../../../validity-merge/registry.js';
import type { AsyncResult } from '../../../validator-resolution/provider.js';

beforeAll(() => {
  if (!customElements.get('async-validator-field')) {
    customElements.define('async-validator-field', AsyncValidatorField);
  }
});

beforeEach(() => {
  window.customValidatorResolution = createDefaultValidatorResolutionRegistry();
});

/** A recording stand-in for the target merge field's `async` source sink. */
function makeTarget(): AsyncSourceTarget & { calls: Array<[string, SourceUpdate]> } {
  const calls: Array<[string, SourceUpdate]> = [];
  return {
    calls,
    setSource(source: string, update: SourceUpdate) {
      calls.push([source, update]);
      return update;
    },
    clearSource() {
      return undefined;
    },
  };
}

function makeField(strategy?: string): AsyncValidatorField {
  const el = document.createElement('async-validator-field') as AsyncValidatorField;
  if (strategy) el.setAttribute('strategy', strategy);
  return el;
}

/** A validator whose resolution is controlled by the test (records each call's resolve + signal). */
function deferredValidator() {
  const pending: Array<{ resolve: (r: AsyncResult) => void; reject: (e: unknown) => void; signal?: AbortSignal }> = [];
  const validator = (_input: unknown, signal?: AbortSignal): Promise<AsyncResult> =>
    new Promise<AsyncResult>((resolve, reject) => {
      pending.push({ resolve, reject, signal });
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  return { validator, pending };
}

describe('<async-validator-field> (#224)', () => {
  it('emits pending then the terminal source into the target async source (cross-plane contract)', async () => {
    const target = makeTarget();
    const el = makeField();
    el.useTargetField(target);
    const { validator, pending } = deferredValidator();
    el.useValidator(validator);

    const p = el.validate('foo@bar.com');
    expect(target.calls.at(-1)).toEqual(['async', { state: 'pending', message: undefined, version: 1 }]);

    pending[0].resolve({ state: 'valid' });
    const result = await p;
    expect(result?.state).toBe('valid');
    expect(target.calls.at(-1)).toEqual(['async', { state: 'valid', message: undefined, version: 1 }]);
  });

  it('versioning drops a superseded generation — a stale answer never reaches the field', async () => {
    const target = makeTarget();
    const el = makeField(); // versioning is the default
    el.useTargetField(target);
    const { validator, pending } = deferredValidator();
    el.useValidator(validator);

    const p1 = el.validate('a'); // generation 1
    const p2 = el.validate('b'); // generation 2 — supersedes 1

    pending[0].resolve({ state: 'valid' }); // the stale gen-1 answer — must be dropped
    pending[1].resolve({ state: 'invalid', message: 'taken' }); // gen-2 — current

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeNull(); // superseded
    expect(r2?.state).toBe('invalid');
    // the field only ever saw the current terminal answer; the stale `valid` was never emitted
    expect(target.calls.at(-1)).toEqual(['async', { state: 'invalid', message: 'taken', version: 2 }]);
    expect(target.calls.some(([, u]) => u.state === 'valid')).toBe(false);
  });

  it('cancellation aborts the in-flight request and drops its answer', async () => {
    const target = makeTarget();
    const el = makeField('cancellation');
    el.useTargetField(target);
    const { validator, pending } = deferredValidator();
    el.useValidator(validator);

    const p1 = el.validate('a'); // controller 1
    const p2 = el.validate('b'); // aborts controller 1, opens controller 2

    expect(pending[0].signal?.aborted).toBe(true); // the first request's signal was torn down
    const r1 = await p1;
    expect(r1).toBeNull(); // aborted → dropped, not a failure

    pending[1].resolve({ state: 'valid' });
    const r2 = await p2;
    expect(r2?.state).toBe('valid');
  });

  it('useStrategy swaps the resolution policy by name', () => {
    const el = makeField();
    el.useStrategy('cancellation');
    expect(el.getAttribute('strategy')).toBe('cancellation');
    el.useStrategy(); // back to the default
    expect(el.hasAttribute('strategy')).toBe(false);
  });

  it('throws a clear error when no registry is in scope or on window', () => {
    delete (window as { customValidatorResolution?: unknown }).customValidatorResolution;
    const el = makeField();
    el.useValidator(async () => ({ state: 'valid' }));
    expect(() => el.validate('x')).toThrow(/no customValidatorResolution registry/);
  });

  it('throws when validate is called with no validator assigned', () => {
    const el = makeField();
    el.useTargetField(makeTarget());
    expect(() => el.validate('x')).toThrow(/no validator assigned/);
  });
});
