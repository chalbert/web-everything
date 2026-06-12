/**
 * Validation adherence report format (#269). Verifies the four-bucket partition (honoured / unused /
 * out-of-capability), the headline conformance flag, the manifest-level Core defect line, and the
 * plain-text rendering — exercised against the shared #270 fixtures.
 */
import { describe, it, expect } from 'vitest';
import { CORE_FEATURES, type CapabilityManifest } from '../provider.js';
import { CAPABILITY_FIXTURES } from '../fixtures.js';
import { buildAdherenceReport, formatAdherenceReport } from '../report.js';

describe('buildAdherenceReport', () => {
  it('partitions declared/used into honoured, unused, and out-of-capability', () => {
    const manifest: CapabilityManifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L2',
      features: [...CORE_FEATURES, 'validation.feature.async'],
      concerns: {},
    };
    // Uses Core control-validity + async (both declared) + schema (not declared).
    const report = buildAdherenceReport(manifest, [
      'validation.feature.control-validity',
      'validation.feature.async',
      'validation.feature.schema',
    ]);

    expect(report.honoured).toEqual(['validation.feature.control-validity', 'validation.feature.async']);
    expect(report.unused).toEqual([
      'validation.feature.interaction',
      'validation.feature.display',
      'validation.feature.native-source',
    ]);
    expect(report.outOfCapability).toEqual(['validation.feature.schema']);
    expect(report.conformant).toBe(false);
    expect(report.missingCore).toEqual([]);
  });

  it('flags a manifest-level Core defect (L1+ missing a Core feature)', () => {
    const manifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L1',
      features: ['validation.feature.control-validity'], // missing 3 Core ids
      concerns: {},
    } as CapabilityManifest;
    const report = buildAdherenceReport(manifest, ['validation.feature.control-validity']);
    expect(report.missingCore).toEqual([
      'validation.feature.interaction',
      'validation.feature.display',
      'validation.feature.native-source',
    ]);
  });

  it('conformant=true and empty out-of-capability when usage stays within declared', () => {
    const manifest: CapabilityManifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: {},
    };
    const report = buildAdherenceReport(manifest, [...CORE_FEATURES]);
    expect(report.conformant).toBe(true);
    expect(report.outOfCapability).toEqual([]);
    expect(report.honoured).toEqual([...CORE_FEATURES]);
    expect(report.unused).toEqual([]);
  });

  it('report.outOfCapability matches each #270 fixture’s pinned diff', () => {
    for (const f of CAPABILITY_FIXTURES) {
      const report = buildAdherenceReport(f.manifest, f.usedFeatures);
      expect(report.outOfCapability, f.name).toEqual(f.expectedOutOfCapability);
      expect(report.conformant, f.name).toBe(f.expectedOutOfCapability.length === 0);
    }
  });
});

describe('formatAdherenceReport', () => {
  it('renders a conformant report with the in-capability headline', () => {
    const manifest: CapabilityManifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L1',
      features: [...CORE_FEATURES],
      concerns: {},
    };
    const text = formatAdherenceReport(buildAdherenceReport(manifest, [...CORE_FEATURES]));
    expect(text).toContain('✓ in capability');
    expect(text).toContain('L1 @ spec 1.0.0');
  });

  it('renders out-of-capability usage and the Core-defect warning', () => {
    const manifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L1',
      features: ['validation.feature.control-validity'],
      concerns: {},
    } as CapabilityManifest;
    const text = formatAdherenceReport(
      buildAdherenceReport(manifest, ['validation.feature.control-validity', 'validation.feature.async']),
    );
    expect(text).toContain('✗ 1 feature(s) out of capability');
    expect(text).toContain('out of capability (used, not declared): async');
    expect(text).toContain('missing Core feature(s)');
  });
});
