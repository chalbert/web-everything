/**
 * @file scripts/__tests__/credibility-weighting.test.mjs
 * @description Pins the WE credibility-weighting meta-schema + computation function (#1591, graduating the
 * ratified #1588 ruling). Verifies the three ruled axes: (1) admission ⟂ weight two-stage, (2) GRADE-shaped
 * weight (baseline tier + named, rationale-bearing modifiers; no free numbers), (3) nonzero floor.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cw = require('../../src/_data/credibilityWeighting.js');

describe('credibilityWeighting — admission floor (axis 1) (#1591)', () => {
  it('admits a source that clears all provenance gates', () => {
    expect(cw.admit({ identifiable: true, traceable: true, 'on-topic': true })).toEqual({ admitted: true, failed: [] });
  });
  it('rejects (lists failed gates) — and is provenance, not quality', () => {
    expect(cw.admit({ identifiable: true })).toEqual({ admitted: false, failed: ['traceable', 'on-topic'] });
    // a low-credibility-but-attributable source still passes admission (it is downweighted, not excluded)
    expect(cw.admit({ identifiable: true, traceable: true, 'on-topic': true }).admitted).toBe(true);
  });
});

describe('credibilityWeighting — GRADE-shaped weight (axis 2) (#1591)', () => {
  it('flat-tier-by-type is the degenerate config (no modifiers ⇒ kind baseline)', () => {
    expect(cw.computeCredibilityWeight({ kind: 'peer-reviewed' }).weight).toBe(1.0);
    expect(cw.computeCredibilityWeight({ kind: 'standard' }).weight).toBe(0.9);
    expect(cw.computeCredibilityWeight({ kind: 'guideline' }).weight).toBe(0.75);
    expect(cw.computeCredibilityWeight({ kind: 'blog' }).weight).toBe(0.4);
  });
  it('preserves the ruled ordering peer-reviewed > standard > guideline > book > blog', () => {
    const w = (k) => cw.computeCredibilityWeight({ kind: k }).weight;
    expect(w('peer-reviewed')).toBeGreaterThan(w('standard'));
    expect(w('standard')).toBeGreaterThan(w('guideline'));
    expect(w('guideline')).toBeGreaterThan(w('book'));
    expect(w('book')).toBeGreaterThan(w('blog'));
  });
  it('applies a named modifier and records it', () => {
    const r = cw.computeCredibilityWeight({ kind: 'guideline', modifiers: [{ id: 'independent-replication', rationale: 'replicated across 3 labs', attribution: 'reviewer X' }] });
    expect(r.weight).toBe(0.85);
    expect(r.applied).toEqual(['independent-replication']);
  });
  it('REQUIRES rationale + attribution on a non-deterministic modifier (no un-audited adjustments)', () => {
    expect(() => cw.computeCredibilityWeight({ kind: 'blog', modifiers: [{ id: 'narrow-sample' }] })).toThrow(/rationale \+ attribution/);
  });
  it('throws on an unknown kind or modifier (a misconfigured source fails loudly)', () => {
    expect(() => cw.computeCredibilityWeight({ kind: 'tweet' })).toThrow(/unknown source kind/);
    expect(() => cw.computeCredibilityWeight({ kind: 'blog', modifiers: [{ id: 'vibes', rationale: 'x', attribution: 'y' }] })).toThrow(/unknown modifier/);
  });
  it('staleness is deterministic — auto-applies only past the horizon, needs no rationale', () => {
    const stale = cw.computeCredibilityWeight({ kind: 'standard', modifiers: [{ id: 'staleness', date: '2000-01-01', asOf: '2026-06-22' }] });
    expect(stale.applied).toEqual(['staleness']);
    expect(stale.weight).toBe(0.8); // 0.9 - 0.1
    const fresh = cw.computeCredibilityWeight({ kind: 'standard', modifiers: [{ id: 'staleness', date: '2025-01-01', asOf: '2026-06-22' }] });
    expect(fresh.applied).toEqual([]); // within horizon ⇒ not applied
    expect(fresh.weight).toBe(0.9);
  });
});

describe('credibilityWeighting — nonzero floor (axis 1 mirror) (#1591)', () => {
  it('clamps an over-eroded weight to the floor, never to zero (no covert re-exclusion)', () => {
    const r = cw.computeCredibilityWeight({
      kind: 'blog',
      modifiers: [
        { id: 'vendor-funded-bias', rationale: 'sponsor', attribution: 'a' },
        { id: 'narrow-sample', rationale: 'n=3', attribution: 'b' },
        { id: 'vendor-funded-bias', rationale: 'sponsor2', attribution: 'c' },
      ],
    });
    expect(r.weight).toBe(cw.weightFloorDefault);
    expect(r.weight).toBeGreaterThan(0);
  });
});
