/**
 * @file parked-pr-conflict-watch.test.mjs — `#xw0odtv`. PURE logic tests for `isParkedConflictTarget` /
 * `planConflictLabelChange` + IO-shell tests over injected fakes (no `gh` process anywhere in this file),
 * mirroring `we:scripts/conveyor/__tests__/review-status-tag.test.mjs`'s own shape.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  CONFLICT_LABEL,
  CONFLICT_LABEL_META,
  isParkedConflictTarget,
  planConflictLabelChange,
  buildConflictComment,
  watchParkedPrConflicts,
  defaultListParkedPrs,
  isStatuteTierConflict,
  buildConflictFindingBody,
  defaultPostConflictFinding,
  defaultPostConflictStandDown,
  defaultPostConflictRearm,
  defaultListPrFiles,
  GH_FILES_GRAPHQL_CAP,
  isQueuedConflictTarget,
  QUEUED_CONFLICT_GRACE_MS,
  defaultConflictLabelAgeMs,
  isAppendOnlyStatuteChange,
  isAppendOnlyStatuteConflict,
  defaultListPrPatches,
} from '../parked-pr-conflict-watch.mjs';

// #xu2krte — `watchParkedPrConflicts` now routes every `newlyDetected` conflict to `postFinding` or
// `postStandDown` (real subprocess shells by default). Every test below that reaches `newlyDetected: true`
// injects a no-op fake for both, exactly as it already fakes `provider` — no real `node`/`gh` process runs from
// this file.
const noopRouting = () => ({ postFinding: () => {}, postStandDown: () => {} });

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
    const results = watchParkedPrConflicts({ repo: 'chalbert/web-everything', listPrs: () => [REAL_1920_SNAPSHOT], provider, ...noopRouting() });
    expect(results).toEqual([{ num: 1920, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: true, routedTo: 'reconcile-finding' }]);
    expect(calls[0]).toEqual(['ensureLabel', 'chalbert/web-everything', CONFLICT_LABEL]);
    expect(calls[1]).toEqual(['setLabels', 'chalbert/web-everything', 1920, { add: CONFLICT_LABEL, remove: [] }]);
    expect(calls[2][3]).toContain('lane/2412c-engine-tier-redteam-gate');
  });

  it('once the PR is rebased clean (as #1920 actually was, mid-investigation) the label self-clears', () => {
    const healed = { ...REAL_1920_SNAPSHOT, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED', labels: [...REAL_1920_SNAPSHOT.labels, { name: CONFLICT_LABEL }] };
    const calls = [];
    const provider = { setLabels: (repo, pr, spec) => calls.push(['setLabels', repo, pr, spec]) };
    const results = watchParkedPrConflicts({ repo: 'chalbert/web-everything', listPrs: () => [healed], provider });
    expect(results).toEqual([{ num: 1920, isConflicting: false, add: null, remove: [CONFLICT_LABEL], newlyDetected: false, newlyResolved: true, commented: false }]);
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
    expect(planConflictLabelChange({ isConflicting: false, isResolved: true, currentLabels: [{ name: CONFLICT_LABEL }] }))
      .toEqual({ add: null, remove: [CONFLICT_LABEL], newlyDetected: false, newlyResolved: true });
  });

  it('keeps the conflict marker until resolution is confirmed', () => {
    expect(planConflictLabelChange({ isConflicting: false, currentLabels: [CONFLICT_LABEL] }))
      .toEqual({ add: null, remove: [], newlyDetected: false });
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

  // #xu2krte — PR #1966's own review: the alert must never claim a different outcome than what Fork 2/4
  // actually routes this conflict to (previously a dispatchable conflict got the "not auto-rebased,
  // human/`/finish` only" text while ALSO being auto-dispatched to a fix agent in the same call).
  it('a dispatchable (non-statute-tier) conflict says a fix agent is being dispatched, and does NOT say "not auto"', () => {
    const body = buildConflictComment({ num: 1920 }, { isStatuteTier: false });
    expect(body).toMatch(/fix agent is being dispatched/i);
    expect(body).not.toMatch(/not auto-rebased|not auto-resolved|left as a \*\*judgment call/i);
  });

  it('a statute-tier conflict says it is a human/`/finish` judgment call, and does NOT say a fix agent is dispatched', () => {
    const body = buildConflictComment({ num: 1920 }, { isStatuteTier: true });
    expect(body).toMatch(/judgment call for a human/i);
    expect(body).not.toMatch(/fix agent is being dispatched/i);
  });

  it('defaults to the dispatchable wording when isStatuteTier is omitted (matches the common case)', () => {
    const body = buildConflictComment({ num: 1920 });
    expect(body).toMatch(/fix agent is being dispatched/i);
  });

  // #3383-append-only-statute — the watch passes `isStatuteTier: false` alongside `appendOnlyStatute: true` for
  // this case (it IS being dispatched, not stood down), so the comment must say so plainly rather than falling
  // into the generic "judgment call for a human" wording a bare isStatuteTier:true would otherwise pick.
  it('an append-only statute conflict says it is resolved mechanically and will be re-reviewed — no human-judgment wording', () => {
    const body = buildConflictComment({ num: 2505 }, { isStatuteTier: false, appendOnlyStatute: true });
    expect(body).toMatch(/resolved mechanically/i);
    expect(body).toMatch(/fresh independent review/i);
    expect(body).not.toMatch(/judgment call for a human/i);
  });
});

// PR #2531 review — a queued PR whose fresh conflict is append-only statute got the drain-grace wording ("the
// drain gets the first try… bounced in 30 minutes") while the watch dispatched it the same tick. Pin the EXACT
// next-step paragraph for every {isStatuteTier, deferredToDrain, appendOnlyStatute} combination, not just
// substring presence, so no combination can claim an outcome the router does not take (same drift class as
// PR #1966).
describe('buildConflictComment — next-step wording across the full routing combination space', () => {
  const STAND_DOWN = /^Left as a \*\*judgment call for a human or `\/finish`\*\*/;
  const DRAIN_GRACE = /^This PR is already approved\/queued, so the drain gets the first try .* still conflicting in 30 minutes/;
  const DISPATCH = /^A fix agent is being dispatched to resolve it \(`#xu2krte`\) — the SAME independent-review gate/;
  const APPEND_QUEUED = /^A fix agent is being dispatched now to resolve it \(`#xu2krte`\), with no drain grace period: .*The PR is bounced to `review:changes` and re-reviewed once resolved: the old approval does not cover the resolved diff\.$/;
  const APPEND_PARKED = /^A fix agent is being dispatched now to resolve it \(`#xu2krte`\)\. The SAME independent-review gate this PR is already parked behind still applies before anything lands\.$/;
  const cases = [
    // [isStatuteTier, deferredToDrain, appendOnlyStatute, expected next-step, append-only note shown]
    [false, false, false, DISPATCH, false],
    [false, true, false, DRAIN_GRACE, false],
    [true, false, false, STAND_DOWN, false],
    [true, true, false, STAND_DOWN, false],
    [false, false, true, APPEND_PARKED, true],
    [false, true, true, APPEND_QUEUED, true],
    [true, false, true, STAND_DOWN, false],
    [true, true, true, STAND_DOWN, false],
  ];
  it.each(cases)('isStatuteTier=%s deferredToDrain=%s appendOnlyStatute=%s', (isStatuteTier, deferredToDrain, appendOnlyStatute, expected, noteShown) => {
    const body = buildConflictComment({ num: 2505 }, { isStatuteTier, deferredToDrain, appendOnlyStatute });
    const paragraphs = body.split('\n\n');
    expect(paragraphs[2]).toMatch(expected);
    for (const other of [STAND_DOWN, DRAIN_GRACE, DISPATCH, APPEND_QUEUED, APPEND_PARKED].filter((r) => r !== expected)) {
      expect(paragraphs[2]).not.toMatch(other);
    }
    expect(/resolved mechanically/i.test(body)).toBe(noteShown);
    // Exactly one of: header, status line, next step, [append-only note], footer.
    expect(paragraphs).toHaveLength(noteShown ? 5 : 4);
  });
});

