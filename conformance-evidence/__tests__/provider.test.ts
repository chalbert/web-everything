/**
 * Conformance-evidence manifest contract (#599, the #578 Fork 2-A DoD): the manifest carries which-gates-
 * ran + verify before/after + autonomy level; the builder stamps the spec version; isConformanceImproved
 * is the propose-and-verify success signal (failing→green); the validator catches a malformed manifest a
 * consuming tool must not trust.
 */
import { describe, it, expect } from 'vitest';
import {
  CONFORMANCE_EVIDENCE_SPEC_VERSION,
  AUTONOMY_LEVELS,
  buildConformanceEvidence,
  isConformanceImproved,
  validateConformanceEvidence,
  type ConformanceEvidenceInput,
  type ConformanceEvidenceManifest,
} from '../provider.js';

const input = (over: Partial<ConformanceEvidenceInput> = {}): ConformanceEvidenceInput => ({
  subject: { app: 'loan-app', impl: 'base-select', commit: 'abc123' },
  gates: [{ gate: 'check:standards', passed: true, detail: '0 errors' }],
  verify: { before: { passed: false, summary: '3 errors' }, after: { passed: true, summary: '0 errors' } },
  autonomy: 'open-pr',
  ...over,
});

describe('buildConformanceEvidence', () => {
  it('stamps the current spec version and carries the three evidence facts', () => {
    const m = buildConformanceEvidence(input());
    expect(m.specVersion).toBe(CONFORMANCE_EVIDENCE_SPEC_VERSION);
    expect(m.gates).toHaveLength(1);
    expect(m.verify.before.passed).toBe(false);
    expect(m.autonomy).toBe('open-pr');
  });

  it('omits emittedAt unless the caller stamps it (Date-free contract)', () => {
    expect(buildConformanceEvidence(input())).not.toHaveProperty('emittedAt');
    expect(buildConformanceEvidence(input({ emittedAt: '2026-06-14T00:00:00.000Z' })).emittedAt).toBe('2026-06-14T00:00:00.000Z');
  });
});

describe('isConformanceImproved — the propose-and-verify signal', () => {
  it('is true only when before failed and after passed', () => {
    expect(isConformanceImproved(buildConformanceEvidence(input()))).toBe(true);
  });

  it('is false when after is still failing (the verify moat blocks it)', () => {
    expect(isConformanceImproved(buildConformanceEvidence(input({ verify: { before: { passed: false }, after: { passed: false } } })))).toBe(false);
  });

  it('is false when there was nothing to fix (before already passed)', () => {
    expect(isConformanceImproved(buildConformanceEvidence(input({ verify: { before: { passed: true }, after: { passed: true } } })))).toBe(false);
  });
});

describe('validateConformanceEvidence', () => {
  it('accepts a well-formed manifest', () => {
    expect(validateConformanceEvidence(buildConformanceEvidence(input()))).toEqual({ valid: true, errors: [] });
  });

  it('rejects an unknown spec version, missing subject, no gates, and a bad autonomy level', () => {
    const bad = {
      specVersion: '9.9.9',
      subject: { app: '' },
      gates: [],
      verify: { before: { passed: false }, after: { passed: true } },
      autonomy: 'yolo',
    } as unknown as ConformanceEvidenceManifest;
    const r = validateConformanceEvidence(bad);
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual([
      expect.stringContaining('unknown specVersion'),
      'subject.app is required',
      'at least one gate run is required',
      expect.stringContaining('unknown autonomy level'),
    ]);
  });

  it('flags a missing verify side', () => {
    const m = { ...buildConformanceEvidence(input()), verify: { before: { passed: false } } } as unknown as ConformanceEvidenceManifest;
    expect(validateConformanceEvidence(m).errors).toContain('verify.before and verify.after are required');
  });
});

describe('AUTONOMY_LEVELS', () => {
  it('is the #141 ladder in escalating order', () => {
    expect(AUTONOMY_LEVELS).toEqual(['suggest', 'open-pr', 'auto-merge']);
  });
});
