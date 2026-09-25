/**
 * @file scripts/conveyor/__tests__/main-red-recovery.test.mjs
 * @description Pins we:backlog/x5uqim1-*.md's pure core against the REAL shapes measured live 2026-09-25 off
 *   `chalbert/web-everything`: `main`'s own `gh run list --branch main` history (one genuine red window,
 *   01:30:55Z–02:31:25Z, closed by PR #2638) and the six PRs whose `test` run's own `attempts/1` completion
 *   timestamp falls inside it — five already manually refreshed onto main by the operator (`ahead_by: 0`,
 *   still red — a genuine own-failure now) and one never refreshed (PR #2635, `ahead_by: 33`) — plus one PR
 *   (#2636) whose failure completed hours after `main` recovered, its own. See the module's own file header for
 *   the mid-build correction from `gh run rerun` (measured NOT to work) to a branch refresh onto `main`.
 */
import { describe, it, expect } from 'vitest';
import {
  MAIN_RED_CONCLUSIONS, computeMainRedWindows, isWithinRedWindow, isMainCurrentlyRed,
  classifyCiFailureAttribution, isPrCiFailureOwedRerun, planMainRedRebases,
} from '../main-red-recovery.mjs';

// ── fixtures — measured off chalbert/web-everything, 2026-09-25 ────────────────────────────────────────────────
const run = (createdAt, updatedAt, conclusion, status = 'completed') => ({ createdAt, updatedAt, conclusion, status, workflowName: 'CI' });

/** A slice of `main`'s own real run history: one closed red window (the live incident), bracketed by green. */
const MAIN_RUNS = [
  run('2026-09-25T01:01:19Z', '2026-09-25T01:09:21Z', 'success'),
  run('2026-09-25T01:19:41Z', '2026-09-25T01:21:51Z', 'cancelled'), // superseded by the next push — NOT red
  run('2026-09-25T01:21:30Z', '2026-09-25T01:30:55Z', 'failure'),   // window opens HERE
  run('2026-09-25T01:37:41Z', '2026-09-25T01:45:31Z', 'cancelled'),
  run('2026-09-25T01:45:27Z', '2026-09-25T01:54:46Z', 'failure'),   // still red — window does not re-open, stays open
  run('2026-09-25T02:01:01Z', '2026-09-25T02:09:36Z', 'failure'),
  run('2026-09-25T02:23:29Z', '2026-09-25T02:31:25Z', 'success'),   // window closes HERE (PR #2638 landed 02:23:27Z)
  run('2026-09-25T03:26:33Z', '2026-09-25T03:36:11Z', 'failure'),   // a SECOND, later red window
  run('2026-09-25T03:40:56Z', '2026-09-25T03:50:15Z', 'success'),
];

/** An open-ended real history — the tail failure never got a later green run in the sample. */
const MAIN_RUNS_STILL_RED = [
  run('2026-09-25T02:23:29Z', '2026-09-25T02:31:25Z', 'success'),
  run('2026-09-25T03:26:33Z', '2026-09-25T03:36:11Z', 'failure'),
];