describe('defaultListParkedPrs — argv shape (exec injected, no real gh call)', () => {
  it('queries open PRs with the narrow field set, no --repo when omitted', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return '[]'; };
    defaultListParkedPrs({ exec });
    expect(capturedArgv).toEqual(['pr', 'list', '--state', 'open', '--limit', '200',
      '--json', 'number,headRefName,mergeable,mergeStateStatus,labels,files']);
  });

  it('appends --repo when given', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return '[]'; };
    defaultListParkedPrs({ exec, repo: 'o/n' });
    expect(capturedArgv).toEqual(['pr', 'list', '--state', 'open', '--limit', '200',
      '--json', 'number,headRefName,mergeable,mergeStateStatus,labels,files', '--repo', 'o/n']);
  });
});

describe('defaultListPrFiles — argv shape (exec injected, no real gh call) — #xgfzlj1', () => {
  it('paginates the REST files endpoint with an explicit repo', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return 'a.mjs\nb.mjs\n'; };
    const out = defaultListPrFiles({ number: 42, repo: 'o/n', exec });
    expect(capturedArgv).toEqual(['api', '--paginate', '--method', 'GET', '-F', 'per_page=100', 'repos/o/n/pulls/42/files', '--jq', '.[].filename']);
    expect(out).toEqual(['a.mjs', 'b.mjs']);
  });

  it("falls back to gh's own {owner}/{repo} template when repo is omitted", () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return ''; };
    defaultListPrFiles({ number: 7, exec });
    expect(capturedArgv[6]).toBe('repos/{owner}/{repo}/pulls/7/files');
  });

  it('returns an empty array for a PR touching no files (never blank/undefined entries)', () => {
    const exec = () => '\n\n';
    expect(defaultListPrFiles({ number: 1, repo: 'o/n', exec })).toEqual([]);
  });

  // Live 2026-09-23, confirmed against real PR #2514: `gh api` silently switches to POST whenever an `-f`/`-F`
  // parameter is present UNLESS `--method GET` is also passed, and `pulls/{n}/files` has no POST handler — every
  // call was failing 404 with no `--method` present. Because the queued-grace path in `watchParkedPrConflicts`
  // reads a `listPrFiles` failure as "assume statute-tier, stand down" (the safe direction), this silently meant
  // no approved/queued conflicting PR had ever actually been bounced (#2503/#2514/#2515 sat well past grace).
  it('#2514-post-vs-get — always passes --method GET whenever -F is present (never silently switches to POST)', () => {
    let capturedArgv;
    defaultListPrFiles({ number: 1, repo: 'o/n', exec: (cmd, argv) => { capturedArgv = argv; return ''; } });
    const fIndex = capturedArgv.indexOf('-F');
    expect(fIndex).toBeGreaterThan(-1);
    expect(capturedArgv).toContain('--method');
    expect(capturedArgv[capturedArgv.indexOf('--method') + 1]).toBe('GET');
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

  it('labels + comments a newly-conflicting parked PR, and dispatches it as a reconcile-finding bounce', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number, o.repo]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number, o.repo]),
    });
    expect(results).toEqual([{ num: 1920, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: true, routedTo: 'reconcile-finding' }]);
    expect(provider.calls).toEqual([
      ['ensureLabel', 'o/n', CONFLICT_LABEL],
      ['setLabels', 'o/n', 1920, { add: CONFLICT_LABEL, remove: [] }],
      ['postComment', 'o/n', 1920],
    ]);
    expect(routed).toEqual([['finding', 1920, 'o/n']]);
  });

  it('#xu2krte Fork 2 — a statute-tier file in the conflicting PR routes to stand-down, not reconcile-finding', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{
      number: 1921, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }],
      files: [{ path: 'docs/agent/platform-decisions.md' }],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', 1921]]);
  });

  // #xgfzlj1 — PR #1966's own independent review, security finding: `gh pr list --json files` resolves over
  // gh's own GraphQL query, hardcoded `files(first: 100)` with NO pagination (confirmed live against gh 2.95.0
  // / cli/cli@trunk's api/query_builder.go; cli/cli discussion #6930 / issue #5368 track it upstream as a bug).
  // A statute-tier file sitting past file #100 in a big PR would silently vanish from `pr.files` and this pass
  // would wrongly dispatch a fix agent at a conflict Fork 2 exists specifically to keep away from automation.
  it('#xgfzlj1 — a files array UNDER the gh 100-file cap is trusted as-is, no extra gh call', () => {
    const provider = fakeProvider();
    const routed = [];
    let listPrFilesCalls = 0;
    const listPrs = () => [{
      number: 1922, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }],
      files: Array.from({ length: GH_FILES_GRAPHQL_CAP - 1 }, (_, i) => ({ path: `scripts/f${i}.mjs` })),
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrFiles: () => { listPrFilesCalls += 1; return []; },
    });
    expect(results[0].routedTo).toBe('reconcile-finding');
    expect(listPrFilesCalls).toBe(0);
  });

  it('#xgfzlj1 — a files array AT the gh 100-file cap is untrusted: re-fetches the complete list and finds the statute-tier file past the truncation boundary', () => {
    const provider = fakeProvider();
    const routed = [];
    let listPrFilesArgs;
    const truncated = Array.from({ length: GH_FILES_GRAPHQL_CAP }, (_, i) => ({ path: `scripts/f${i}.mjs` }));
    const listPrs = () => [{ number: 1923, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }], files: truncated }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrFiles: (o) => { listPrFilesArgs = o; return [...truncated.map((f) => f.path), 'docs/agent/platform-decisions.md']; },
    });
    expect(listPrFilesArgs).toEqual({ number: 1923, repo: 'o/n' });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', 1923]]);
  });

  it('#xgfzlj1 — the verified re-fetch clearing the PR (no statute file in the complete list) still dispatches normally', () => {
    const provider = fakeProvider();
    const routed = [];
    const truncated = Array.from({ length: GH_FILES_GRAPHQL_CAP }, (_, i) => ({ path: `scripts/f${i}.mjs` }));
    const listPrs = () => [{ number: 1925, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }], files: truncated }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrFiles: () => truncated.map((f) => f.path).concat(['scripts/f100.mjs']), // one more ordinary file, still no statute path
    });
    expect(results[0].routedTo).toBe('reconcile-finding');
  });

  it('#xgfzlj1 — the re-fetch itself failing fails OVER-cautious (stand-down), never silently trusts the truncated list', () => {
    const provider = fakeProvider();
    const routed = [];
    const truncated = Array.from({ length: GH_FILES_GRAPHQL_CAP }, (_, i) => ({ path: `scripts/f${i}.mjs` })); // no statute file at all
    const listPrs = () => [{ number: 1924, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }], files: truncated }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrFiles: () => { throw new Error('gh api failed'); },
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', 1924]]);
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
    expect(results).toEqual([{ num: 1920, isConflicting: false, add: null, remove: [CONFLICT_LABEL], newlyDetected: false, newlyResolved: true, commented: false }]);
    expect(provider.calls).toEqual([['setLabels', 'o/n', 1920, { add: undefined, remove: [CONFLICT_LABEL] }]]);
  });

  it('rearms a resolved conflict still on review:changes and removes the conflict label without fresh-conflict routing', () => {
    const provider = fakeProvider();
    const routed = [];
    const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider,
      postRearm: (o) => routed.push(['rearm', o.pr.number, o.repo]),
      postFinding: (o) => routed.push(['finding', o.pr.number, o.repo]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number, o.repo]),
    });
    expect(routed).toEqual([['rearm', 1920, 'o/n']]);
    expect(provider.calls).toEqual([['setLabels', 'o/n', 1920, { add: undefined, remove: [CONFLICT_LABEL] }]]);
    expect(results).toEqual([{
      num: 1920, isConflicting: false, add: null, remove: [CONFLICT_LABEL], newlyDetected: false,
      newlyResolved: true, commented: false, routedTo: 'rearm-review',
    }]);
  });

  it('only removes the conflict label when a resolved PR has no review:changes bounce', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{ number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }] }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postRearm: (o) => routed.push(['rearm', o.pr.number]),
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
    });
    expect(routed).toEqual([]);
    expect(provider.calls).toEqual([['setLabels', 'o/n', 1920, { add: undefined, remove: [CONFLICT_LABEL] }]]);
    expect(results[0].newlyResolved).toBe(true);
    expect(results[0].routedTo).toBeUndefined();
  });

  it('dry-run: a resolved review:changes conflict makes no writes or rearm call', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{ number: 1920, mergeable: 'MERGEABLE', labels: [CONFLICT_LABEL, 'review:changes'] }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, dryRun: true,
      postRearm: (o) => routed.push(o),
    });
    expect(results[0].newlyResolved).toBe(true);
    expect(provider.calls).toEqual([]);
    expect(routed).toEqual([]);
  });

  it('records a rearm failure and continues rearming the remaining resolved PRs', () => {
    const provider = fakeProvider();
    provider.currentRepo = () => 'resolved/repo';
    const routed = [];
    const listPrs = () => [1, 2].map((number) => ({ number, mergeable: 'MERGEABLE', labels: [CONFLICT_LABEL, 'review:changes'] }));
    const results = watchParkedPrConflicts({
      listPrs, provider,
      postRearm: (o) => {
        routed.push([o.pr.number, o.repo]);
        if (o.pr.number === 1) throw new Error('rearm failed\nmore detail');
      },
    });
    expect(routed).toEqual([[1, 'resolved/repo'], [2, 'resolved/repo']]);
    expect(results[0].error).toBe('rearm failed');
    expect(results[0].routedTo).toBeUndefined();
    expect(results[1].routedTo).toBe('rearm-review');
  });

  it.each(['UNKNOWN', undefined, 'CONFLICTING'])('does not rearm or lose the marker while mergeable is %s', (mergeable) => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{ number: 1920, mergeable, labels: [CONFLICT_LABEL, 'review:changes'] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider, postRearm: (o) => routed.push(o) });
    expect(results).toEqual([]);
    expect(provider.calls).toEqual([]);
    expect(routed).toEqual([]);
  });

  it('does not rearm an unflagged review:changes PR even when GitHub reports MERGEABLE', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{ number: 1920, mergeable: 'MERGEABLE', labels: ['review:changes'] }];
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider, postRearm: (o) => routed.push(o) });
    expect(results).toEqual([]);
    expect(provider.calls).toEqual([]);
    expect(routed).toEqual([]);
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
    const results = watchParkedPrConflicts({ repo: null, listPrs, provider, ...noopRouting() }); // no --repo given
    expect(results).toEqual([{ num: 1932, isConflicting: true, add: CONFLICT_LABEL, remove: [], newlyDetected: true, commented: true, routedTo: 'reconcile-finding' }]);
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
    watchParkedPrConflicts({ repo: 'o/n', listPrs: listPrsA, provider, ...noopRouting() });
    expect(currentRepoCalls).toBe(0);
    // Case 2: repo omitted, but nothing to write (already labelled) — no gh repo view call either.
    const listPrsB = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }, { name: CONFLICT_LABEL }] }];
    watchParkedPrConflicts({ repo: null, listPrs: listPrsB, provider, ...noopRouting() });
    expect(currentRepoCalls).toBe(0);
  });
});

