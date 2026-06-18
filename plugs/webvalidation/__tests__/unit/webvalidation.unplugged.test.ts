/**
 * Unplugged-mode (non-invasive) test for webvalidation — #726 / #636 backfill (the #951 hand-off scope).
 *
 * Proves the runtime validity-merge (#215) and validator-resolution (#224) plugs work as opt-in
 * libraries through plain instantiation, WITHOUT any global patch — importing `webvalidation` installs
 * nothing (the module only logs on load; the registries are plain `CustomRegistry` instances and the
 * strategies/resolutions are pure). The non-invasive proof: each default registry resolves its
 * native-first default by key, and two scoped registries stay fully independent (no shared global
 * state). The unplugged form is the mandatory real-app surface (#606); this is the automated proof the
 * plug does not REQUIRE plugged mode.
 */
import { describe, it, expect } from 'vitest';
import CustomValidityMergeRegistry, {
  createDefaultValidityMergeRegistry,
} from '../../CustomValidityMergeRegistry';
import CustomValidatorResolutionRegistry, {
  createDefaultValidatorResolutionRegistry,
} from '../../CustomValidatorResolutionRegistry';
import { SourceReductionStrategy, LastWriteWinsStrategy } from '../../../../validity-merge/provider.js';
import { CancellationResolution } from '../../../../validator-resolution/provider.js';

describe('webvalidation — unplugged (non-invasive) mode', () => {
  describe('validity-merge plug (#215)', () => {
    it('resolves the native-first default strategy through a standalone default registry', () => {
      const registry = createDefaultValidityMergeRegistry();
      expect(registry.localName).toBe('customValidityMerge');
      expect(registry.defaultKey).toBe('source-reduction');
      expect(registry.resolve().key).toBe('source-reduction');
    });

    it('keeps two scoped merge registries independent (no shared global state)', () => {
      const registryA = new CustomValidityMergeRegistry();
      const registryB = new CustomValidityMergeRegistry();
      registryA.define(new SourceReductionStrategy(), true);
      registryB.define(new LastWriteWinsStrategy(), true);

      expect(registryA.resolve().key).toBe('source-reduction');
      expect(registryB.resolve().key).toBe('last-write-wins');
      expect(registryA.has('last-write-wins')).toBe(false);
      expect(registryB.has('source-reduction')).toBe(false);
    });
  });

  describe('validator-resolution plug (#224)', () => {
    it('resolves the native-first default resolution through a standalone default registry', () => {
      const registry = createDefaultValidatorResolutionRegistry();
      expect(registry.localName).toBe('customValidatorResolution');
      expect(registry.defaultKey).toBe('versioning');
      expect(registry.resolve().key).toBe('versioning');
      expect(registry.resolve('cancellation').key).toBe('cancellation');
    });

    it('keeps two scoped resolution registries independent (no shared global state)', () => {
      const registryA = new CustomValidatorResolutionRegistry();
      const registryB = new CustomValidatorResolutionRegistry();
      registryA.define(new CancellationResolution(), true);

      expect(registryA.resolve().key).toBe('cancellation');
      expect(registryB.has('cancellation')).toBe(false);
    });
  });
});
