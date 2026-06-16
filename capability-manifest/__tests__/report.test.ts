/**
 * Validation adherence report format (#269). Verifies the four-bucket partition (honoured / unused /
 * out-of-capability), the headline conformance flag, the manifest-level Core defect line, and the
 * plain-text rendering — exercised against the shared #270 fixtures.
 */
import { describe, it, expect } from 'vitest';
import { CORE_FEATURES, type CapabilityManifest } from '../provider.js';
import { CAPABILITY_FIXTURES } from '../fixtures.js';
import { buildAdherenceReport, formatAdherenceReport, adherenceToReport } from '../report.js';
import { toSarif, toJUnit } from '../../blocks/adapters/report/exportReport.js';

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

describe('adherenceToReport — the #431 report-model view (slice D of #435; #712)', () => {
  const report = (manifest: CapabilityManifest, used: string[]) =>
    adherenceToReport(buildAdherenceReport(manifest, used as never));

  it('partitions the buckets as scores[] and carries spec/level/conformant on the source meta', () => {
    const manifest: CapabilityManifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L2',
      features: [...CORE_FEATURES, 'validation.feature.async'],
      concerns: {},
    };
    const r = report(manifest, ['validation.feature.control-validity', 'validation.feature.async', 'validation.feature.schema']);
    expect(r.id).toBe('capability-manifest-adherence');
    expect(r.sources[0].meta).toMatchObject({ specVersion: '1.0.0', conformanceLevel: 'L2', conformant: 'false' });
    const scores = Object.fromEntries(r.sections[0].scores!.map((s) => [s.id, s.value]));
    expect(scores).toMatchObject({ honoured: 2, outOfCapability: 1 });
    expect(r.sections[0].scores!.every((s) => s.unit === 'features')).toBe(true);
  });

  it('emits each out-of-capability usage and missing-Core feature as a finding (error / warn)', () => {
    const manifest = {
      specVersion: '1.0.0',
      conformanceLevel: 'L1',
      features: ['validation.feature.control-validity'],
      concerns: {},
    } as CapabilityManifest;
    const r = report(manifest, ['validation.feature.control-validity', 'validation.feature.async']);
    const findings = r.sections[0].findings!;
    expect(findings.some((f) => f.severity === 'error' && f.ruleId === 'out-of-capability')).toBe(true);
    expect(findings.some((f) => f.severity === 'warn' && f.ruleId === 'missing-core-feature')).toBe(true);
    expect(findings.every((f) => f.source === 'capability-manifest')).toBe(true);
  });

  it('is model-valid: pipes unchanged through the #434 SARIF/JUnit export adapters', () => {
    const manifest: CapabilityManifest = {
      specVersion: '1.0.0', conformanceLevel: 'L1', features: [...CORE_FEATURES], concerns: {},
    };
    const r = report(manifest, [...CORE_FEATURES, 'validation.feature.schema']);
    expect(toSarif(r).runs).toHaveLength(1);
    expect(() => toJUnit(r)).not.toThrow();
  });
});
