/**
 * Capability-manifest model — the #266 DoD: the `CapabilityManifest` schema validates, the Core set
 * (#266 OP-18) is enforced at L1+, the static-export convention (#266 OP-19) is named, and the semver
 * scheme over the vocabulary compares and gates feature availability.
 */
import { describe, it, expect } from 'vitest';
import {
  CORE_FEATURES,
  OPTIONAL_FEATURES,
  ALL_FEATURES,
  FEATURE_SINCE,
  VALIDATION_SPEC_VERSION,
  MANIFEST_EXPORT_NAME,
  ManifestContractError,
  parseSpecVersion,
  compareSpecVersions,
  featureAvailableIn,
  manifestSupports,
  missingCoreFeatures,
  isCapabilityManifest,
  assertCapabilityManifest,
  type CapabilityManifest,
} from '../provider.js';

const manifest = (over: Partial<CapabilityManifest> = {}): CapabilityManifest => ({
  specVersion: VALIDATION_SPEC_VERSION,
  conformanceLevel: 'L1',
  features: [...CORE_FEATURES],
  concerns: {},
  ...over,
});

describe('vocabulary', () => {
  it('Core + optional partition the closed feature set with no overlap', () => {
    expect(ALL_FEATURES).toEqual([...CORE_FEATURES, ...OPTIONAL_FEATURES]);
    const overlap = CORE_FEATURES.filter((f) => OPTIONAL_FEATURES.includes(f));
    expect(overlap).toEqual([]);
  });

  it('OP-18 Core set is exactly the four mandatory features', () => {
    expect([...CORE_FEATURES]).toEqual([
      'validation.feature.control-validity',
      'validation.feature.interaction',
      'validation.feature.display',
      'validation.feature.native-source',
    ]);
  });

  it('every feature id has a since version', () => {
    for (const f of ALL_FEATURES) expect(FEATURE_SINCE[f]).toBeDefined();
  });

  it('OP-19 names the static export convention', () => {
    expect(MANIFEST_EXPORT_NAME).toBe('manifest');
  });
});

describe('semver scheme', () => {
  it('parses the MAJOR.MINOR.PATCH core, ignoring pre-release / build metadata', () => {
    expect(parseSpecVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSpecVersion('2.0.0-rc.1')).toEqual([2, 0, 0]);
    expect(parseSpecVersion('1.4.0+abc')).toEqual([1, 4, 0]);
  });

  it('throws on a malformed version', () => {
    expect(() => parseSpecVersion('1.2')).toThrow(ManifestContractError);
    expect(() => parseSpecVersion('1.x.0')).toThrow(ManifestContractError);
  });

  it('compares by precedence across each segment', () => {
    expect(compareSpecVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareSpecVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(compareSpecVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareSpecVersions('1.0.1', '1.0.0')).toBe(1);
  });

  it('gates feature availability on the since version', () => {
    expect(featureAvailableIn('validation.feature.async', '1.0.0')).toBe(true);
    expect(featureAvailableIn('validation.feature.async', '0.9.0')).toBe(false);
  });
});

describe('isCapabilityManifest', () => {
  it('accepts a conformant manifest', () => {
    expect(isCapabilityManifest(manifest())).toBe(true);
  });

  it('rejects unknown feature ids, bad levels, and non-object concerns', () => {
    expect(isCapabilityManifest(manifest({ features: ['validation.feature.bogus'] as never }))).toBe(false);
    expect(isCapabilityManifest(manifest({ conformanceLevel: 'L3' as never }))).toBe(false);
    expect(isCapabilityManifest(manifest({ concerns: ['x'] as never }))).toBe(false);
    expect(isCapabilityManifest(null)).toBe(false);
  });
});

describe('assertCapabilityManifest (OP-18 Core enforcement)', () => {
  it('returns a conformant L1 manifest carrying every Core feature', () => {
    const m = manifest();
    expect(assertCapabilityManifest(m)).toBe(m);
    expect(missingCoreFeatures(m)).toEqual([]);
  });

  it('rejects an L1 claim that omits a Core feature', () => {
    const m = manifest({ features: [...OPTIONAL_FEATURES] });
    expect(missingCoreFeatures(m)).toEqual([...CORE_FEATURES]);
    expect(() => assertCapabilityManifest(m)).toThrow(/Core features missing/);
  });

  it('allows an L0 manifest to omit Core features', () => {
    expect(() => assertCapabilityManifest(manifest({ conformanceLevel: 'L0', features: [] }))).not.toThrow();
  });

  it('reports declared optional support via manifestSupports', () => {
    const m = manifest({ features: [...CORE_FEATURES, 'validation.feature.async'] });
    expect(manifestSupports(m, 'validation.feature.async')).toBe(true);
    expect(manifestSupports(m, 'validation.feature.schema')).toBe(false);
  });

  it('rejects a malformed specVersion even when otherwise structural', () => {
    expect(() => assertCapabilityManifest(manifest({ specVersion: '1.0' }))).toThrow(ManifestContractError);
  });
});
