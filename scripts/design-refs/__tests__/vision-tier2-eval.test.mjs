// Tests for the Tier-2 small-VLM offline eval harness (backlog #1081, epic #1073 slice B): scores a
// small VLM's rich output (#1080 contract) on the objective capabilities — tagging set-agreement +
// region detection (IoU) — and ranks candidates. The scorers are pure, proven here without a model or a
// browser (a fixture injects the rich-output a VLM would return), like benchmark.test.mjs.

import { describe, it, expect } from 'vitest';
import {
  scoreTagging, iou, scoreDetection, scoreSample, scoreCandidate, rankCandidates,
} from '../vision-tier2-eval.mjs';

describe('scoreTagging (pure, multi-label)', () => {
  it('scores a perfect match', () => {
    expect(scoreTagging(['nav', 'table'], ['table', 'nav'])).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  });
  it('is case-insensitive and counts partial overlap', () => {
    const s = scoreTagging(['Nav', 'chart'], ['nav', 'table']); // 1 tp, 1 fp, 1 fn
    expect(s).toMatchObject({ tp: 1, fp: 1, fn: 1 });
    expect(s.precision).toBeCloseTo(0.5);
    expect(s.recall).toBeCloseTo(0.5);
  });
  it('treats empty-truth + empty-pred as a vacuous perfect score, and hallucination as precision 0', () => {
    expect(scoreTagging([], [])).toMatchObject({ f1: 1 });
    expect(scoreTagging(['ghost'], [])).toMatchObject({ precision: 0 });
  });
});

describe('iou (pure)', () => {
  it('is 1 for identical boxes, 0 for disjoint, and exact for a known overlap', () => {
    const box = { x: 0, y: 0, w: 0.4, h: 0.4 };
    expect(iou(box, box)).toBeCloseTo(1);
    expect(iou(box, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 })).toBe(0);
    // two 0.2×0.2 boxes overlapping in a 0.1×0.1 corner → inter 0.01, union 0.08+0.08-0.01... = 0.07.
    expect(iou({ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.1, y: 0.1, w: 0.2, h: 0.2 })).toBeCloseTo(0.01 / 0.07);
  });
  it('is 0 when either box is null (label-only region is not a localization match)', () => {
    expect(iou(null, { x: 0, y: 0, w: 1, h: 1 })).toBe(0);
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, null)).toBe(0);
  });
});

describe('scoreDetection (pure, label-matched greedy IoU)', () => {
  const A = { label: 'sidebar', box: { x: 0, y: 0, w: 0.3, h: 0.6 } };
  it('matches same-label boxes above threshold', () => {
    const pred = [{ label: 'sidebar', box: { x: 0.02, y: 0.02, w: 0.3, h: 0.6 } }];
    expect(scoreDetection(pred, [A], 0.5)).toMatchObject({ tp: 1, fp: 0, fn: 0 });
  });
  it('rejects a right box under the wrong label', () => {
    const pred = [{ label: 'toolbar', box: A.box }];
    expect(scoreDetection(pred, [A], 0.5)).toMatchObject({ tp: 0, fp: 1, fn: 1 });
  });
  it('rejects a right label whose box is below the IoU floor', () => {
    const pred = [{ label: 'sidebar', box: { x: 0.5, y: 0.5, w: 0.3, h: 0.6 } }];
    expect(scoreDetection(pred, [A], 0.5)).toMatchObject({ tp: 0, fp: 1, fn: 1 });
  });
  it('does not let a box-less prediction count as a detection', () => {
    expect(scoreDetection([{ label: 'sidebar', box: null }], [A], 0.5)).toMatchObject({ tp: 0, fn: 1 });
  });
  it('consumes each truth at most once (no double-credit)', () => {
    const pred = [
      { label: 'sidebar', box: { x: 0, y: 0, w: 0.3, h: 0.6 } },
      { label: 'sidebar', box: { x: 0, y: 0, w: 0.3, h: 0.6 } },
    ];
    expect(scoreDetection(pred, [A], 0.5)).toMatchObject({ tp: 1, fp: 1, fn: 0 });
  });
});

describe('scoreSample (normalizes through the #1080 contract)', () => {
  it('scores tagging + detection on a raw rich-output pair', () => {
    const predicted = { tags: [' Nav ', 'nav'], regions: [{ label: 'hero', box: { x: 0, y: 0, w: 0.5, h: 0.5 } }] };
    const truth = { tags: ['nav', 'footer'], regions: [{ label: 'hero', box: { x: 0, y: 0, w: 0.5, h: 0.5 } }] };
    const s = scoreSample({ predicted, truth, iouThreshold: 0.5 });
    expect(s.tagging).toMatchObject({ tp: 1, fp: 0, fn: 1 }); // dedup → {nav}; truth {nav,footer}
    expect(s.detection).toMatchObject({ tp: 1, fp: 0, fn: 0 });
  });
});

describe('scoreCandidate + rankCandidates', () => {
  const samples = [
    { contentHash: 'a', predicted: { tags: ['nav'], regions: [] }, truth: { tags: ['nav'], regions: [] } },
    { contentHash: 'b', predicted: { tags: ['chart'], regions: [] }, truth: { tags: ['table'], regions: [] } },
  ];
  it('aggregates mean tagging F1 and falls back to tagging when no sample has boxes', () => {
    const r = scoreCandidate({ candidate: 'mock', samples, iouThreshold: 0.5 });
    expect(r.n).toBe(2);
    expect(r.taggingF1).toBeCloseTo(0.5); // 1.0 then 0.0
    expect(r.detectionF1).toBeNull(); // no boxed regions on either side → non-informative, excluded
    expect(r.detectionSamples).toBe(0);
    expect(r.combined).toBeCloseTo(0.5); // falls back to tagging alone
  });
  it('blends tagging + detection when boxes are present', () => {
    const boxed = [
      {
        contentHash: 'c',
        predicted: { tags: ['hero'], regions: [{ label: 'hero', box: { x: 0, y: 0, w: 0.5, h: 0.5 } }] },
        truth: { tags: ['hero'], regions: [{ label: 'hero', box: { x: 0, y: 0, w: 0.5, h: 0.5 } }] },
      },
    ];
    const r = scoreCandidate({ candidate: 'mock', samples: boxed, iouThreshold: 0.5 });
    expect(r.taggingF1).toBeCloseTo(1);
    expect(r.detectionF1).toBeCloseTo(1);
    expect(r.detectionSamples).toBe(1);
    expect(r.combined).toBeCloseTo(1);
  });
  it('scores a missing prediction as an empty rich-output (a miss, not a drop)', () => {
    const r = scoreCandidate({ candidate: 'mock', samples: [{ contentHash: 'x', truth: { tags: ['nav'] } }] });
    expect(r.taggingF1).toBe(0);
  });
  it('ranks candidates by combined score, stable on ties', () => {
    const ranked = rankCandidates([
      { candidate: 'low', combined: 0.2 },
      { candidate: 'high', combined: 0.9 },
      { candidate: 'mid', combined: 0.5 },
    ]);
    expect(ranked.map((r) => r.candidate)).toEqual(['high', 'mid', 'low']);
    expect(ranked[0].rank).toBe(1);
  });
});
