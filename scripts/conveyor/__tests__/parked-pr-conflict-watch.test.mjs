/**
 * @file parked-pr-conflict-watch.test.mjs — `#xw0odtv`. PURE logic tests for `isParkedConflictTarget` /
 * `planConflictLabelChange` + IO-shell tests over injected fakes (no `gh` process anywhere in this file),
 * mirroring `we:scripts/conveyor/__tests__/review-status-tag.test.mjs`'s own shape.
 */
import { describe, it, expect } from 'vitest';

import {
  CONFLICT_LABEL,
  CONFLICT_LABEL_META,
  isParkedConflictTarget,
  planConflictLabelChange,
  buildConflictComment,
  watchParkedPrConflicts,
  defaultListParkedPrs,
} from '../parked-pr-conflict-watch.mjs';

describe('the real incident that motivated this pass — WE PR #1920, captured live 2026-09-04T23:26Z', () => {
  // The EXACT `gh pr view 1920 --json ...` payload shape observed while diagnosing this gap (before the
  // operator/another session rebased it away mid-investigation) — a real fixture, not a synthetic guess.
  const REAL_1920_SNAPSHOT = {
    number: 1920,
    headRefName: 'lane/2412c-engine-tier-redteam-gate',
    mergeable: 'CONFLICTING',
    mergeStateStatus: 'DIRTY',
    labels: [{ name: 'review:human', description: 'conflict-of-interest: gate-self edit, a human must review', color: 'B60205' }],
  };

  it('the real incident WOULD have fired this pass\'s detection', () => {
    expect(isParkedConflictTarget(REAL_1920_SNAPSHOT)).toBe(true);
  });

  it('a full sweep over the real snapshot labels + comments it exactly once', () => {
    const calls = [];
    const provider = {
      ensureLabel: (repo, name) => calls.push(['ensureLabel', repo, name]),
      setLabels: (repo, pr, spec) => calls.push(['setLabels', repo, pr, spec]),
      postComment: (repo, pr, body) => calls.push(['postComment', repo, pr, body]),
    };
    const results = watchParkedPrConflicts({ repo: 'chalbert/web-everything', listPrs: () => [REAL_1920_SNAPSHOT], provider });
    expect(results).toEqual([{ num: 1920, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: true }]);
    expect(calls[0]).toEqual(['ensureLabel', 'chalbert/web-everything', CONFLICT_LABEL]);
    expect(calls[1]).toEqual(['setLabels', 'chalbert/web-everything', 1920, { add: CONFLICT_LABEL, remove: [] }]);
    expect(calls[2][3]).toContain('lane/2412c-engine-tier-redteam-gate');
  });

  it('once the PR is rebased clean (as #1920 actually was, mid-investigation) the label self-clears', () => {
    const healed = { ...REAL_1920_SNAPSHOT, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED', labels: [...REAL_1920_SNAPSHOT.labels, { name: CONFLICT_LABEL }] };
    const calls = [];
    const provider = { setLabels: (repo, pr, spec) => calls.push(['setLabels', repo, pr, spec]) };
    const results = watchParkedPrConflicts({ repo: 'chalbert/web-everything', listPrs: () => [healed], provider });
    expect(results).toEqual([{ num: 1920, isConflicting: false, add: null, remove: [CONFLICT_LABEL], newlyDetected: false, commented: false }]);
    expect(calls).toEqual([['setLabels', 'chalbert/web-everything', 1920, { add: undefined, remove: [CONFLICT_LABEL] }]]);
  });
});

describe('isParkedConflictTarget', () => {
  it('true: CONFLICTING + review:human', () => {
    expect(isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] })).toBe(true);
  });

  it('true: CONFLICTING + review:pending', () => {
    expect(isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] })).toBe(true);
  });

  it('true: CONFLICTING + review:changes (no review:accepted)', () => {
    expect(isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: [{ name: 'review:changes' }] })).toBe(true);
  });

  it('false: CONFLICTING + review:accepted only (hold satisfied)', () => {
    expect(isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: [{ name: 'review:accepted' }] })).toBe(false);
  });

  it('false: CONFLICTING + review:human + review:accepted (co-present pair reads as still held per #x9xqexm)', () => {
    // hasUnclearedReviewLabel refuses accepted+human as a pair no sanctioned writer produces — still held.
    expect(isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }, { name: 'review:accepted' }] })).toBe(true);
  });

  it('false: CONFLICTING + no review label at all — not parked, out of scope for this pass', () => {
    expect(isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: [] })).toBe(false);
  });

  it('false: MERGEABLE + review:human — no conflict, nothing to alert', () => {
    expect(isParkedConflictTarget({ mergeable: 'MERGEABLE', labels: [{ name: 'review:human' }] })).toBe(false);
  });

  it('false: UNKNOWN mergeable + review:human — GitHub hasn\'t computed it yet, not a confirmed conflict', () => {
    expect(isParkedConflictTarget({ mergeable: 'UNKNOWN', labels: [{ name: 'review:human' }] })).toBe(false);
  });

  it('false: missing mergeable entirely', () => {
    expect(isParkedConflictTarget({ labels: [{ name: 'review:human' }] })).toBe(false);
  });
});

