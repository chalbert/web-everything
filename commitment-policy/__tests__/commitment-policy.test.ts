/**
 * Unit test for the commitment-policy model (#1112, webvalidation completion #1090).
 *
 * Pure model, no DOM: the built-in `full` commits on every input while `deferred` buffers until
 * blur/submit/explicit; the staleness observables (generation/timestamp/sync) track input; and the
 * registry register/getProvider surface (mirroring CustomValidityMergeRegistry) resolves + defaults.
 */
import { describe, it, expect } from 'vitest';
import {
  FullCommitmentPolicy,
  DeferredCommitmentPolicy,
  CustomCommitmentPolicyRegistry,
  createDefaultCommitmentPolicyRegistry,
  UnknownCommitmentPolicyError,
  type CommitContext,
  type CommitEvent,
} from '../index';
import type { MergedValidity } from '../../validity-merge/contract.js';
import type { InteractionState } from '../../interaction-state/model.js';

const interaction: InteractionState = { dirty: true, touched: true, focused: false, submitted: false };
const validity: MergedValidity = { state: 'valid' };

function ctx(event: CommitEvent, over: Partial<CommitContext> = {}): CommitContext {
  return {
    fieldId: 'email',
    event,
    value: 'x',
    validity,
    interaction,
    submitted: false,
    validationPending: false,
    ...over,
  };
}

describe('FullCommitmentPolicy (full)', () => {
  it('commits on every event, including input', () => {
    const p = new FullCommitmentPolicy();
    for (const e of ['input', 'blur', 'submit', 'explicit'] as CommitEvent[]) {
      expect(p.shouldCommit('email', 'x', ctx(e))).toBe(true);
    }
  });
});

describe('DeferredCommitmentPolicy (deferred)', () => {
  it('buffers on input, commits on blur/submit/explicit', () => {
    const p = new DeferredCommitmentPolicy();
    expect(p.shouldCommit('email', 'x', ctx('input'))).toBe(false);
    expect(p.shouldCommit('email', 'x', ctx('blur'))).toBe(true);
    expect(p.shouldCommit('email', 'x', ctx('submit'))).toBe(true);
    expect(p.shouldCommit('email', 'x', ctx('explicit'))).toBe(true);
  });
});

describe('staleness observables', () => {
  it('onValueInput bumps generation, stamps timestamp, and marks the field stale', () => {
    let t = 0;
    const p = new FullCommitmentPolicy(() => `2026-06-19T00:00:0${t}.000Z`);
    expect(p.getValidationGeneration('email')).toBe(0);
    t = 1;
    expect(p.onValueInput('email', 'a')).toBe(1);
    expect(p.getValidationSync('email')).toBe('stale');
    expect(p.getValidationTimestamp('email')).toBe('2026-06-19T00:00:01.000Z');
    t = 2;
    expect(p.onValueInput('email', 'ab')).toBe(2);
  });

  it('a commit decision with settled validation marks the field current again', () => {
    const p = new DeferredCommitmentPolicy();
    p.onValueInput('email', 'a');
    expect(p.getValidationSync('email')).toBe('stale');
    p.shouldCommit('email', 'a', ctx('blur', { validationPending: false }));
    expect(p.getValidationSync('email')).toBe('current');
  });

  it('dispose clears per-field bookkeeping', () => {
    const p = new FullCommitmentPolicy();
    p.onValueInput('email', 'a');
    p.dispose('email');
    expect(p.getValidationGeneration('email')).toBe(0); // fresh state
  });
});

describe('CustomCommitmentPolicyRegistry', () => {
  it('register + getProvider resolves by name and falls back to the default', () => {
    const registry = new CustomCommitmentPolicyRegistry();
    const full = new FullCommitmentPolicy();
    const deferred = new DeferredCommitmentPolicy();
    registry.register('full', full, true);
    registry.register('deferred', deferred);
    expect(registry.getProvider('deferred')).toBe(deferred);
    expect(registry.getProvider()).toBe(full); // default
    expect(registry.defaultKey).toBe('full');
    expect(registry.keys()).toEqual(['full', 'deferred']);
  });

  it('rejects a name/key mismatch and an unknown lookup', () => {
    const registry = new CustomCommitmentPolicyRegistry();
    expect(() => registry.register('eager', new FullCommitmentPolicy())).toThrow(/name and key must agree/);
    expect(() => registry.getProvider('nope')).toThrow(UnknownCommitmentPolicyError);
  });

  it('createDefault is pre-loaded with full (default) + deferred', () => {
    const registry = createDefaultCommitmentPolicyRegistry();
    expect(registry.getProvider().key).toBe('full');
    expect(registry.has('deferred')).toBe(true);
  });
});
