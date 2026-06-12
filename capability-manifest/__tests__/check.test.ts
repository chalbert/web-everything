/**
 * Build-time `check:validation-adherence` (#267) — tests for the aggregation + pass/fail decision, and
 * the build gate itself. The pure diff (#270 `outOfCapability`) and the report (#269) are covered by
 * their own suites; here we pin that {@link runAdherenceCheck} turns those into the right findings and
 * that the shipped-implementation gate ({@link IMPLEMENTATION_MANIFESTS}) is green.
 *
 * This file is what `npm run check:validation-adherence` runs (the only TS-executing tool in the
 * toolchain is vitest — Node 22.1 cannot run a `.ts` CLI and re-implementing the model in `.mjs` would
 * fork the contract), so a red gate here fails the build exactly as the build-time check requires.
 */

import { describe, it, expect } from 'vitest';
import {
  runAdherenceCheck,
  formatCheckResult,
  IMPLEMENTATION_MANIFESTS,
  type AdherenceInput,
} from '../check.js';
import { CAPABILITY_FIXTURES, INVALID_MANIFEST_FIXTURES } from '../fixtures.js';

describe('runAdherenceCheck — over the #270 partial-implementation fixtures', () => {
  const inputs: AdherenceInput[] = CAPABILITY_FIXTURES.map((f) => ({
    name: f.name,
    manifest: f.manifest,
    usedFeatures: f.usedFeatures,
  }));
  const result = runAdherenceCheck(inputs);

  it('checks every fixture and produces a report for each (all manifests are contract-valid)', () => {
    expect(result.checked).toBe(CAPABILITY_FIXTURES.length);
    expect(result.reports).toHaveLength(CAPABILITY_FIXTURES.length);
  });

  it('flags exactly the out-of-capability fixtures, with the pinned features', () => {
    for (const f of CAPABILITY_FIXTURES) {
      const finding = result.findings.find((x) => x.name === f.name);
      if (f.expectedOutOfCapability.length === 0) {
        expect(finding, `${f.name} should be in capability`).toBeUndefined();
      } else {
        expect(finding, `${f.name} should be flagged`).toBeDefined();
        expect(finding!.kind).toBe('out-of-capability');
        expect(finding!.features).toEqual(f.expectedOutOfCapability);
      }
    }
  });

  it('is conformant iff no fixture used a feature out of capability', () => {
    const anyOutOf = CAPABILITY_FIXTURES.some((f) => f.expectedOutOfCapability.length > 0);
    expect(result.ok).toBe(!anyOutOf);
  });
});

describe('runAdherenceCheck — over the invalid-manifest fixtures', () => {
  const inputs: AdherenceInput[] = INVALID_MANIFEST_FIXTURES.map((f) => ({
    name: f.name,
    manifest: f.value,
    usedFeatures: [],
  }));
  const result = runAdherenceCheck(inputs);

  it('records a malformed-manifest finding for each and no report (cannot diff an invalid manifest)', () => {
    expect(result.reports).toHaveLength(0);
    expect(result.findings).toHaveLength(INVALID_MANIFEST_FIXTURES.length);
    expect(result.findings.every((x) => x.kind === 'malformed-manifest')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('treats an L1+ claim missing a Core feature as malformed (OP-18, via assertCapabilityManifest)', () => {
    const finding = result.findings.find((x) => x.name === 'l1-missing-core-feature');
    expect(finding?.kind).toBe('malformed-manifest');
  });
});

describe('formatCheckResult', () => {
  it('renders a pass headline for a clean result', () => {
    const out = formatCheckResult(runAdherenceCheck([]));
    expect(out).toContain('✓ validation adherence');
  });

  it('renders findings for an out-of-capability result', () => {
    const offender = CAPABILITY_FIXTURES.find((f) => f.expectedOutOfCapability.length > 0)!;
    const out = formatCheckResult(
      runAdherenceCheck([{ name: offender.name, manifest: offender.manifest, usedFeatures: offender.usedFeatures }]),
    );
    expect(out).toContain('✗ validation adherence');
    expect(out).toContain('Findings:');
    expect(out).toContain('out-of-capability');
  });
});

describe('build gate — shipped implementation manifests must adhere', () => {
  it('IMPLEMENTATION_MANIFESTS is in capability (the fail-the-build assertion)', () => {
    const result = runAdherenceCheck(IMPLEMENTATION_MANIFESTS);
    // Print the readable report so `npm run check:validation-adherence` surfaces the gate's verdict.
    // eslint-disable-next-line no-console
    console.log(formatCheckResult(result));
    expect(result.ok, formatCheckResult(result)).toBe(true);
  });
});
