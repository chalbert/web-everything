/**
 * Partial-implementation conformance fixtures (#270) — the shared base must be internally consistent
 * so the downstream slices (#267/#268/#269) can trust it as ground truth:
 *  - every valid fixture's manifest passes `assertCapabilityManifest`;
 *  - each fixture's pinned `expectedOutOfCapability` equals the computed `outOfCapability` diff;
 *  - every invalid fixture is genuinely rejected by `assertCapabilityManifest`;
 *  - the set actually covers both in-capability and out-of-capability shapes (no all-green base).
 */
import { describe, it, expect } from 'vitest';
import { assertCapabilityManifest, ManifestContractError } from '../provider.js';
import {
  CAPABILITY_FIXTURES,
  INVALID_MANIFEST_FIXTURES,
  outOfCapability,
} from '../fixtures.js';

describe('valid capability fixtures', () => {
  it('every fixture carries a contract-valid manifest', () => {
    for (const f of CAPABILITY_FIXTURES) {
      expect(() => assertCapabilityManifest(f.manifest), f.name).not.toThrow();
    }
  });

  it('pinned expectedOutOfCapability matches the computed used − declared diff', () => {
    for (const f of CAPABILITY_FIXTURES) {
      expect(outOfCapability(f.manifest, f.usedFeatures), f.name).toEqual(f.expectedOutOfCapability);
    }
  });

  it('the base covers both in-capability and out-of-capability scenarios', () => {
    const inCapability = CAPABILITY_FIXTURES.filter((f) => f.expectedOutOfCapability.length === 0);
    const outOf = CAPABILITY_FIXTURES.filter((f) => f.expectedOutOfCapability.length > 0);
    expect(inCapability.length).toBeGreaterThan(0);
    expect(outOf.length).toBeGreaterThan(0);
  });

  it('fixture names are unique', () => {
    const names = CAPABILITY_FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('invalid manifest fixtures', () => {
  it('every fixture is rejected by assertCapabilityManifest with a ManifestContractError', () => {
    for (const f of INVALID_MANIFEST_FIXTURES) {
      expect(() => assertCapabilityManifest(f.value), f.name).toThrow(ManifestContractError);
    }
  });

  it('fixture names are unique', () => {
    const names = INVALID_MANIFEST_FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