describe('main-red-recovery — computeMainRedWindows / isWithinRedWindow / isMainCurrentlyRed', () => {
  it('opens a window at the completing red run, closes it at the completing green run, and ignores cancelled runs', () => {
    const windows = computeMainRedWindows(MAIN_RUNS);
    expect(windows).toEqual([
      { start: '2026-09-25T01:30:55Z', end: '2026-09-25T02:31:25Z' },
      { start: '2026-09-25T03:36:11Z', end: '2026-09-25T03:50:15Z' },
    ]);
  });

  it('leaves the last window OPEN when no later green run has completed yet', () => {
    const windows = computeMainRedWindows(MAIN_RUNS_STILL_RED);
    expect(windows).toEqual([{ start: '2026-09-25T03:36:11Z', end: null }]);
    expect(isMainCurrentlyRed(windows)).toBe(true);
  });

  it('a fully-green history produces no windows, and main reads as not currently red', () => {
    const windows = computeMainRedWindows([run('2026-09-25T00:00:00Z', '2026-09-25T00:05:00Z', 'success')]);
    expect(windows).toEqual([]);
    expect(isMainCurrentlyRed(windows)).toBe(false);
  });

  it('skips a run that has not completed yet — an in-flight run tells us nothing about what main concluded', () => {
    const windows = computeMainRedWindows([
      run('2026-09-25T01:00:00Z', null, null, 'in_progress'),
      run('2026-09-25T01:00:00Z', '2026-09-25T01:05:00Z', 'success'),
    ]);
    expect(windows).toEqual([]);
  });

  it('isWithinRedWindow: a timestamp inside the closed live-incident window reads true; just outside reads false', () => {
    const windows = computeMainRedWindows(MAIN_RUNS);
    expect(isWithinRedWindow(Date.parse('2026-09-25T02:02:29Z'), windows)).toBe(true); // PR #2596's real attempt-1 completion
    expect(isWithinRedWindow(Date.parse('2026-09-25T01:30:55Z'), windows)).toBe(true); // the window's own start, inclusive
    expect(isWithinRedWindow(Date.parse('2026-09-25T02:31:25Z'), windows)).toBe(true); // the window's own end, inclusive
    expect(isWithinRedWindow(Date.parse('2026-09-25T02:31:26Z'), windows)).toBe(false); // one second after — main is green again
    expect(isWithinRedWindow(Date.parse('2026-09-25T08:03:45Z'), windows)).toBe(false); // PR #2636's real failure — hours later
  });

  it('an unparseable/NaN timestamp never matches any window', () => {
    expect(isWithinRedWindow(NaN, computeMainRedWindows(MAIN_RUNS))).toBe(false);
  });
});

describe('main-red-recovery — classifyCiFailureAttribution', () => {
  const windows = computeMainRedWindows(MAIN_RUNS);
  it('main-red for a completion timestamp inside a red window', () => {
    expect(classifyCiFailureAttribution({ failureCompletedAt: '2026-09-25T02:02:29Z', mainRedWindows: windows })).toBe('main-red');
  });
  it('own-failure for a completion timestamp outside every red window', () => {
    expect(classifyCiFailureAttribution({ failureCompletedAt: '2026-09-25T08:03:45Z', mainRedWindows: windows })).toBe('own-failure');
  });
  it('unknown for a missing/malformed timestamp — never guessed as either real answer', () => {
    expect(classifyCiFailureAttribution({ failureCompletedAt: null, mainRedWindows: windows })).toBe('unknown');
    expect(classifyCiFailureAttribution({ failureCompletedAt: 'not-a-date', mainRedWindows: windows })).toBe('unknown');
  });
});

// CORRECTED mid-build (see main-red-recovery.mjs's own file header): the real recovery mechanism is refreshing
// a PR's branch onto current `main` (`ahead_by` from GitHub's own `compare` endpoint), never rerunning the same
// stale commit in place — `gh run rerun --failed` was live-measured to fail again for the identical reason.
describe('main-red-recovery — isPrCiFailureOwedRerun', () => {
  const windows = computeMainRedWindows(MAIN_RUNS);
  it('true for a main-red failure whose head is still behind main (PR #2635\'s real shape: 33 commits behind)', () => {
    expect(isPrCiFailureOwedRerun({ requiredCheckCompletedAt: '2026-09-25T01:57:47Z', aheadBy: 33, mainRedWindows: windows })).toBe(true);
  });
  it('false once the head already contains main\'s current tip (PR #2596\'s real shape post-refresh: ahead_by 0, still red)', () => {
    expect(isPrCiFailureOwedRerun({ requiredCheckCompletedAt: '2026-09-25T02:02:29Z', aheadBy: 0, mainRedWindows: windows })).toBe(false);
  });
  it('false for a failure outside any red window (PR #2636\'s real shape), whatever aheadBy is', () => {
    expect(isPrCiFailureOwedRerun({ requiredCheckCompletedAt: '2026-09-25T08:03:45Z', aheadBy: 33, mainRedWindows: windows })).toBe(false);
  });
  it('an UNKNOWN aheadBy is treated as "not yet refreshed" — the safe direction against misdiagnosing main-red as a code defect', () => {
    expect(isPrCiFailureOwedRerun({ requiredCheckCompletedAt: '2026-09-25T02:02:29Z', aheadBy: null, mainRedWindows: windows })).toBe(true);
  });
  it('an UNKNOWN completion timestamp never grants owed-ci-rerun — falls through to the existing ci-heal path', () => {
    expect(isPrCiFailureOwedRerun({ requiredCheckCompletedAt: null, aheadBy: 33, mainRedWindows: windows })).toBe(false);
  });
});