describe('planConflictLabelChange', () => {
  it('adds the label and flags newlyDetected on first detection', () => {
    expect(planConflictLabelChange({ isConflicting: true, currentLabels: [] }))
      .toEqual({ add: CONFLICT_LABEL, remove: [], newlyDetected: true });
  });

  it('is a no-op once the label is already applied and still conflicting', () => {
    expect(planConflictLabelChange({ isConflicting: true, currentLabels: [{ name: CONFLICT_LABEL }] }))
      .toEqual({ add: null, remove: [], newlyDetected: false });
  });

  it('removes the label once the conflict resolves — no re-comment', () => {
    expect(planConflictLabelChange({ isConflicting: false, currentLabels: [{ name: CONFLICT_LABEL }] }))
      .toEqual({ add: null, remove: [CONFLICT_LABEL], newlyDetected: false });
  });

  it('is a no-op when never conflicting and never labelled', () => {
    expect(planConflictLabelChange({ isConflicting: false, currentLabels: [{ name: 'review:pending' }] }))
      .toEqual({ add: null, remove: [], newlyDetected: false });
  });

  it('leaves every other label untouched', () => {
    const currentLabels = [{ name: 'review:human' }, { name: 'ready-to-merge' }];
    expect(planConflictLabelChange({ isConflicting: true, currentLabels }))
      .toEqual({ add: CONFLICT_LABEL, remove: [], newlyDetected: true });
  });
});

describe('buildConflictComment', () => {
  it('names the branch when present and stays free of a literal undefined', () => {
    const body = buildConflictComment({ num: 1920, headRefName: 'lane/2412c-engine-tier-redteam-gate' });
    expect(body).toContain('lane/2412c-engine-tier-redteam-gate');
    expect(body).toContain('mergeable: CONFLICTING');
    expect(body).not.toContain('undefined');
  });

  it('still renders sensibly with no headRefName', () => {
    const body = buildConflictComment({ num: 1 });
    expect(body).not.toContain('undefined');
  });
});

describe('defaultListParkedPrs — argv shape (exec injected, no real gh call)', () => {
  it('queries open PRs with the narrow field set, no --repo when omitted', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return '[]'; };
    defaultListParkedPrs({ exec });
    expect(capturedArgv).toEqual(['pr', 'list', '--state', 'open', '--limit', '200',
      '--json', 'number,headRefName,mergeable,mergeStateStatus,labels']);
  });

  it('appends --repo when given', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return '[]'; };
    defaultListParkedPrs({ exec, repo: 'o/n' });
    expect(capturedArgv).toEqual(['pr', 'list', '--state', 'open', '--limit', '200',
      '--json', 'number,headRefName,mergeable,mergeStateStatus,labels', '--repo', 'o/n']);
  });
});

