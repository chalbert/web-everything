// Tests for the distillation corpus export (backlog #511, epic #490 slice A): the `export` step reads
// admitted items/*/meta.json (visionVerdict) + quarantine/*/meta.json into a single {frame, verdict}
// labeled training manifest with a deterministic, content-addressed held-out split. Proves the label is
// the model verdict (never inferred), that ungated shots are excluded as unlabeled, and that the split +
// record order are pure functions of the contentHash (re-runs diff cleanly). No browser/model/disk needed.

import { describe, it, expect } from 'vitest';
import { assignSplit, buildTrainingManifest } from '../../design-refs.mjs';

const hash = (c) => c.repeat(64);
const recipe = { version: 3, holdoutFraction: 0.15, labelSpace: ['app', 'obstructed', 'marketing', 'error', 'blank', 'non-app'] };

const admitted = [
  { id: 'item-a', contentHash: hash('a'), visionVerdict: { verdict: 'app', provider: 'mock' } },
  { id: 'item-u', contentHash: hash('u'), visionVerdict: null }, // ungated — no model judged it
];
const quarantined = [
  { contentHash: hash('1'), visionVerdict: { verdict: 'marketing', provider: 'mock' } },
  { contentHash: hash('2'), visionVerdict: { verdict: 'blank', provider: 'mock' } },
];

describe('assignSplit', () => {
  it('is a pure, deterministic function of the contentHash', () => {
    expect(assignSplit(hash('a'), 0.15)).toBe(assignSplit(hash('a'), 0.15));
  });
  it('holdoutFraction 0 → everything trains; 1 → everything is held out', () => {
    for (const c of ['a', '0', 'f', '7']) {
      expect(assignSplit(hash(c), 0)).toBe('train');
      expect(assignSplit(hash(c), 1)).toBe('holdout');
    }
  });
});

describe('buildTrainingManifest', () => {
  it('emits {frame, verdict} records from admitted + quarantined frames', () => {
    const m = buildTrainingManifest({ admitted, quarantined, recipe });
    const byHash = Object.fromEntries(m.records.map((r) => [r.contentHash, r]));
    expect(byHash[hash('a')]).toMatchObject({ frame: 'items/item-a/screenshot.webp', verdict: 'app', provenance: 'admitted' });
    expect(byHash[hash('1')]).toMatchObject({ frame: `quarantine/${hash('1')}/screenshot.webp`, verdict: 'marketing', provenance: 'quarantined' });
  });

  it('excludes ungated (no visionVerdict) shots and counts them as unlabeled — the label is the model verdict', () => {
    const m = buildTrainingManifest({ admitted, quarantined, recipe });
    expect(m.records.some((r) => r.contentHash === hash('u'))).toBe(false);
    expect(m.counts.unlabeled).toBe(1);
    expect(m.counts.total).toBe(3); // a (app) + marketing + blank
  });

  it('records are sorted by contentHash — deterministic, diff-clean across re-runs', () => {
    const m = buildTrainingManifest({ admitted, quarantined, recipe });
    const hashes = m.records.map((r) => r.contentHash);
    expect(hashes).toEqual([...hashes].sort());
  });

  it('split + counts are internally consistent and reflect the recipe', () => {
    const m = buildTrainingManifest({ admitted, quarantined, recipe });
    expect(m.recipeVersion).toBe(3);
    expect(m.holdoutFraction).toBe(0.15);
    expect(m.counts.train + m.counts.holdout).toBe(m.counts.total);
    expect(m.counts.byProvenance).toEqual({ admitted: 1, quarantined: 2 });
    expect(m.counts.byVerdict).toEqual({ app: 1, marketing: 1, blank: 1 });
  });

  it('an empty corpus yields a valid, empty manifest (builds without real data)', () => {
    const m = buildTrainingManifest({ recipe });
    expect(m.records).toEqual([]);
    expect(m.counts).toMatchObject({ total: 0, train: 0, holdout: 0, unlabeled: 0 });
    expect(m.labelSpace).toEqual(recipe.labelSpace);
  });
});