describe('main-red-recovery — planMainRedRebases', () => {
  const windows = computeMainRedWindows(MAIN_RUNS);

  it('every candidate yields a dispatch or a refusal — never neither', () => {
    const candidates = [
      { prNumber: 2635, headRefName: 'lane/xdzl6mb', aheadBy: 33, failureCompletedAt: '2026-09-25T01:57:47Z' },
      { prNumber: 2596, headRefName: 'lane/batch-...-3901', aheadBy: 0, failureCompletedAt: '2026-09-25T02:02:29Z' },
      { prNumber: 2636, headRefName: 'lane/batch-...-3915', aheadBy: 33, failureCompletedAt: '2026-09-25T08:03:45Z' },
    ];
    const plan = planMainRedRebases({ candidates, mainRedWindows: windows });
    expect(plan.dispatch.length + plan.refusals.length).toBe(candidates.length);
  });

  it('dispatches a real rebase-onto-main for a main-red failure whose head is still behind (PR #2635)', () => {
    const plan = planMainRedRebases({
      candidates: [{ prNumber: 2635, headRefName: 'lane/xdzl6mb', aheadBy: 33, failureCompletedAt: '2026-09-25T01:57:47Z' }],
      mainRedWindows: windows,
    });
    expect(plan.dispatch).toEqual([expect.objectContaining({ prNumber: 2635, kind: 'rebase-onto-main', aheadBy: 33 })]);
    expect(plan.refusals).toEqual([]);
  });

  it('refuses already-current for a main-red failure whose head already contains main\'s tip (PR #2596, ahead_by 0, still red)', () => {
    const plan = planMainRedRebases({
      candidates: [{ prNumber: 2596, aheadBy: 0, failureCompletedAt: '2026-09-25T02:02:29Z' }],
      mainRedWindows: windows,
    });
    expect(plan.refusals).toEqual([expect.objectContaining({ prNumber: 2596, kind: 'already-current' })]);
    expect(plan.dispatch).toEqual([]);
  });

  it('refuses own-failure for a failure outside every red window (PR #2636) — never this pass\'s job', () => {
    const plan = planMainRedRebases({
      candidates: [{ prNumber: 2636, aheadBy: 33, failureCompletedAt: '2026-09-25T08:03:45Z' }],
      mainRedWindows: windows,
    });
    expect(plan.refusals).toEqual([expect.objectContaining({ prNumber: 2636, kind: 'own-failure' })]);
  });

  it('refuses main-still-red when the failure is main-red-attributable but main has not recovered yet', () => {
    const stillRedWindows = computeMainRedWindows(MAIN_RUNS_STILL_RED);
    const plan = planMainRedRebases({
      candidates: [{ prNumber: 9001, aheadBy: 5, failureCompletedAt: '2026-09-25T03:40:00Z' }],
      mainRedWindows: stillRedWindows,
    });
    expect(plan.refusals).toEqual([expect.objectContaining({ prNumber: 9001, kind: 'main-still-red' })]);
  });

  it('refuses unknown-ahead-by when the compare read could not be resolved', () => {
    const plan = planMainRedRebases({
      candidates: [{ prNumber: 9002, aheadBy: null, failureCompletedAt: '2026-09-25T02:02:29Z' }],
      mainRedWindows: windows,
    });
    expect(plan.refusals).toEqual([expect.objectContaining({ prNumber: 9002, kind: 'unknown-ahead-by' })]);
  });

  it('MAIN_RED_CONCLUSIONS deliberately excludes cancelled — the ordinary drain-traffic case', () => {
    expect(MAIN_RED_CONCLUSIONS).not.toContain('cancelled');
  });
});