// #xu2krte Fork 2 — the content-based statute-tier exception.
describe('isStatuteTierConflict', () => {
  it('true: the conflicting PR touches a statute-tier doc', () => {
    expect(isStatuteTierConflict([{ path: 'docs/agent/platform-decisions.md' }])).toBe(true);
  });

  it('true: a bare-string files array (tolerated shape)', () => {
    expect(isStatuteTierConflict(['docs/agent/platform-decisions.md'])).toBe(true);
  });

  it('false: an ordinary code file', () => {
    expect(isStatuteTierConflict([{ path: 'scripts/conveyor/reconcile-core.mjs' }])).toBe(false);
  });

  it('false: no files at all', () => {
    expect(isStatuteTierConflict([])).toBe(false);
    expect(isStatuteTierConflict(undefined)).toBe(false);
  });
});

describe('buildConflictFindingBody', () => {
  it('names the PR, the branch, and says resolving the conflict IS the task', () => {
    const body = buildConflictFindingBody({ num: 1920, headRefName: 'lane/2412c-engine-tier-redteam-gate' });
    expect(body).toContain('PR #1920');
    expect(body).toContain('lane/2412c-engine-tier-redteam-gate');
    expect(body).toMatch(/Resolving the conflict IS the task/);
    expect(body).not.toContain('undefined');
  });

  it('#3383-append-only-statute — adds the explicit keep-main-reinsert-new-sections instruction when flagged', () => {
    const body = buildConflictFindingBody({ num: 2505 }, { appendOnlyStatute: true });
    expect(body).toMatch(/Append-only statute conflict/);
    expect(body).toMatch(/keeping `main`'s version of the file unchanged/);
    expect(body).toMatch(/re-inserting this PR's new `###` section/);
    expect(body).toMatch(/Change no existing rule text/);
  });

  it('omits the append-only instruction by default', () => {
    const body = buildConflictFindingBody({ num: 2505 });
    expect(body).not.toMatch(/Append-only statute conflict/);
  });
});

// #3383-append-only-statute — live 2026-09-23, PR #2505: a concurrent statute-tier PR conflicts with `main` ONLY
// because both sides independently appended a separate new `### ` section at the same insertion point. This is
// mechanically resolvable (keep both); a real overlapping edit to existing rule text is not.
describe('isAppendOnlyStatuteChange', () => {
  // The exact shape PR #2505 collided in: the tail of `## The standing rules`, right before the `---` that
  // precedes `## Standing process & method rules` in docs/agent/platform-decisions.md.
  const real2505Shape = [
    '@@ -5340,6 +5340,11 @@ found in the #3717 build, not to a new principle.',
    ' [#3801](/backlog/3801-decision-review-the-five-choices-the-3717-dispatch-routing-b/).',
    ' ',
    '+### A new statute rule appended by this PR {#new-rule-anchor}',
    '+',
    '+The body of the newly-ratified rule.',
    '+',
    ' ---',
    ' ',
    ' ## Standing process & method rules (codified in the topical docs — pointers)',
  ].join('\n');

  it('true: a pure section insert right before the `---` boundary (the real PR #2505 shape)', () => {
    expect(isAppendOnlyStatuteChange(real2505Shape)).toBe(true);
  });

  it('true: a section insert whose next context is a `## ` heading (no `---` in between)', () => {
    const patch = [
      '@@ -1,3 +1,7 @@',
      ' last line of the previous section',
      ' ',
      '+### Freshly appended rule {#anchor}',
      '+',
      '+Body.',
      '+',
      ' ## The next top-level section',
    ].join('\n');
    expect(isAppendOnlyStatuteChange(patch)).toBe(true);
  });

  it('false: a line added inside an existing rule\'s body (not a whole-section insert)', () => {
    const patch = [
      '@@ -10,3 +10,4 @@',
      ' existing sentence one.',
      '+a sentence spliced into the middle of the rule.',
      ' existing sentence two.',
    ].join('\n');
    expect(isAppendOnlyStatuteChange(patch)).toBe(false);
  });

  it('false: any deletion at all, even alongside an otherwise-valid section insert', () => {
    const patch = [
      '@@ -10,4 +10,8 @@',
      ' context',
      '-an old line being removed',
      '+### New Rule {#x}',
      '+',
      '+body',
      '+',
      ' ---',
    ].join('\n');
    expect(isAppendOnlyStatuteChange(patch)).toBe(false);
  });

  it('false: a heading insert not at a section boundary (followed by ordinary body text)', () => {
    const patch = [
      '@@ -1,3 +1,6 @@',
      ' context before',
      '+### New Rule {#x}',
      '+body',
      ' some ordinary paragraph text, not a heading or separator',
    ].join('\n');
    expect(isAppendOnlyStatuteChange(patch)).toBe(false);
  });

  it('false: malformed / unparseable input', () => {
    expect(isAppendOnlyStatuteChange('not a diff at all')).toBe(false);
    expect(isAppendOnlyStatuteChange('')).toBe(false);
    expect(isAppendOnlyStatuteChange(undefined)).toBe(false);
    expect(isAppendOnlyStatuteChange(null)).toBe(false);
  });

  it('false: an add-run that trims to nothing (only blank/--- lines added)', () => {
    const patch = ['@@ -1,2 +1,4 @@', ' context', '+', '+---', ' more context'].join('\n');
    expect(isAppendOnlyStatuteChange(patch)).toBe(false);
  });

  it('false: no additions at all (nothing to prove append-only about)', () => {
    const patch = ['@@ -1,2 +1,2 @@', ' unchanged one', ' unchanged two'].join('\n');
    expect(isAppendOnlyStatuteChange(patch)).toBe(false);
  });
});

describe('isAppendOnlyStatuteConflict', () => {
  const goodPatch = [
    '@@ -1,3 +1,7 @@',
    ' last line of the previous section',
    ' ',
    '+### Freshly appended rule {#anchor}',
    '+',
    '+Body.',
    '+',
    ' ---',
  ].join('\n');

  it('true: every statute-tier file is a statute .md path with an append-only patch', () => {
    expect(isAppendOnlyStatuteConflict(
      ['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': goodPatch },
    )).toBe(true);
  });

  it('false: a declarative-leash file is present — never append-only-eligible', () => {
    expect(isAppendOnlyStatuteConflict(
      ['docs/agent/platform-decisions.md', 'scripts/lib/review-policy.contract.json'],
      { 'docs/agent/platform-decisions.md': goodPatch, 'scripts/lib/review-policy.contract.json': goodPatch },
    )).toBe(false);
  });

  it('false: missing patch entry for a statute file (fetch/parse failure) — safe direction', () => {
    expect(isAppendOnlyStatuteConflict(['docs/agent/platform-decisions.md'], {})).toBe(false);
  });

  it('false: no statute-tier files at all', () => {
    expect(isAppendOnlyStatuteConflict([], { 'docs/agent/platform-decisions.md': goodPatch })).toBe(false);
  });
});

describe('defaultListPrPatches — argv shape + @tsv round-trip (exec injected, no real gh call)', () => {
  it('paginates the REST files endpoint projecting filename + patch via @tsv', () => {
    let capturedArgv;
    const exec = () => '';
    defaultListPrPatches({ number: 42, repo: 'o/n', exec: (cmd, argv) => { capturedArgv = argv; return ''; } });
    expect(capturedArgv).toEqual(['api', '--paginate', '--method', 'GET', '-F', 'per_page=100', 'repos/o/n/pulls/42/files',
      '--jq', '.[] | [.filename, (.patch // "")] | @tsv']);
  });

  it("falls back to gh's own {owner}/{repo} template when repo is omitted", () => {
    let capturedArgv;
    defaultListPrPatches({ number: 7, exec: (cmd, argv) => { capturedArgv = argv; return ''; } });
    expect(capturedArgv[6]).toBe('repos/{owner}/{repo}/pulls/7/files');
  });

  // Same `-F` → silent-POST hazard {@link defaultListPrFiles}'s own regression test pins — this call site copied
  // its `-F 'per_page=100'` shape, so it inherits the same 404-on-POST failure without the same guard.
  it('#2514-post-vs-get — always passes --method GET whenever -F is present (never silently switches to POST)', () => {
    let capturedArgv;
    defaultListPrPatches({ number: 1, repo: 'o/n', exec: (cmd, argv) => { capturedArgv = argv; return ''; } });
    expect(capturedArgv.indexOf('-F')).toBeGreaterThan(-1);
    expect(capturedArgv).toContain('--method');
    expect(capturedArgv[capturedArgv.indexOf('--method') + 1]).toBe('GET');
  });

  it('recovers a multi-line patch that @tsv escaped onto one output line, per file', () => {
    // jq's @tsv escapes each field's own tabs/newlines/backslashes — this is what that looks like on the wire.
    const wire = 'a.md\t@@ -1,1 +1,2 @@\\n+line one\\n+line two\nb.md\t';
    const out = defaultListPrPatches({ number: 1, repo: 'o/n', exec: () => wire });
    expect(out).toEqual({ 'a.md': '@@ -1,1 +1,2 @@\n+line one\n+line two', 'b.md': '' });
  });

  it('an empty listing yields an empty map', () => {
    expect(defaultListPrPatches({ number: 1, repo: 'o/n', exec: () => '\n\n' })).toEqual({});
  });
});

describe('defaultPostConflictFinding / defaultPostConflictStandDown / defaultPostConflictRearm — argv shape (exec injected, no real gh/node)', () => {
  it('shells rearm-review.mjs with the PR, actor and repo through node', () => {
    const calls = [];
    const exec = (cmd, argv, options) => { calls.push([cmd, argv, options]); return ''; };
    defaultPostConflictRearm({ pr: { number: 1920 }, repo: 'o/n', exec });
    expect(calls).toEqual([['node', [
      expect.stringMatching(/\/scripts\/conveyor\/rearm-review\.mjs$/), '1920',
      '--actor=parked-pr-conflict-watch (conflict resolved)', '--repo=o/n',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }]]);
  });

  it('shells reconcile-finding.mjs with a --body-file, --agent and --repo', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return ''; };
    defaultPostConflictFinding({ pr: { number: 1920, headRefName: 'lane/x' }, repo: 'o/n', exec });
    expect(capturedArgv[0]).toMatch(/reconcile-finding\.mjs$/);
    expect(capturedArgv[1]).toBe('1920');
    expect(capturedArgv.some((a) => a.startsWith('--body-file='))).toBe(true);
    expect(capturedArgv).toContain('--agent=parked-pr-conflict-watch');
    expect(capturedArgv).toContain('--repo=o/n');
  });

  it('shells stand-down.mjs with --reason=conflict and --repo', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return ''; };
    defaultPostConflictStandDown({ pr: { number: 1921 }, repo: 'o/n', exec });
    expect(capturedArgv[0]).toMatch(/stand-down\.mjs$/);
    expect(capturedArgv[1]).toBe('1921');
    expect(capturedArgv).toContain('--reason=conflict');
    expect(capturedArgv).toContain('--repo=o/n');
  });
});


vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal(), execFileSync: vi.fn(),
}));
vi.mock('../../lib/gh-throttle.mjs', async () => {
  const { execFileSync } = await import('node:child_process');
  return {
    execFileSyncThrottled: vi.fn((file, args, opts) => execFileSync(file, args, opts)),
    runGhSync: vi.fn((args, opts) => execFileSync('gh', args, opts)),
  };
});
vi.mock('../../lib/write-all-sync.mjs', () => ({ writeAllSync: vi.fn(), writeLineSync: vi.fn() }));

import { prFileContract } from './pr-file-test-helpers.mjs';
prFileContract({
  name: 'parked-pr-conflict-watch', load: () => import('../parked-pr-conflict-watch.mjs'),
  reader: 'defaultListParkedPrs', run: 'watchParkedPrConflicts',
  fields: 'number,headRefName,mergeable,mergeStateStatus,labels,files',
});


// ── x832e2v — APPROVED/queued PRs that drift into a conflict (live 2026-09-23: #2503, #2505, #2514, #2515) ──────
describe('approved PRs that drift into a conflict (x832e2v)', () => {
  const L = (...n) => n.map((name) => ({ name }));
  const fakeProvider = () => {
    const calls = [];
    return {
      calls,
      ensureLabel: (repo, name) => { calls.push(['ensureLabel', repo, name]); },
      setLabels: (repo, pr, spec) => { calls.push(['setLabels', repo, pr, spec]); },
      postComment: (repo, pr, body) => { calls.push(['postComment', repo, pr, body]); },
    };
  };

  it('isQueuedConflictTarget: accepted or ready-to-merge + CONFLICTING, never a PR the parked path owns', () => {
    expect(isQueuedConflictTarget({ mergeable: 'CONFLICTING', labels: L('review:accepted') })).toBe(true);
    expect(isQueuedConflictTarget({ mergeable: 'CONFLICTING', labels: L('ready-to-merge') })).toBe(true);
    expect(isQueuedConflictTarget({ mergeable: 'MERGEABLE', labels: L('review:accepted') })).toBe(false);
    expect(isQueuedConflictTarget({ mergeable: 'CONFLICTING', labels: L('review:pending') })).toBe(false);
    expect(isQueuedConflictTarget({ mergeable: 'CONFLICTING', labels: L('review:accepted', 'review:human') })).toBe(false);
    expect(isQueuedConflictTarget({ mergeable: 'CONFLICTING', labels: L('checking') })).toBe(false);
  });

  it('first sighting: labelled + commented (drain goes first), NOT bounced yet', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', 'ready-to-merge') }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
    });
    expect(r.routedTo).toBe('deferred-to-drain');
    expect(routed).toEqual([]);
    const comment = provider.calls.find((c) => c[0] === 'postComment')[3];
    expect(comment).toContain('drain gets the first try');
    expect(comment).toContain(`${QUEUED_CONFLICT_GRACE_MS / 60000} minutes`);
  });

  it('already flagged, grace NOT yet elapsed → nothing happens', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS - 1000, listPrFiles: () => [],
    });
    expect(results).toEqual([]);
    expect(routed).toEqual([]);
    expect(provider.calls).toEqual([]);
  });

  it('already flagged, grace elapsed → bounced to a fix agent (the bounce itself strips the approval)', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, listPrFiles: () => [{ path: 'scripts/x.mjs' }],
    });
    expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
    expect(routed).toEqual([2514]);
    expect(provider.calls).toEqual([]); // no second label write, no second comment
  });

  it('grace elapsed but label age unknown → waits (never bounces on a guess)', () => {
    const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('ready-to-merge', CONFLICT_LABEL) }];
    watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(), postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => null, listPrFiles: () => [],
    });
    expect(routed).toEqual([]);
  });

  it('statute-tier: handed to a human at first sighting, and NEVER re-posted by the grace path', () => {
    const routed = [];
    const statuteFiles = [{ path: 'docs/agent/platform-decisions.md' }];
    const first = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [{ number: 2505, mergeable: 'CONFLICTING', labels: L('review:accepted'), files: statuteFiles }],
      provider: fakeProvider(), postFinding: () => routed.push('finding'), postStandDown: () => routed.push('sd'),
    });
    expect(first[0].routedTo).toBe('stand-down');
    const later = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [{ number: 2505, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }],
      provider: fakeProvider(), postFinding: () => routed.push('finding'), postStandDown: () => routed.push('sd'),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS * 2, listPrFiles: () => statuteFiles,
    });
    expect(later).toEqual([]);
    expect(routed).toEqual(['sd']);
  });

  it('healed by the drain within the grace window → label removed, nothing bounced', () => {
    const provider = fakeProvider(); const routed = [];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [{ number: 2514, mergeable: 'MERGEABLE', labels: L('review:accepted', CONFLICT_LABEL) }],
      provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {}, postRearm: () => routed.push('rearm'),
    });
    expect(r.newlyResolved).toBe(true);
    expect(routed).toEqual([]); // no review:changes to rearm — the approval stands
    expect(provider.calls).toEqual([['setLabels', 'o/n', 2514, { add: undefined, remove: [CONFLICT_LABEL] }]]);
  });

  it('defaultConflictLabelAgeMs reads the LATEST labeled event across pages; unparseable → null', () => {
    const now = Date.parse('2026-09-23T16:00:00Z');
    const exec = () => 'null\n2026-09-23T15:00:00Z\n2026-09-23T15:20:00Z\n';
    expect(defaultConflictLabelAgeMs({ pr: { number: 1 }, repo: 'o/n', exec, now })).toBe(40 * 60 * 1000);
    expect(defaultConflictLabelAgeMs({ pr: { number: 1 }, repo: 'o/n', exec: () => 'null\n', now })).toBeNull();
    expect(defaultConflictLabelAgeMs({ pr: { number: 1 }, repo: 'o/n', exec: () => { throw new Error('x'); }, now })).toBeNull();
  });
});

