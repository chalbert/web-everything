/**
 * @file pr-state.test.mjs — proof of the PURE `formatPrStateLine` + `prStateRecord` (#2434). The `gh pr view`
 *   call is the CLI's concern; the view → one-line/record distillation (with the `checks=` token single-sourced
 *   through classifyChecks over the normalized rollup) is pure and unit-tested here against fixtures, no gh.
 */
import { describe, it, expect } from 'vitest';
import { formatPrStateLine, prStateRecord } from '../pr-state.mjs';

const greenView = {
  number: 472,
  state: 'OPEN',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  statusCheckRollup: [
    { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
  ],
  title: 'scripts: drain helpers',
};

const failView = {
  number: 480,
  state: 'OPEN',
  mergeable: 'CONFLICTING',
  mergeStateStatus: 'DIRTY',
  statusCheckRollup: [
    { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' },
  ],
  title: 'a broken PR',
};

describe('prStateRecord', () => {
  it('distills the view, with the checks token from classifyChecks over the rollup', () => {
    expect(prStateRecord(greenView)).toEqual({
      number: 472,
      state: 'OPEN',
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      checks: 'passed',
      title: 'scripts: drain helpers',
    });
  });

  it('reports a failed check via the shared classifier', () => {
    expect(prStateRecord(failView).checks).toBe('failed');
  });

  it('is tolerant of an empty view (never throws)', () => {
    const r = prStateRecord({});
    expect(r.number).toBe(0);
    expect(r.checks).toBe('passed'); // no rollup → classifyChecks no-checks default
    expect(() => prStateRecord()).not.toThrow();
  });
});

describe('formatPrStateLine', () => {
  it('renders the one-line state view', () => {
    expect(formatPrStateLine(greenView))
      .toBe('#472 OPEN mergeable=MERGEABLE checks=passed mss=CLEAN  scripts: drain helpers');
  });

  it('renders a red/conflicting PR', () => {
    expect(formatPrStateLine(failView))
      .toBe('#480 OPEN mergeable=CONFLICTING checks=failed mss=DIRTY  a broken PR');
  });
});
