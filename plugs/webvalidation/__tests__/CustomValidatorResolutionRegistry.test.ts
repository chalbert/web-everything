/**
 * Runtime `customValidatorResolution` registry (#224): the live plug fulfils the same
 * `define`/`resolve` surface as the standalone model (#214), but as a core `CustomRegistry` so it is
 * injector-chain-resolvable and inheritable via `extends` — the async sibling of #215's merge registry.
 */
import { describe, it, expect } from 'vitest';
import CustomValidatorResolutionRegistry, {
  createDefaultValidatorResolutionRegistry,
} from '../CustomValidatorResolutionRegistry';
import {
  VersioningResolution,
  CancellationResolution,
  type CustomValidatorResolution,
  type ValidationHandle,
  type AsyncResult,
} from '../../../validator-resolution/provider.js';
import { UnknownResolutionError } from '../../../validator-resolution/registry.js';

describe('CustomValidatorResolutionRegistry', () => {
  it('is a core CustomRegistry with the customValidatorResolution localName', () => {
    const registry = new CustomValidatorResolutionRegistry();
    expect(registry.localName).toBe('customValidatorResolution');
    expect(typeof registry.has).toBe('function');
    expect(typeof registry.keys).toBe('function');
  });

  it('define(strategy) keys by the strategy.key and marks the first as default', () => {
    const registry = new CustomValidatorResolutionRegistry();
    registry.define(new VersioningResolution());
    expect(registry.has('versioning')).toBe(true);
    expect(registry.defaultKey).toBe('versioning');
    expect(registry.resolve().key).toBe('versioning');
  });

  it('define(strategy, asDefault=true) overrides the default even when not first', () => {
    const registry = new CustomValidatorResolutionRegistry();
    registry.define(new VersioningResolution());
    registry.define(new CancellationResolution(), true);
    expect(registry.defaultKey).toBe('cancellation');
    expect(registry.resolve().key).toBe('cancellation');
  });

  it('resolve(key) returns the named strategy', () => {
    const registry = createDefaultValidatorResolutionRegistry();
    expect(registry.resolve('versioning').key).toBe('versioning');
    expect(registry.resolve('cancellation').key).toBe('cancellation');
  });

  it('resolve throws UnknownResolutionError for an unregistered name', () => {
    const registry = createDefaultValidatorResolutionRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownResolutionError);
  });

  it('resolve() throws when nothing is registered (no default)', () => {
    const registry = new CustomValidatorResolutionRegistry();
    expect(() => registry.resolve()).toThrow(UnknownResolutionError);
  });

  it('custom strategies are first-class — registered and resolved like the shipped ones', () => {
    const registry = createDefaultValidatorResolutionRegistry();
    const alwaysCurrent: CustomValidatorResolution = {
      key: 'always-current',
      startValidation(fieldId: string, input: unknown): ValidationHandle {
        return { fieldId, version: 1, input };
      },
      shouldApplyResult(_handle: ValidationHandle, _result: AsyncResult): boolean {
        return true;
      },
      onInputChange(): void {},
    };
    registry.define(alwaysCurrent);
    expect(registry.resolve('always-current')).toBe(alwaysCurrent);
  });

  it('createDefaultValidatorResolutionRegistry ships both strategies, versioning default', () => {
    const registry = createDefaultValidatorResolutionRegistry();
    expect([...registry.keys()].sort()).toEqual(['cancellation', 'versioning']);
    expect(registry.defaultKey).toBe('versioning');
  });

  it('is inheritable — a child registry resolves a parent-registered strategy (scope cascade)', () => {
    const parent = createDefaultValidatorResolutionRegistry();
    const child = new CustomValidatorResolutionRegistry({ extends: [parent] });
    expect(child.has('versioning')).toBe(true);
    child.define(new CancellationResolution(), true);
    expect(child.defaultKey).toBe('cancellation');
    expect(parent.defaultKey).toBe('versioning');
  });
});
