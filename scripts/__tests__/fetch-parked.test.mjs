/**
 * @file fetch-parked.test.mjs — proof of the PURE `assembleParked` + its helpers (#2434). The two `gh` calls
 *   are the I/O boundary (the CLI's concern); the view+diff → contract distillation, the rollup→bucket
 *   normalization, and the review-class read are decided in pure fns and unit-tested against fixtures, no gh.
 */
import { describe, it, expect } from 'vitest';
import { assembleParked, rollupToCheckRows, reviewClassFromLabels, labelNames } from '../fetch-parked.mjs';
import { classifyChecks } from '../pr-land.mjs';

// A real-shaped `gh pr view … --json statusCheckRollup` — CheckRun rows carry status/conclusion, not bucket.
const greenRollup = [
  { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', name: 'smoke', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', name: 'visual', status: 'COMPLETED', conclusion: 'SKIPPED' },
];
const pendingRollup = [
  { __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null },
];
const failedRollup = [
  { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' },
];

describe('rollupToCheckRows — normalizes the GraphQL rollup to gh bucket rows', () => {
  it('maps COMPLETED conclusions to pass/skipping buckets', () => {
    expect(rollupToCheckRows(greenRollup)).toEqual([
      { name: 'test', bucket: 'pass' },
      { name: 'smoke', bucket: 'pass' },
      { name: 'visual', bucket: 'skipping' },
    ]);
  });

  it('maps an in-flight status to pending regardless of a null conclusion', () => {
    expect(rollupToCheckRows(pendingRollup)).toEqual([{ name: 'test', bucket: 'pending' }]);
  });

  it('maps a FAILURE conclusion to fail', () => {
    expect(rollupToCheckRows(failedRollup)).toEqual([{ name: 'test', bucket: 'fail' }]);
  });

  it('reads a StatusContext (state, no status/conclusion)', () => {
    expect(rollupToCheckRows([{ __typename: 'StatusContext', context: 'ci/x', state: 'FAILURE' }]))
      .toEqual([{ name: 'ci/x', bucket: 'fail' }]);
  });

  it('is tolerant of an absent/odd rollup', () => {
    expect(rollupToCheckRows(undefined)).toEqual([]);
    expect(rollupToCheckRows(null)).toEqual([]);
  });

  it('feeds classifyChecks correctly — the whole point (green→passed, pending→pending, fail→failed)', () => {
    expect(classifyChecks(rollupToCheckRows(greenRollup)).status).toBe('passed');
    expect(classifyChecks(rollupToCheckRows(pendingRollup)).status).toBe('pending');
    expect(classifyChecks(rollupToCheckRows(failedRollup)).status).toBe('failed');
  });
});

describe('reviewClassFromLabels — reuses the ratified REVIEW_LABELS', () => {
  it('human wins over pending', () => {
    expect(reviewClassFromLabels(['review:human', 'review:pending'])).toBe('human');
  });
  it('pending when only pending is present', () => {
    expect(reviewClassFromLabels(['review:pending', 'ready-to-merge'])).toBe('pending');
  });
  it('none when no review label is present', () => {
    expect(reviewClassFromLabels(['ready-to-merge'])).toBe('none');
  });
});

describe('labelNames — normalizes {name}/string label shapes', () => {
  it('maps object and string labels to names, dropping empties', () => {
    expect(labelNames([{ name: 'a' }, 'b', null, {}])).toEqual(['a', 'b']);
  });
  it('is tolerant of a non-array', () => {
    expect(labelNames(undefined)).toEqual([]);
  });
});

describe('assembleParked — the per-PR bundle contract', () => {
  const view = {
    number: 472,
    title: 'scripts: drain helpers',
    body: 'the body',
    files: [{ path: 'scripts/fetch-parked.mjs', additions: 100, deletions: 0 }],
    state: 'OPEN',
    statusCheckRollup: greenRollup,
    labels: [{ name: 'ready-to-merge' }, { name: 'review:pending' }],
    headRefName: 'lane/2434-drain-helpers',
    mergeable: 'MERGEABLE',
  };
  const d = assembleParked({ view, diff: 'diff --git a/x b/x\n+hi' });

  it('carries the full contract shape', () => {
    expect(d.number).toBe(472);
    expect(d.title).toBe('scripts: drain helpers');
    expect(d.body).toBe('the body');
    expect(d.files).toEqual([{ path: 'scripts/fetch-parked.mjs', additions: 100, deletions: 0 }]);
    expect(d.state).toBe('OPEN');
    expect(d.headRefName).toBe('lane/2434-drain-helpers');
    expect(d.mergeable).toBe('MERGEABLE');
    expect(d.diff).toBe('diff --git a/x b/x\n+hi');
  });

  it('checks come from classifyChecks over the normalized rollup', () => {
    expect(d.checks.status).toBe('passed');
  });

  it('carries label names + the derived review class', () => {
    expect(d.labels).toEqual(['ready-to-merge', 'review:pending']);
    expect(d.reviewClass).toBe('pending');
  });
});

describe('assembleParked — tolerance of missing fields', () => {
  it('an empty view degrades to the empty contract, never throws', () => {
    const d = assembleParked({ view: {} });
    expect(d.number).toBe(0);
    expect(d.title).toBe('');
    expect(d.files).toEqual([]);
    expect(d.labels).toEqual([]);
    expect(d.reviewClass).toBe('none');
    expect(d.diff).toBe('');
    // no rollup → classifyChecks' no-checks default is "passed"
    expect(d.checks.status).toBe('passed');
  });

  it('a missing arg object does not throw', () => {
    expect(() => assembleParked()).not.toThrow();
  });
});