describe('watchParkedPrConflicts — IO shell over injected fakes (no gh process)', () => {
  const fakeProvider = () => {
    const calls = [];
    return {
      calls,
      ensureLabel: (repo, name, meta) => { calls.push(['ensureLabel', repo, name]); },
      setLabels: (repo, pr, spec) => { calls.push(['setLabels', repo, pr, spec]); },
      postComment: (repo, pr, body) => { calls.push(['postComment', repo, pr]); },
    };
  };

  it('labels + comments a newly-conflicting parked PR', () => {
    const provider = fakeProvider();
    const listPrs = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider });
    expect(results).toEqual([{ num: 1920, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: true }]);
    expect(provider.calls).toEqual([
      ['ensureLabel', 'o/n', CONFLICT_LABEL],
      ['setLabels', 'o/n', 1920, { add: CONFLICT_LABEL, remove: [] }],
      ['postComment', 'o/n', 1920],
    ]);
  });

  it('is idempotent — a second sweep on an already-labelled, still-conflicting PR makes zero gh calls', () => {
    const provider = fakeProvider();
    const listPrs = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }, { name: CONFLICT_LABEL }] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider });
    expect(results).toEqual([]);
    expect(provider.calls).toEqual([]);
  });

  it('clears the label (no comment) once the conflict resolves', () => {
    const provider = fakeProvider();
    const listPrs = () => [{ number: 1920, mergeable: 'MERGEABLE', labels: [{ name: 'review:human' }, { name: CONFLICT_LABEL }] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider });
    expect(results).toEqual([{ num: 1920, isConflicting: false, add: null, remove: [CONFLICT_LABEL], newlyDetected: false, commented: false }]);
    expect(provider.calls).toEqual([['setLabels', 'o/n', 1920, { add: undefined, remove: [CONFLICT_LABEL] }]]);
  });

  it('ignores a CONFLICTING PR with no park label — not this pass\'s scope', () => {
    const provider = fakeProvider();
    const listPrs = () => [{ number: 1853, mergeable: 'CONFLICTING', labels: [] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider });
    expect(results).toEqual([]);
    expect(provider.calls).toEqual([]);
  });

  it('dry-run: reports the plan, makes zero gh calls', () => {
    const provider = fakeProvider();
    const listPrs = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider, dryRun: true });
    expect(results).toEqual([{ num: 1920, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: false }]);
    expect(provider.calls).toEqual([]);
  });

  it('one PR\'s write failure does not stop the sweep from checking the rest', () => {
    const provider = fakeProvider();
    provider.setLabels = () => { throw new Error('boom'); };
    const listPrs = () => [
      { number: 1, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] },
      { number: 2, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] },
    ];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.error === 'boom')).toBe(true);
  });

  // xoh8fkw — live 2026-09-05: `repo` reaches `ensureLabel`/`setLabels`/`postComment` as a bare `null` when the
  // caller (the runner's default `runQuiet(..., ['sweep'])` invocation, with no `--repo`) never supplies one,
  // and `review-label-provider.mjs`'s own `GH_ARGV` builders splice `--repo, repo` unconditionally — so every
  // write failed `gh … got "null"` while the pass kept reporting a correct detection. `provider.currentRepo()`
  // must be consulted and its result used for every write when `repo` is omitted.
  it('resolves an omitted repo via provider.currentRepo() and uses it for every write (xoh8fkw)', () => {
    const provider = fakeProvider();
    provider.currentRepo = () => 'resolved/repo';
    const listPrs = () => [{ number: 1932, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] }];
    const results = watchParkedPrConflicts({ repo: null, listPrs, provider }); // no --repo given
    expect(results).toEqual([{ num: 1932, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: true }]);
    expect(provider.calls).toEqual([
      ['ensureLabel', 'resolved/repo', CONFLICT_LABEL],
      ['setLabels', 'resolved/repo', 1932, { add: CONFLICT_LABEL, remove: [] }],
      ['postComment', 'resolved/repo', 1932],
    ]);
  });

  it('CONFLICT_LABEL_META.description stays within GitHub\'s 100-char label-description cap (xoh8fkw)', () => {
    // The original 163-char text made every `gh label create` call fail `HTTP 422: description is too long`,
    // confirmed live 2026-09-05 — this is a hard external limit, not a style preference.
    expect(CONFLICT_LABEL_META.description.length).toBeLessThanOrEqual(100);
  });

  it('never calls currentRepo() when repo was already supplied, or when nothing needs a write', () => {
    let currentRepoCalls = 0;
    const provider = fakeProvider();
    provider.currentRepo = () => { currentRepoCalls += 1; return 'should-not-be-used'; };
    // Case 1: repo supplied — currentRepo must stay unconsulted.
    const listPrsA = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] }];
    watchParkedPrConflicts({ repo: 'o/n', listPrs: listPrsA, provider });
    expect(currentRepoCalls).toBe(0);
    // Case 2: repo omitted, but nothing to write (already labelled) — no gh repo view call either.
    const listPrsB = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }, { name: CONFLICT_LABEL }] }];
    watchParkedPrConflicts({ repo: null, listPrs: listPrsB, provider });
    expect(currentRepoCalls).toBe(0);
  });
});
