/**
 * Runtime `customCommitmentPolicy` registry (#1113): the live plug fulfils the same define/resolve surface
 * as the standalone commitment-policy model (#1112), but as a core CustomRegistry so it is
 * injector-chain-resolvable and inheritable via `extends` — the sibling of the validator-resolution and
 * validity-merge registries.
 */
import { describe, it, expect } from 'vitest';
import CustomCommitmentPolicyRegistry, {
  createDefaultCommitmentPolicyRegistry,
} from '../CustomCommitmentPolicyRegistry';
import {
  FullCommitmentPolicy,
  DeferredCommitmentPolicy,
} from '../../../commitment-policy/index.js';
import { UnknownCommitmentPolicyError } from '../../../commitment-policy/registry.js';

describe('CustomCommitmentPolicyRegistry (#1113)', () => {
  it('is a core CustomRegistry with the customCommitmentPolicy localName', () => {
    const registry = new CustomCommitmentPolicyRegistry();
    expect(registry.localName).toBe('customCommitmentPolicy');
    expect(typeof registry.has).toBe('function');
    expect(typeof registry.keys).toBe('function');
  });

  it('define(policy) keys by the policy.key and marks the first as default', () => {
    const registry = new CustomCommitmentPolicyRegistry();
    registry.define(new FullCommitmentPolicy());
    expect(registry.has('full')).toBe(true);
    expect(registry.defaultKey).toBe('full');
  });

  it('resolve(key) returns the named policy; resolve() returns the default', () => {
    const registry = new CustomCommitmentPolicyRegistry();
    registry.define(new FullCommitmentPolicy(), true);
    registry.define(new DeferredCommitmentPolicy());
    expect(registry.resolve('deferred').key).toBe('deferred');
    expect(registry.resolve().key).toBe('full');
  });

  it('throws UnknownCommitmentPolicyError for an unregistered key — never silently substitutes', () => {
    const registry = createDefaultCommitmentPolicyRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownCommitmentPolicyError);
  });

  it('rejects a malformed policy (identity guard)', () => {
    const registry = new CustomCommitmentPolicyRegistry();
    expect(() => registry.define({ key: '' } as any)).toThrow();
  });

  it('createDefaultCommitmentPolicyRegistry preloads full (default) + deferred', () => {
    const registry = createDefaultCommitmentPolicyRegistry();
    expect(registry.defaultKey).toBe('full');
    expect(registry.has('full')).toBe(true);
    expect(registry.has('deferred')).toBe(true);
  });
});
