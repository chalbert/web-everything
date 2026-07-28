/**
 * @file fetch-parked.test.mjs — proof of the PURE `assembleParked` + its helpers (#2434). The two `gh` calls
 *   are the I/O boundary (the CLI's concern); the view+diff → contract distillation, the rollup→bucket
 *   normalization, and the review-class read are decided in pure fns and unit-tested against fixtures, no gh.
 */
import { describe, it, expect } from 'vitest';
import {
  assembleParked, rollupToCheckRows, reviewClassFromLabels, labelNames,
  filterToRequired, recoverCheckRows, resolveRequiredNames,
} from '../fetch-parked.mjs';
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

describe('filterToRequired — narrows rows to the required set (#2482)', () => {
  const rows = [
    { name: 'test', bucket: 'pass' },
    { name: 'lint', bucket: 'fail' },
    { name: 'smoke', bucket: 'pending' },
  ];

  it('keeps only rows whose name is in requiredNames', () => {
    expect(filterToRequired(rows, ['test'])).toEqual([{ name: 'test', bucket: 'pass' }]);
  });

  it('an empty requiredNames yields [] (a no-required-checks PR → classifyChecks passed)', () => {
    expect(filterToRequired(rows, [])).toEqual([]);
    expect(classifyChecks(filterToRequired(rows, [])).status).toBe('passed');
  });

  it('a non-array requiredNames (unknown set) keeps ALL rows — the historical all-checks fallback', () => {
    expect(filterToRequired(rows, undefined)).toEqual(rows);
    expect(filterToRequired(rows, null)).toEqual(rows);
  });

  it('is tolerant of a non-array rows arg', () => {
    expect(filterToRequired(undefined, ['test'])).toEqual([]);
  });

  it('a required name absent from the rollup drops to [] → passed (same reconciliation pr-land makes)', () => {
    // The required `test` check has not reported into the rollup yet — filtering yields [], which classifies as
    // passed. This mirrors what `gh pr checks --required` returns to pr-land for the same PR, so the two agree.
    expect(filterToRequired([{ name: 'other', bucket: 'pass' }], ['test'])).toEqual([]);
    expect(classifyChecks(filterToRequired([{ name: 'other', bucket: 'pass' }], ['test'])).status).toBe('passed');
  });

  it('the point: required green + optional red reads as passed, not failed', () => {
    const mixed = [{ name: 'test', bucket: 'pass' }, { name: 'optional', bucket: 'fail' }];
    expect(classifyChecks(filterToRequired(mixed, ['test'])).status).toBe('passed');
    expect(classifyChecks(mixed).status).toBe('failed'); // the all-checks over-report we are fixing
  });
});

describe('recoverCheckRows — reads a non-zero `gh pr checks` result (#2482)', () => {
  it('recovers the JSON rows gh prints to stdout in the pending/failed case', () => {
    const rows = [{ name: 'test', state: 'IN_PROGRESS', bucket: 'pending' }];
    expect(recoverCheckRows({ stdout: JSON.stringify(rows) })).toEqual({ rows });
  });

  it('reads the genuine no-required-checks case (stderr "no checks reported") as []', () => {
    expect(recoverCheckRows({ stderr: 'no checks reported on the main branch' })).toEqual({ rows: [] });
    // …and that empty array classifies as passed — the exit-0 behaviour finding 3 wants.
    expect(classifyChecks(recoverCheckRows({ stderr: 'no checks reported' }).rows).status).toBe('passed');
  });

  it('matches "no checks reported" on the message too (not just stderr)', () => {
    expect(recoverCheckRows({ message: 'Command failed … no checks reported' })).toEqual({ rows: [] });
  });

  it('treats a real gh/network error as unknown (caller keeps waiting / falls back)', () => {
    expect(recoverCheckRows({ stderr: 'HTTP 503: server error' })).toEqual({ unknown: true });
    expect(recoverCheckRows({})).toEqual({ unknown: true });
  });

  it('non-JSON stdout that is not a no-checks message is unknown', () => {
    expect(recoverCheckRows({ stdout: 'garbage' })).toEqual({ unknown: true });
  });
});

describe('resolveRequiredNames — via an injected gh runner (#2482)', () => {
  it('maps the required rows to their names', () => {
    const runGh = () => JSON.stringify([{ name: 'test' }, { name: 'build' }]);
    expect(resolveRequiredNames(runGh, 472)).toEqual(['test', 'build']);
  });

  it('a no-required-checks PR (gh throws with the message) → []', () => {
    const runGh = () => { throw Object.assign(new Error('boom'), { stderr: 'no checks reported' }); };
    expect(resolveRequiredNames(runGh, 472)).toEqual([]);
  });

  it('recovers names from stdout when gh exits non-zero but printed rows', () => {
    const runGh = () => { throw Object.assign(new Error('boom'), { stdout: JSON.stringify([{ name: 'test' }]) }); };
    expect(resolveRequiredNames(runGh, 472)).toEqual(['test']);
  });

  it('a transient gh error → undefined (caller falls back to all-checks)', () => {
    const runGh = () => { throw Object.assign(new Error('boom'), { stderr: 'HTTP 503' }); };
    expect(resolveRequiredNames(runGh, 472)).toBeUndefined();
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

  it('defaults checksScope to "all" when no requiredNames is supplied', () => {
    expect(d.checksScope).toBe('all');
  });

  it('narrows checks to the required set + marks checksScope when requiredNames is supplied (#2482)', () => {
    const mixed = {
      ...view,
      statusCheckRollup: [
        { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { __typename: 'CheckRun', name: 'optional', status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    };
    const narrowed = assembleParked({ view: mixed, requiredNames: ['test'] });
    expect(narrowed.checks.status).toBe('passed');   // required green — over-report of the optional red is gone
    expect(narrowed.checksScope).toBe('required');
    // …whereas with no requiredNames the same PR over-reports the optional red.
    expect(assembleParked({ view: mixed }).checks.status).toBe('failed');
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
    expect(d.checksScope).toBe('all');
  });

  it('a missing arg object does not throw', () => {
    expect(() => assembleParked()).not.toThrow();
  });
});