// #3383-append-only-statute — live 2026-09-23, PR #2505: routing-level coverage over the append-only exception,
// via injected fakes (no real gh/node process).
describe('watchParkedPrConflicts — the append-only statute exception (#3383)', () => {
  const fakeProvider = () => {
    const calls = [];
    return {
      calls,
      ensureLabel: (repo, name) => calls.push(['ensureLabel', repo, name]),
      setLabels: (repo, pr, spec) => calls.push(['setLabels', repo, pr, spec]),
      postComment: (repo, pr, body) => calls.push(['postComment', repo, pr, body]),
    };
  };
  const goodPatch = [
    '@@ -1,3 +1,7 @@',
    ' last line of the previous section',
    ' ',
    '+### Freshly appended rule {#anchor}',
    '+',
    '+Body.',
    '+',
    ' ---',
  ].join('\n');

  it('an append-only statute conflict is dispatched to the finding path, not stood down, with the resolve instruction', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{
      number: 2505, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }],
      files: [{ path: 'docs/agent/platform-decisions.md' }],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number, o.appendOnlyStatute]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': goodPatch }),
    });
    expect(results[0].routedTo).toBe('reconcile-finding (append-only statute)');
    expect(routed).toEqual([['finding', 2505, true]]);
    const comment = provider.calls.find((c) => c[0] === 'postComment')[3];
    expect(comment).toMatch(/resolved mechanically/i);
  });

  it('end-to-end: defaultPostConflictFinding actually writes the resolve instruction into the body file it shells', () => {
    let capturedArgv;
    const writtenBodies = [];
    // Exercise the real defaultPostConflictFinding (not a test stub) so the body-file plumbing itself is covered,
    // not just buildConflictFindingBody in isolation.
    const exec = (cmd, argv) => {
      capturedArgv = argv;
      const bodyFileArg = argv.find((a) => a.startsWith('--body-file='));
      writtenBodies.push(readFileSync(bodyFileArg.slice('--body-file='.length), 'utf8'));
      return '';
    };
    defaultPostConflictFinding({ pr: { number: 2505 }, repo: 'o/n', exec, appendOnlyStatute: true });
    expect(capturedArgv[0]).toMatch(/reconcile-finding\.mjs$/);
    expect(writtenBodies[0]).toMatch(/Append-only statute conflict/);
  });

  it('mixed conflict — a statute file that is NOT append-only alongside one that is — stands down (fails closed)', () => {
    const provider = fakeProvider();
    const routed = [];
    const badPatch = ['@@ -1,3 +1,3 @@', ' context', '-old line', '+new line'].join('\n');
    const listPrs = () => [{
      number: 2506, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }],
      files: [{ path: 'docs/agent/platform-decisions.md' }, { path: 'docs/agent/some-other-statute.md' }],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrPatches: () => ({
        'docs/agent/platform-decisions.md': goodPatch,
        'docs/agent/some-other-statute.md': badPatch,
      }),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', 2506]]);
  });

  it('a declarative-leash (code/contract) file in the conflict always stands down, even with an append-only-shaped statute patch alongside it', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{
      number: 2507, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }],
      files: [
        { path: 'docs/agent/platform-decisions.md' },
        { path: 'scripts/lib/review-policy.contract.json' },
      ],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrPatches: () => ({
        'docs/agent/platform-decisions.md': goodPatch,
        'scripts/lib/review-policy.contract.json': goodPatch,
      }),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', 2507]]);
  });

  it('a patch-fetch failure stands down — never trusts an unfetched patch as append-only', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{
      number: 2508, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }],
      files: [{ path: 'docs/agent/platform-decisions.md' }],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrPatches: () => { throw new Error('gh api failed'); },
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', 2508]]);
  });

  it('an append-only statute conflict on an already-QUEUED (approved) PR is dispatched at once, bypassing the drain grace', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{
      number: 2505, mergeable: 'CONFLICTING', labels: [{ name: 'review:accepted' }],
      files: [{ path: 'docs/agent/platform-decisions.md' }],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': goodPatch }),
    });
    expect(results[0].routedTo).toBe('reconcile-finding (append-only statute)');
    expect(routed).toEqual([['finding', 2505]]);
    // PR #2531 review — the alert posted in the same tick must not promise a drain grace this route bypasses.
    const comment = provider.calls.find((c) => c[0] === 'postComment')?.[3];
    expect(comment).toMatch(/dispatched now .* no drain grace period/);
    expect(comment).not.toMatch(/drain gets the first try|still conflicting in \d+ minutes/);
  });

  it('an ordinary non-statute conflict never pays for a patch fetch (listPrPatches uncalled)', () => {
    let called = false;
    const listPrs = () => [{ number: 1920, mergeable: 'CONFLICTING', labels: [{ name: 'review:human' }] }];
    watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(),
      postFinding: () => {}, postStandDown: () => {},
      listPrPatches: () => { called = true; return {}; },
    });
    expect(called).toBe(false);
  });
});
