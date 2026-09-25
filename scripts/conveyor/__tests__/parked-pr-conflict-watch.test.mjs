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
  defaultListPrComments,
  parseHunkOldRanges,
  hunkRangesOverlap,
  doesConflictOverlapMainEdits,
  findWatcherStandDownComment,
  buildSupersedeStandDownComment,
  defaultListMainStatutePatchesSinceMergeBase,
  COMPARE_FILES_CAP,
  defaultComputeConflictDisposition,
  CONFLICT_RETRY_WINDOW_MS,
  CONFLICT_ALERT_MARKER_RE,
  hasRecentConflictAlertComment,
  latestConflictAlertCreatedAtMs,
  hasRecentConflictFindingComment,
} from '../parked-pr-conflict-watch.mjs';
import {
  STAND_DOWN_MARKER, WATCHER_STAND_DOWN_ACTOR, SUPERSEDE_STAND_DOWN_MARKER, buildStandDownComment,
} from '../stand-down.mjs';
import { mintSessionSlug } from '../session-slug.mjs';

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
    // #4118 — the label now applies LAST, only once the alert + dispatch are known-good (see this file's own
    // header, "IDEMPOTENCY, NO SEPARATE STORE" section's #4118 update, and `CONFLICT_RETRY_WINDOW_MS`).
    expect(calls[0][0]).toBe('postComment');
    expect(calls[0][3]).toContain('lane/2412c-engine-tier-redteam-gate');
    expect(calls[1]).toEqual(['ensureLabel', 'chalbert/web-everything', CONFLICT_LABEL]);
    expect(calls[2]).toEqual(['setLabels', 'chalbert/web-everything', 1920, { add: CONFLICT_LABEL, remove: [] }]);
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
      '--json', 'number,headRefName,baseRefName,mergeable,mergeStateStatus,labels,files']);
  });

  it('appends --repo when given', () => {
    let capturedArgv;
    const exec = (cmd, argv) => { capturedArgv = argv; return '[]'; };
    defaultListParkedPrs({ exec, repo: 'o/n' });
    expect(capturedArgv).toEqual(['pr', 'list', '--state', 'open', '--limit', '200',
      '--json', 'number,headRefName,baseRefName,mergeable,mergeStateStatus,labels,files', '--repo', 'o/n']);
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
    // #4118 — the alert posts first (marker-deduped), then the dispatch, then the label LAST — the label's own
    // presence no longer certifies "the alert/dispatch already happened" until they actually have.
    expect(provider.calls).toEqual([
      ['postComment', 'o/n', 1920],
      ['ensureLabel', 'o/n', CONFLICT_LABEL],
      ['setLabels', 'o/n', 1920, { add: CONFLICT_LABEL, remove: [] }],
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

  // #4118 finding (c) — adversarial review: "it hands a PR back for review (rearm) while a fixer is still live
  // on it". A bare `mergeable: MERGEABLE` read cannot rule out a fix-agent session still mid-push on this exact
  // lane (it could be resolving something else on the same PR); rearming underneath it races the review against
  // work that has not actually landed yet.
  describe('#4118 (c) — never rearm while a fix agent is still live on this exact PR', () => {
    it('defers the rearm (and leaves the CONFLICT_LABEL on) while a live fix session is bound to this PR by name', () => {
      const provider = fakeProvider();
      const routed = [];
      const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
      const liveFixAgent = { name: mintSessionSlug({ kind: 'fix', id: 1920, repo: 'we' }), state: 'working', pid: 4242, pidAlive: true };
      const results = watchParkedPrConflicts({
        repo: 'chalbert/web-everything', listPrs: () => [pr], provider,
        postRearm: (o) => routed.push(['rearm', o.pr.number]),
        listAgents: () => [liveFixAgent],
      });
      expect(routed).toEqual([]); // never rearmed while the fixer is live
      // Deliberately NOT setLabels'd either — removing the CONFLICT_LABEL now would make `planConflictLabelChange`
      // stop emitting `newlyResolved` next sweep, permanently losing the rearm this fixer is still owed.
      expect(provider.calls).toEqual([]);
      expect(results[0].routedTo).toBe('rearm-deferred (fix agent still live)');
    });

    it('a `blocked` (stuck) fix session ALSO defers the rearm — not just an actively working one', () => {
      const provider = fakeProvider();
      const routed = [];
      const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
      const stuckFixAgent = { name: mintSessionSlug({ kind: 'fix', id: 1920, repo: 'we' }), state: 'blocked', pid: 4242, pidAlive: true };
      const results = watchParkedPrConflicts({
        repo: 'chalbert/web-everything', listPrs: () => [pr], provider,
        postRearm: (o) => routed.push(['rearm', o.pr.number]),
        listAgents: () => [stuckFixAgent],
      });
      expect(routed).toEqual([]);
      expect(results[0].routedTo).toBe('rearm-deferred (fix agent still live)');
    });

    it('once the fix session is gone (or finished), the very next sweep rearms normally — nothing lost', () => {
      const provider = fakeProvider();
      const routed = [];
      const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
      const results = watchParkedPrConflicts({
        repo: 'chalbert/web-everything', listPrs: () => [pr], provider,
        postRearm: (o) => routed.push(['rearm', o.pr.number]),
        listAgents: () => [], // no live agents at all
      });
      expect(routed).toEqual([['rearm', 1920]]);
      expect(provider.calls).toEqual([['setLabels', 'chalbert/web-everything', 1920, { add: undefined, remove: [CONFLICT_LABEL] }]]);
      expect(results[0].routedTo).toBe('rearm-review');
    });

    it('a DONE fix session (finished, `claude agents` just has not pruned the row yet) does not defer the rearm', () => {
      const provider = fakeProvider();
      const routed = [];
      const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
      const doneFixAgent = { name: mintSessionSlug({ kind: 'fix', id: 1920, repo: 'we' }), state: 'done', pid: 4242, pidAlive: true };
      const results = watchParkedPrConflicts({
        repo: 'chalbert/web-everything', listPrs: () => [pr], provider,
        postRearm: (o) => routed.push(['rearm', o.pr.number]),
        listAgents: () => [doneFixAgent],
      });
      expect(routed).toEqual([['rearm', 1920]]);
      expect(results[0].routedTo).toBe('rearm-review');
    });

    it('a live fix session bound to a DIFFERENT PR never defers this one\'s rearm', () => {
      const provider = fakeProvider();
      const routed = [];
      const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
      const otherPrFixAgent = { name: mintSessionSlug({ kind: 'fix', id: 4242, repo: 'we' }), state: 'working', pidAlive: true };
      const results = watchParkedPrConflicts({
        repo: 'chalbert/web-everything', listPrs: () => [pr], provider,
        postRearm: (o) => routed.push(['rearm', o.pr.number]),
        listAgents: () => [otherPrFixAgent],
      });
      expect(routed).toEqual([['rearm', 1920]]);
    });

    it('a listAgents failure fails TOWARD completing the rearm, never toward eternal paralysis', () => {
      const provider = fakeProvider();
      const routed = [];
      const pr = { number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
      const results = watchParkedPrConflicts({
        repo: 'chalbert/web-everything', listPrs: () => [pr], provider,
        postRearm: (o) => routed.push(['rearm', o.pr.number]),
        listAgents: () => { throw new Error('claude agents --json failed'); },
      });
      expect(routed).toEqual([['rearm', 1920]]);
      expect(results[0].routedTo).toBe('rearm-review');
    });

    it('never even calls listAgents for a resolved PR that carries no review:changes bounce at all', () => {
      let called = false;
      const provider = fakeProvider();
      const listPrs = () => [{ number: 1920, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }] }];
      watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider, postRearm: () => {},
        listAgents: () => { called = true; return []; },
      });
      expect(called).toBe(false);
    });
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
    // #4118 — the label write now happens LAST (after the alert + dispatch), so this failure surfaces only
    // once routing has already been attempted; `...noopRouting()` isolates the assertion to the label failure
    // itself, exactly as it already does in every other test that reaches a real dispatch call.
    const results = watchParkedPrConflicts({ repo: 'o/n', listPrs, provider, ...noopRouting() });
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
      ['postComment', 'resolved/repo', 1932],
      ['ensureLabel', 'resolved/repo', CONFLICT_LABEL],
      ['setLabels', 'resolved/repo', 1932, { add: CONFLICT_LABEL, remove: [] }],
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

// #4118 (bornAs x3zr5tu) — "Parked-PR conflict watch: make the conflict label and its one-time comment
// crash-safe". Fold-in from the adversarial review: (a) a crash between the label and the routing decision used
// to leave `plan.add` reading null forever (already labelled → skipped), losing the dispatch/stand-down for good.
describe('#4118 — hasRecentConflictAlertComment / latestConflictAlertCreatedAtMs / hasRecentConflictFindingComment (pure)', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const alertBody = buildConflictComment({ num: 4118 }, {});
  const findingBody = buildConflictFindingBody({ num: 4118 });

  it('CONFLICT_ALERT_MARKER_RE matches the alert\'s own fixed header, parked or approved', () => {
    expect(CONFLICT_ALERT_MARKER_RE.test(buildConflictComment({ num: 1 }, {}))).toBe(true);
    expect(CONFLICT_ALERT_MARKER_RE.test(buildConflictComment({ num: 1 }, { deferredToDrain: true }))).toBe(true);
    expect(CONFLICT_ALERT_MARKER_RE.test('some unrelated comment')).toBe(false);
  });

  const trusted = { login: 'web-everything' };
  const forged = { login: 'some-random-user' };

  it('hasRecentConflictAlertComment: true within the window, false once it ages out', () => {
    const recent = [{ body: alertBody, createdAt: new Date(now - 60_000).toISOString(), author: trusted }];
    expect(hasRecentConflictAlertComment(recent, { now })).toBe(true);
    const stale = [{ body: alertBody, createdAt: new Date(now - (CONFLICT_RETRY_WINDOW_MS + 60_000)).toISOString(), author: trusted }];
    expect(hasRecentConflictAlertComment(stale, { now })).toBe(false);
  });

  it('hasRecentConflictAlertComment: false with no matching comment, a non-alert comment, or a bad timestamp', () => {
    expect(hasRecentConflictAlertComment([], { now })).toBe(false);
    expect(hasRecentConflictAlertComment([{ body: 'unrelated', author: trusted }], { now })).toBe(false);
    expect(hasRecentConflictAlertComment([{ body: alertBody, createdAt: 'not-a-date', author: trusted }], { now })).toBe(false);
    expect(hasRecentConflictAlertComment(undefined, { now })).toBe(false);
  });

  // #4118 review finding (security/authz) — CONFIRMED live vulnerability: without an author check, any GitHub
  // login could post a comment matching the marker and make the watch believe its own alert already went out,
  // silently swallowing the real one (then still applying CONFLICT_LABEL, marking the PR fully handled).
  it('hasRecentConflictAlertComment: a marker-matching comment from an UNTRUSTED author never counts, however recent', () => {
    const forgedComment = [{ body: alertBody, createdAt: new Date(now - 60_000).toISOString(), author: forged }];
    expect(hasRecentConflictAlertComment(forgedComment, { now })).toBe(false);
    const noAuthorAtAll = [{ body: alertBody, createdAt: new Date(now - 60_000).toISOString() }];
    expect(hasRecentConflictAlertComment(noAuthorAtAll, { now })).toBe(false);
    const bareString = [alertBody]; // a bare-string comment carries no author at all — never trusted
    expect(hasRecentConflictAlertComment(bareString, { now })).toBe(false);
  });

  it('latestConflictAlertCreatedAtMs: UNSCOPED by recency — an old-but-only match still returns its timestamp', () => {
    const old = new Date(now - (CONFLICT_RETRY_WINDOW_MS * 5)).toISOString();
    expect(latestConflictAlertCreatedAtMs([{ body: alertBody, createdAt: old, author: trusted }])).toBe(Date.parse(old));
    expect(latestConflictAlertCreatedAtMs([])).toBeNull();
    expect(latestConflictAlertCreatedAtMs([{ body: 'unrelated', author: trusted }])).toBeNull();
  });

  it('latestConflictAlertCreatedAtMs: picks the MOST RECENT of several matching alert comments', () => {
    const older = new Date(now - 500_000).toISOString();
    const newer = new Date(now - 10_000).toISOString();
    const comments = [{ body: alertBody, createdAt: older, author: trusted }, { body: alertBody, createdAt: newer, author: trusted }];
    expect(latestConflictAlertCreatedAtMs(comments)).toBe(Date.parse(newer));
  });

  // #4118 review finding (security/authz) — without this, an attacker who keeps posting fresh forged
  // alert-marker comments could hold this fallback `age` near zero forever, suppressing the post-drain-grace
  // dispatch for a genuinely conflicting PR indefinitely.
  it('latestConflictAlertCreatedAtMs: ignores a marker-matching comment from an UNTRUSTED author entirely', () => {
    const fresh = new Date(now - 1_000).toISOString();
    expect(latestConflictAlertCreatedAtMs([{ body: alertBody, createdAt: fresh, author: forged }])).toBeNull();
    expect(latestConflictAlertCreatedAtMs([{ body: alertBody, createdAt: fresh }])).toBeNull();
  });

  it('hasRecentConflictFindingComment: true within the window over the finding\'s own footer text, false once stale', () => {
    const recent = [{ body: findingBody, createdAt: new Date(now - 60_000).toISOString(), author: trusted }];
    expect(hasRecentConflictFindingComment(recent, { now })).toBe(true);
    const stale = [{ body: findingBody, createdAt: new Date(now - (CONFLICT_RETRY_WINDOW_MS + 60_000)).toISOString(), author: trusted }];
    expect(hasRecentConflictFindingComment(stale, { now })).toBe(false);
  });

  it('hasRecentConflictFindingComment: an alert comment never counts as a finding comment (different marker)', () => {
    const comments = [{ body: alertBody, createdAt: new Date(now - 60_000).toISOString(), author: trusted }];
    expect(hasRecentConflictFindingComment(comments, { now })).toBe(false);
  });

  it('hasRecentConflictFindingComment: a marker-matching comment from an UNTRUSTED author never counts', () => {
    const forgedComment = [{ body: findingBody, createdAt: new Date(now - 60_000).toISOString(), author: forged }];
    expect(hasRecentConflictFindingComment(forgedComment, { now })).toBe(false);
  });
});

describe('#4118 — crash-safety: the label applies LAST, after the alert + dispatch are known-good', () => {
  const fakeProvider = () => {
    const calls = [];
    return {
      calls,
      ensureLabel: (repo, name) => calls.push(['ensureLabel', repo, name]),
      setLabels: (repo, num, spec) => calls.push(['setLabels', repo, num, spec]),
      postComment: (repo, num) => calls.push(['postComment', repo, num]),
    };
  };

  // THE CARD ITSELF (bornAs x3zr5tu): a crash between the label write and the alert comment used to lose the
  // alert forever, because the label's own presence was this file's only durable marker. Reproduced here as a
  // crash BETWEEN the alert/dispatch and the label (the label is now the LAST write, so that is the only window
  // left) — the next sweep must retry the label without re-posting the alert or re-dispatching.
  it('a crash right after the alert + dispatch, before the label lands, retries ONLY the label on the next sweep', () => {
    const pr = { number: 4118, mergeable: 'CONFLICTING', headRefName: 'lane/x', labels: [{ name: 'review:pending' }] };
    const postedComments = [];
    const crashingProvider = {
      // ensureLabel throws — simulates the process dying (or the `gh label create` call failing) in the exact
      // window between the alert/dispatch succeeding and the label write actually landing.
      ensureLabel: () => { throw new Error('simulated crash: never reaches the gh label write'); },
      setLabels: () => {},
      postComment: (repo, num, body) => postedComments.push({ body, createdAt: new Date().toISOString(), author: { login: 'web-everything' } }),
    };
    const routed = [];
    // The fake `postFinding` simulates what `defaultPostConflictFinding` really does on success: leaves a
    // durable finding comment on the thread (via `reconcile-finding.mjs`) — without this, the SECOND sweep's
    // `hasRecentConflictFindingComment` marker check has no way to tell "already dispatched" from "never tried".
    const first = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider: crashingProvider,
      postFinding: (o) => {
        routed.push(o);
        postedComments.push({ body: buildConflictFindingBody({ num: pr.number }), createdAt: new Date().toISOString(), author: { login: 'web-everything' } });
      },
      postStandDown: () => {},
    });
    expect(first[0].error).toMatch(/simulated crash/);
    expect(postedComments).toHaveLength(2); // the alert AND the finding comment both landed before the crash
    expect(routed).toHaveLength(1); // the dispatch ALSO landed before the crash

    // Next sweep: `pr.labels` never actually gained CONFLICT_LABEL (the crash happened before that write), so
    // `plan.add` is truthy again — a real provider now, and `listPrComments` returns exactly what the crashed
    // sweep already posted.
    const recovered = fakeProvider();
    const routed2 = [];
    const second = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider: recovered,
      listPrComments: () => postedComments, labelRemovedAtMs: () => 0,
      postFinding: (o) => routed2.push(o), postStandDown: () => {},
    });
    expect(second[0].commented).toBe(false); // NOT re-posted — the alert marker matched
    expect(second[0].routedTo).toBe('reconcile-finding');
    expect(routed2).toHaveLength(0); // NOT re-dispatched either — the finding-comment marker matched
    expect(recovered.calls.some((c) => c[0] === 'postComment')).toBe(false);
    expect(recovered.calls).toContainEqual(['ensureLabel', 'o/n', CONFLICT_LABEL]);
    expect(recovered.calls).toContainEqual(['setLabels', 'o/n', 4118, { add: CONFLICT_LABEL, remove: [] }]);
  });

  // FINDING (a) — adversarial review: "the watch adds its label and then crashes before routing, and the next
  // sweep skips the PR forever (`plan.add` is null)". Reproduced with the crash landing BETWEEN the alert and
  // the dispatch (postFinding) instead of after it, proving the dispatch itself — not just the label — survives
  // a crash and is retried, never silently dropped.
  it('finding (a) — a crash between the alert and the dispatch retries the dispatch on the next sweep, never loses it', () => {
    const pr = { number: 4119, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] };
    const postedComments = [];
    const provider1 = {
      ensureLabel: () => {}, setLabels: () => {},
      postComment: (repo, num, body) => postedComments.push({ body, createdAt: new Date().toISOString(), author: { login: 'web-everything' } }),
    };
    const first = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider: provider1,
      postFinding: () => { throw new Error('simulated dispatch crash'); }, postStandDown: () => {},
    });
    expect(first[0].error).toMatch(/simulated dispatch crash/);
    expect(postedComments).toHaveLength(1);

    const recovered = fakeProvider();
    const routed = [];
    const second = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider: recovered,
      listPrComments: () => postedComments, labelRemovedAtMs: () => 0,
      postFinding: (o) => routed.push(o), postStandDown: () => {},
    });
    expect(routed).toHaveLength(1); // retried — NOT lost forever, unlike the pre-#4118 shape
    expect(second[0].commented).toBe(false); // no duplicate alert
    expect(second[0].routedTo).toBe('reconcile-finding');
    expect(recovered.calls.some((c) => c[0] === 'setLabels')).toBe(true); // the label finally lands
  });

  it('a genuinely fresh SECOND episode (label absent again after a real resolution) still gets its OWN alert', () => {
    // The old episode's alert comment is well outside the retry window — CONFLICT_RETRY_WINDOW_MS exists
    // precisely so this does not get read as "already handled".
    const pr = { number: 4120, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] };
    const oldEpisodeAlert = {
      body: buildConflictComment({ num: 4120 }, {}),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    };
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider,
      listPrComments: () => [oldEpisodeAlert], labelRemovedAtMs: () => 0,
      postFinding: (o) => routed.push(o), postStandDown: () => {},
    });
    expect(results[0].commented).toBe(true); // a FRESH alert for the new episode, not silently skipped
    expect(routed).toHaveLength(1);
    expect(provider.calls.filter((c) => c[0] === 'postComment')).toHaveLength(1);
  });
});

// #4118 re-review (round 2) — the recency window alone cannot tell a crash-retry from a RAPID re-conflict, and
// the fresh-path stand-down dedup was not scoped at all. The episode boundary is the latest time the
// CONFLICT_LABEL was REMOVED (`labelRemovedAtMs`): a marker posted before it belongs to a closed episode.
describe('#4118 — marker dedups are scoped to the CURRENT conflict episode', () => {
  const trusted = { login: 'web-everything' };
  const now = Date.parse('2026-09-25T12:00:00Z');
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const fakeProvider = () => {
    const calls = [];
    return {
      calls,
      ensureLabel: (repo, name) => calls.push(['ensureLabel', repo, name]),
      setLabels: (repo, num, spec) => calls.push(['setLabels', repo, num, spec]),
      postComment: (repo, num) => calls.push(['postComment', repo, num]),
    };
  };

  it('a second conflict within the retry window receives a fresh alert and dispatch', () => {
    // Episode 1: alert + finding 10 minutes ago, resolved (label removed) 5 minutes ago. Episode 2: now.
    const pr = { number: 4121, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] };
    const comments = [
      { body: buildConflictComment({ num: 4121 }, {}), createdAt: iso(10 * 60_000), author: trusted },
      { body: buildConflictFindingBody({ num: 4121 }), createdAt: iso(10 * 60_000), author: trusted },
    ];
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider, now,
      listPrComments: () => comments, labelRemovedAtMs: () => now - 5 * 60_000,
      postFinding: (o) => routed.push(o), postStandDown: () => {},
    });
    expect(results[0].commented).toBe(true);
    expect(routed).toHaveLength(1);
  });

  it('a crash-retry in the SAME episode (markers newer than the last label removal) is still deduped', () => {
    const pr = { number: 4122, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] };
    const comments = [
      { body: buildConflictComment({ num: 4122 }, {}), createdAt: iso(60_000), author: trusted },
      { body: buildConflictFindingBody({ num: 4122 }), createdAt: iso(60_000), author: trusted },
    ];
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider, now,
      listPrComments: () => comments, labelRemovedAtMs: () => now - 5 * 60_000,
      postFinding: (o) => routed.push(o), postStandDown: () => {},
    });
    expect(results[0].commented).toBe(false);
    expect(routed).toHaveLength(0);
    expect(provider.calls).toContainEqual(['setLabels', 'o/n', 4122, { add: CONFLICT_LABEL, remove: [] }]);
  });

  it('an unreadable episode boundary fails toward a duplicate post, never a lost dispatch', () => {
    const pr = { number: 4123, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }] };
    const comments = [{ body: buildConflictComment({ num: 4123 }, {}), createdAt: iso(60_000), author: trusted }];
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider, now,
      listPrComments: () => comments, labelRemovedAtMs: () => null,
      postFinding: (o) => routed.push(o), postStandDown: () => {},
    });
    expect(results[0].commented).toBe(true);
    expect(routed).toHaveLength(1);
  });

  const statutePr = (number) => ({
    number, mergeable: 'CONFLICTING', labels: [{ name: 'review:pending' }], files: [{ path: 'docs/agent/platform-decisions.md' }],
  });
  const standDownAt = (msAgo) => ({ body: buildStandDownComment({ reason: 'conflict' }), createdAt: iso(msAgo), author: trusted });

  it('a fresh statute-tier episode posts its OWN stand-down even with an old episode\'s stand-down on the thread', () => {
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [statutePr(4124)], provider: fakeProvider(), now,
      listPrComments: () => [standDownAt(3 * 24 * 60 * 60_000)], labelRemovedAtMs: () => now - 2 * 24 * 60 * 60_000,
      postFinding: () => {}, postStandDown: (o) => routed.push(o.pr.number),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([4124]);
  });

  it('a stale out-of-window stand-down never suppresses a fresh one, even with no recorded label removal', () => {
    const routed = [];
    watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [statutePr(4125)], provider: fakeProvider(), now,
      listPrComments: () => [standDownAt(CONFLICT_RETRY_WINDOW_MS + 60_000)], labelRemovedAtMs: () => 0,
      postFinding: () => {}, postStandDown: (o) => routed.push(o.pr.number),
    });
    expect(routed).toEqual([4125]);
  });

  it('a crash-retry of the stand-down in the SAME episode does not re-post it', () => {
    const routed = [];
    const provider = fakeProvider();
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [statutePr(4126)], provider, now,
      listPrComments: () => [standDownAt(60_000)], labelRemovedAtMs: () => 0,
      postFinding: () => {}, postStandDown: (o) => routed.push(o.pr.number),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([]);
    expect(provider.calls).toContainEqual(['setLabels', 'o/n', 4126, { add: CONFLICT_LABEL, remove: [] }]);
  });

  it('the episode boundary is only read when the thread has comments to judge', () => {
    let reads = 0;
    watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [statutePr(4127)], provider: fakeProvider(), now,
      listPrComments: () => [], labelRemovedAtMs: () => { reads += 1; return 0; },
      postFinding: () => {}, postStandDown: () => {},
    });
    expect(reads).toBe(0);
  });
});

// #4118 re-review (round 2) — the rearm must land BEFORE the CONFLICT_LABEL is removed: the label's presence is
// what makes `newlyResolved` fire again on the next sweep, so removing it first made a failed rearm unretryable.
describe('#4118 — a resolved conflict\'s rearm is crash-safe (rearm first, label removal last)', () => {
  it('a failed rearm leaves the CONFLICT_LABEL on, so the next sweep retries it', () => {
    const calls = [];
    const provider = { setLabels: (repo, num, spec) => calls.push(['setLabels', num, spec]) };
    const pr = { number: 4128, mergeable: 'MERGEABLE', labels: [{ name: CONFLICT_LABEL }, { name: 'review:changes' }] };
    const first = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider, listAgents: () => [],
      postRearm: () => { throw new Error('simulated rearm crash'); },
    });
    expect(first[0].error).toMatch(/simulated rearm crash/);
    expect(calls).toEqual([]); // label NOT removed — still retryable

    const rearmed = [];
    const second = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider, listAgents: () => [],
      postRearm: (o) => { rearmed.push(o.pr.number); calls.push(['rearm', o.pr.number]); },
    });
    expect(second[0].routedTo).toBe('rearm-review');
    expect(rearmed).toEqual([4128]);
    expect(calls).toEqual([['rearm', 4128], ['setLabels', 4128, { add: undefined, remove: [CONFLICT_LABEL] }]]);
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

// #4118 review finding (security/authz) — `defaultListPrComments` now ALSO projects `.user.login`, reshaped to
// `author: {login}` so `isTrustedMarkerAuthor` (every marker reader in this file, plus `countStandDownComments`
// from `stand-down.mjs`) can gate on it. No test exercised this function's raw `exec` output at all before #4118.
describe('defaultListPrComments — argv shape + @tsv round-trip incl. author.login (exec injected, no real gh call)', () => {
  it('paginates the REST issue-comments endpoint projecting body + created_at + user.login via @tsv', () => {
    let capturedArgv;
    defaultListPrComments({ number: 42, repo: 'o/n', exec: (cmd, argv) => { capturedArgv = argv; return ''; } });
    expect(capturedArgv).toEqual(['api', '--paginate', '--method', 'GET', '-F', 'per_page=100', 'repos/o/n/issues/42/comments',
      '--jq', '.[] | [.body, .created_at, .user.login] | @tsv']);
  });

  it("falls back to gh's own {owner}/{repo} template when repo is omitted", () => {
    let capturedArgv;
    defaultListPrComments({ number: 7, exec: (cmd, argv) => { capturedArgv = argv; return ''; } });
    expect(capturedArgv[6]).toBe('repos/{owner}/{repo}/issues/7/comments');
  });

  it('parses body + createdAt + author.login off the three-field @tsv wire shape', () => {
    const wire = 'hello world\t2026-09-25T12:00:00Z\tweb-everything\nbye\t2026-09-24T00:00:00Z\tsome-random-user';
    const out = defaultListPrComments({ number: 1, repo: 'o/n', exec: () => wire });
    expect(out).toEqual([
      { body: 'hello world', createdAt: '2026-09-25T12:00:00Z', author: { login: 'web-everything' } },
      { body: 'bye', createdAt: '2026-09-24T00:00:00Z', author: { login: 'some-random-user' } },
    ]);
  });

  it('a body containing an escaped tab/newline (jq @tsv) still splits on the REAL field-delimiter tabs only', () => {
    const wire = 'line one\\nline two\\twith a tab\t2026-09-25T12:00:00Z\tweb-everything';
    const out = defaultListPrComments({ number: 1, repo: 'o/n', exec: () => wire });
    expect(out).toEqual([
      { body: 'line one\nline two\twith a tab', createdAt: '2026-09-25T12:00:00Z', author: { login: 'web-everything' } },
    ]);
  });

  it('a missing login (bot/deleted-account edge, `.user.login` empty) yields author: null, not a forged trust', () => {
    const wire = 'hello\t2026-09-25T12:00:00Z\t';
    const out = defaultListPrComments({ number: 1, repo: 'o/n', exec: () => wire });
    expect(out).toEqual([{ body: 'hello', createdAt: '2026-09-25T12:00:00Z', author: null }]);
  });

  it('a line with no tab at all (malformed) yields author: null and createdAt: null, never a crash', () => {
    const out = defaultListPrComments({ number: 1, repo: 'o/n', exec: () => 'no-tabs-here' });
    expect(out).toEqual([{ body: 'no-tabs-here', createdAt: null, author: null }]);
  });

  it('an empty listing yields an empty array', () => {
    expect(defaultListPrComments({ number: 1, repo: 'o/n', exec: () => '\n\n' })).toEqual([]);
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
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024, timeout: 300_000, killSignal: 'SIGKILL' }]]);
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
    // Single-sourced from stand-down.mjs — never re-typed here (see WATCHER_STAND_DOWN_ACTOR's own docblock).
    expect(capturedArgv).toContain(`--actor=${WATCHER_STAND_DOWN_ACTOR}`);
  });
});

// ── #xu2krte Fork 2 — the review-human statute-amendment exception ─────────────────────────────────────────────
// PR chalbert/web-everything#2549: `review:human` + `merge-status:conflicting`, amends clause 4(a) of the
// delivery-mode statute (removes existing text — NOT append-only), so the append-only exception (#2531) cannot
// apply. Before this fork, ANY non-append-only statute-tier conflict stood down forever, human or not. This fork
// asks one more question first: did `main` independently touch the SAME hunk since the merge base? If not, a
// human reviews the result regardless (`review:human` never clears), so the git-level conflict can be resolved
// mechanically instead of parked forever.
const PR_HUNK_10_13 = '@@ -10,3 +10,3 @@\n-old clause text\n+new clause text\n context line\n';
const MAIN_HUNK_NONOVERLAPPING = '@@ -50,2 +50,3 @@\n context\n+an unrelated new line main added\n';
const MAIN_HUNK_OVERLAPPING = '@@ -11,1 +11,1 @@\n-old clause text (main\'s own edit)\n+main\'s replacement\n';

describe('parseHunkOldRanges', () => {
  it('parses one hunk header into its old-file [start, end) range', () => {
    expect(parseHunkOldRanges('@@ -10,3 +10,3 @@\n-a\n+b\n')).toEqual([[10, 13]]);
  });

  it('defaults an omitted length to 1', () => {
    expect(parseHunkOldRanges('@@ -5 +5,2 @@\n')).toEqual([[5, 6]]);
  });

  it('collects every hunk header in a multi-hunk patch', () => {
    expect(parseHunkOldRanges('@@ -1,2 +1,2 @@\n context\n@@ -20,1 +20,1 @@\n-x\n+y\n')).toEqual([[1, 3], [20, 21]]);
  });

  it('a non-string or hunk-less patch yields no ranges', () => {
    expect(parseHunkOldRanges(undefined)).toEqual([]);
    expect(parseHunkOldRanges('no hunk headers here')).toEqual([]);
  });
});

describe('hunkRangesOverlap', () => {
  it('true when two ranges intersect', () => {
    expect(hunkRangesOverlap([[10, 13]], [[11, 12]])).toBe(true);
  });

  it('false when ranges are disjoint, even when adjacent', () => {
    expect(hunkRangesOverlap([[10, 13]], [[13, 15]])).toBe(false);
    expect(hunkRangesOverlap([[10, 13]], [[50, 52]])).toBe(false);
  });

  it('false for two empty range lists', () => {
    expect(hunkRangesOverlap([], [])).toBe(false);
  });
});

describe('doesConflictOverlapMainEdits — the TRUE semantic-clash test', () => {
  it('false: main never touched this file since the merge base — no clash possible', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }, {})).toBe(false);
  });

  it('false: main touched the SAME file but a DIFFERENT hunk region — proximity, not a real clash', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': PR_HUNK_10_13 },
      { 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING })).toBe(false);
  });

  it('true: main independently touched the SAME hunk region — a genuine competing edit', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': PR_HUNK_10_13 },
      { 'docs/agent/platform-decisions.md': MAIN_HUNK_OVERLAPPING })).toBe(true);
  });

  it('fails CLOSED (true) when main touched the file but the PR patch could not be recovered', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      {}, { 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING })).toBe(true);
  });

  // Review finding 2 — a file PRESENT in main's comparison diff whose patch GitHub omitted (binary, or a diff too
  // large to render: the jq `.patch // ""` yields ''), or whose patch carries no parseable hunk header, is a
  // REAL main edit we cannot see. It must fail closed, never read as "main never touched this file".
  it('fails CLOSED (true) when main touched the file but its patch text is empty (GitHub omitted .patch)', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }, { 'docs/agent/platform-decisions.md': '' })).toBe(true);
  });

  it('fails CLOSED (true) when main\'s patch for the file is not a string at all', () => {
    for (const bad of [null, undefined, 42]) {
      expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
        { 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }, { 'docs/agent/platform-decisions.md': bad })).toBe(true);
    }
  });

  it('fails CLOSED (true) when main\'s patch has no parseable @@ hunk header', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': PR_HUNK_10_13 },
      { 'docs/agent/platform-decisions.md': 'Binary files differ\n' })).toBe(true);
  });

  it('fails CLOSED (true) when the PR\'s own patch has no parseable @@ hunk header', () => {
    expect(doesConflictOverlapMainEdits(['docs/agent/platform-decisions.md'],
      { 'docs/agent/platform-decisions.md': 'Binary files differ\n' },
      { 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING })).toBe(true);
  });

  it('empty statute-tier file list never clashes', () => {
    expect(doesConflictOverlapMainEdits([], { a: PR_HUNK_10_13 }, { a: MAIN_HUNK_OVERLAPPING })).toBe(false);
  });
});

describe('defaultListMainStatutePatchesSinceMergeBase — argv shape + failure modes (exec injected, no real gh call)', () => {
  it('chains pulls/{n} → compare/{base}...{head} → compare/{mergeBase}...{base}, three plain gh api calls', () => {
    const calls = [];
    const exec = (cmd, argv) => {
      calls.push(argv);
      if (argv[3].endsWith('/pulls/2549')) return 'main\tabc123\n';
      if (argv[3].includes('/compare/main...abc123')) return 'deadbeef\n';
      if (argv[3].includes('/compare/deadbeef...main')) return 'docs/agent/platform-decisions.md\t@@ -10,3 +10,3 @@\\n-a\\n+b\\n';
      throw new Error(`unexpected argv ${argv[3]}`);
    };
    const out = defaultListMainStatutePatchesSinceMergeBase({ number: 2549, repo: 'o/n', exec });
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(['api', '--method', 'GET', 'repos/o/n/pulls/2549', '--jq', '[.base.ref, .head.sha] | @tsv']);
    expect(calls[1]).toEqual(['api', '--method', 'GET', 'repos/o/n/compare/main...abc123', '--jq', '.merge_base_commit.sha // ""']);
    expect(calls[2]).toEqual(['api', '--method', 'GET', 'repos/o/n/compare/deadbeef...main', '--jq', '.files[]? | [.filename, (.patch // "")] | @tsv']);
    expect(out).toEqual({ 'docs/agent/platform-decisions.md': '@@ -10,3 +10,3 @@\n-a\n+b\n' });
  });

  it('throws (fails closed) when the base ref / head sha cannot be resolved', () => {
    const exec = () => '\t\n';
    expect(() => defaultListMainStatutePatchesSinceMergeBase({ number: 1, repo: 'o/n', exec })).toThrow();
  });

  it('throws (fails closed) when no merge base can be resolved', () => {
    let call = 0;
    const exec = () => { call += 1; return call === 1 ? 'main\tabc123\n' : '\n'; };
    expect(() => defaultListMainStatutePatchesSinceMergeBase({ number: 1, repo: 'o/n', exec })).toThrow();
  });

  // Review finding 2, same category — GitHub's compare API lists at most 300 changed files and silently drops
  // the rest. A file main DID change past that cap would be absent from the map and read as untouched.
  it('throws (fails closed) when main\'s comparison file list hits the compare API\'s file cap', () => {
    const rows = Array.from({ length: COMPARE_FILES_CAP }, (_, i) => `f${i}.md\t@@ -1 +1 @@\\n-a\\n+b`).join('\n');
    let call = 0;
    const exec = () => { call += 1; return call === 1 ? 'main\tabc123\n' : call === 2 ? 'deadbeef\n' : `${rows}\n`; };
    expect(() => defaultListMainStatutePatchesSinceMergeBase({ number: 1, repo: 'o/n', exec })).toThrow(/cap/);
  });

  it('keeps an empty patch as an EMPTY STRING entry (a touched file), never dropping the key', () => {
    let call = 0;
    const exec = () => { call += 1; return call === 1 ? 'main\tabc123\n' : call === 2 ? 'deadbeef\n' : 'docs/agent/platform-decisions.md\t\n'; };
    expect(defaultListMainStatutePatchesSinceMergeBase({ number: 1, repo: 'o/n', exec }))
      .toEqual({ 'docs/agent/platform-decisions.md': '' });
  });
});

describe('findWatcherStandDownComment', () => {
  it('finds a stand-down comment posted by the watch itself', () => {
    const body = buildStandDownComment({ actor: WATCHER_STAND_DOWN_ACTOR, reason: 'conflict' });
    // #3383 — the watch posts under the automation's own login; a trusted author is now required to count.
    expect(findWatcherStandDownComment([{ body, author: { login: 'web-everything' } }])).toEqual({ body, createdAt: null });
  });

  it('null: a fix agent\'s own judgment stand-down does not match', () => {
    const body = buildStandDownComment({ actor: 'conveyor fix agent', reason: 'needs-judgment' });
    expect(findWatcherStandDownComment([{ body, author: { login: 'web-everything' } }])).toBeNull();
  });

  it('null: no comments at all', () => {
    expect(findWatcherStandDownComment([])).toBeNull();
    expect(findWatcherStandDownComment(undefined)).toBeNull();
  });
});

describe('buildSupersedeStandDownComment', () => {
  it('says the earlier stand-down is superseded and explains why it could not be deleted', () => {
    const body = buildSupersedeStandDownComment({ num: 2549 });
    expect(body).toMatch(/superseded/i);
    expect(body).toMatch(/review:human.*never cleared|never cleared.*review:human/i);
    expect(body).toMatch(/could not safely delete/i);
  });
});

describe('watchParkedPrConflicts — #xu2krte Fork 2 review-human statute amendment (fresh detection)', () => {
  const basePr = (over = {}) => ({
    number: 2549, mergeable: 'CONFLICTING', headRefName: 'lane/3681-ratify-daemon-lifecycle',
    labels: [{ name: 'review:human' }], files: [{ path: 'docs/agent/platform-decisions.md' }], ...over,
  });
  const fakeProvider = () => {
    const calls = [];
    return { calls, ensureLabel: (...a) => calls.push(['ensureLabel', ...a.slice(0, 2)]), setLabels: (...a) => calls.push(['setLabels', ...a]), postComment: (...a) => calls.push(['postComment', ...a]) };
  };

  it('review:human + non-append-only + NOT overlapping main → routes to the fixer, not stand-down', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [basePr()], provider,
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING }),
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results[0].routedTo).toBe('reconcile-finding (review-human statute amendment)');
    expect(routed).toEqual([['finding', { pr: basePr(), repo: 'o/n', reviewHumanFixable: true }]]);
    // The comment says the conflict-only mechanical resolution, never the stand-down "judgment call" wording.
    const commentCall = provider.calls.find((c) => c[0] === 'postComment');
    expect(commentCall[3]).toMatch(/resolve the conflict only|being resolved mechanically/i);
    expect(commentCall[3]).not.toMatch(/left as a \*\*judgment call/i);
  });

  it('review:human + non-append-only + DOES overlap main → still stands down (a true competing edit)', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [basePr()], provider,
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_OVERLAPPING }),
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', { pr: basePr(), repo: 'o/n' }]]);
  });

  it('NO review:human (only review:pending) → unchanged: still stands down even with non-overlapping hunks', () => {
    const provider = fakeProvider();
    const routed = [];
    const pr = basePr({ labels: [{ name: 'review:pending' }] });
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider,
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      // A caller with no review:human never even reaches listMainStatutePatches — assert that directly.
      listMainStatutePatches: () => { throw new Error('must not be called without review:human'); },
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results[0].routedTo).toBe('stand-down');
    expect(routed).toEqual([['stand-down', { pr, repo: 'o/n' }]]);
  });

  it('append-only still wins over the review-human exception when a PR is both (append-only is cheaper/broader)', () => {
    const provider = fakeProvider();
    const routed = [];
    const appendOnlyPatch = '@@ -20,0 +21,3 @@\n+### New Rule\n+body\n+more body\n ---\n';
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [basePr()], provider,
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': appendOnlyPatch }),
      listMainStatutePatches: () => { throw new Error('must not be called — append-only short-circuits first'); },
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results[0].routedTo).toBe('reconcile-finding (append-only statute)');
  });
});

describe('watchParkedPrConflicts — #xu2krte Fork 2 recheck of an ALREADY stood-down parked PR (live PR #2549 shape)', () => {
  // #3383 — every marker (this one included) now requires a trusted author; both are posted by the automation.
  const watcherMarkerComment = { body: buildStandDownComment({ actor: WATCHER_STAND_DOWN_ACTOR, reason: 'conflict' }), author: { login: 'web-everything' } };
  const humanJudgmentComment = { body: buildStandDownComment({ actor: 'conveyor fix agent', reason: 'needs-judgment' }), author: { login: 'web-everything' } };
  const alreadyLabelledPr = (over = {}) => ({
    number: 2549, mergeable: 'CONFLICTING', headRefName: 'lane/3681-ratify-daemon-lifecycle',
    labels: [{ name: 'review:human' }, { name: CONFLICT_LABEL }], ...over,
  });
  const fakeProvider = () => {
    const calls = [];
    return { calls, ensureLabel: () => {}, setLabels: () => {}, postComment: (...a) => calls.push(['postComment', ...a]) };
  };

  it('a watcher-marked, already-labelled PR that NOW qualifies (no overlap) supersedes the marker and dispatches', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [alreadyLabelledPr()], provider,
      listPrComments: () => [watcherMarkerComment],
      listPrFiles: () => ['docs/agent/platform-decisions.md'],
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING }),
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results).toEqual([{
      num: 2549, isConflicting: true, add: null, remove: [], newlyDetected: false, commented: false,
      supersededStandDown: true, routedTo: 'reconcile-finding (review-human statute amendment, marker superseded)',
    }]);
    expect(routed).toEqual([['finding', { pr: alreadyLabelledPr(), repo: 'o/n', appendOnlyStatute: false, reviewHumanFixable: true }]]);
    expect(provider.calls).toEqual([['postComment', 'o/n', 2549, expect.stringMatching(/superseded/i)]]);
  });

  // Live on chalbert/web-everything#2549 (2026-09-24): with no durable "already superseded" read, every sweep
  // (~2 min) re-posted the supersede comment AND a fresh review:changes finding. The supersede comment IS the
  // durable record, so once one follows the watcher's marker the recheck is done.
  it('a watcher marker ALREADY followed by a supersede comment is not re-superseded or re-dispatched', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [alreadyLabelledPr()], provider,
      listPrComments: () => [watcherMarkerComment, { body: buildSupersedeStandDownComment({ num: 2549 }) }],
      listPrFiles: () => { throw new Error('must not re-classify an already-superseded marker'); },
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results).toEqual([]);
    expect(routed).toEqual([]);
    expect(provider.calls).toEqual([]);
  });

  it('a NEW watcher stand-down posted after an old supersede is re-checked (only the latest marker counts)', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [alreadyLabelledPr()], provider,
      listPrComments: () => [watcherMarkerComment, { body: buildSupersedeStandDownComment({ num: 2549 }) }, watcherMarkerComment],
      listPrFiles: () => ['docs/agent/platform-decisions.md'],
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING }),
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results[0].supersededStandDown).toBe(true);
    expect(routed.map(([k]) => k)).toEqual(['finding']);
  });

  it('posts the finding BEFORE the supersede, and no supersede at all when the finding fails', () => {
    const run = (postFinding) => {
      const order = [];
      const provider = { ensureLabel: () => {}, setLabels: () => {}, postComment: () => order.push('supersede') };
      const results = watchParkedPrConflicts({
        repo: 'o/n', listPrs: () => [alreadyLabelledPr()], provider,
        listPrComments: () => [watcherMarkerComment],
        listPrFiles: () => ['docs/agent/platform-decisions.md'],
        listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
        listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING }),
        postFinding: () => postFinding(order),
        postStandDown: () => order.push('stand-down'),
      });
      return { order, results };
    };
    expect(run((order) => order.push('finding')).order).toEqual(['finding', 'supersede']);
    const failed = run(() => { throw new Error('gh timeout'); });
    expect(failed.order).toEqual([]); // no supersede → the next sweep retries
    expect(failed.results[0].error).toMatch(/gh timeout/);
  });

  it('the supersede comment it posts starts with the single-sourced SUPERSEDE_STAND_DOWN_MARKER', () => {
    expect(buildSupersedeStandDownComment({ num: 2549 }).startsWith(SUPERSEDE_STAND_DOWN_MARKER)).toBe(true);
  });

  it('a watcher-marked PR that STILL overlaps main leaves the stand-down exactly alone — no re-post, no dispatch', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [alreadyLabelledPr()], provider,
      listPrComments: () => [watcherMarkerComment],
      listPrFiles: () => ['docs/agent/platform-decisions.md'],
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_OVERLAPPING }),
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results[0].routedTo).toBe('stand-down (unchanged)');
    expect(routed).toEqual([]);
    expect(provider.calls).toEqual([]);
  });

  it('an already-labelled PR with NO watcher marker (e.g. already dispatched, or a fix agent\'s OWN stand-down) is left alone', () => {
    const provider = fakeProvider();
    const routed = [];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [alreadyLabelledPr()], provider,
      listPrComments: () => [humanJudgmentComment],
      listPrFiles: () => { throw new Error('must not fetch files when no watcher marker is present'); },
      postFinding: (o) => routed.push(['finding', o]),
      postStandDown: (o) => routed.push(['stand-down', o]),
    });
    expect(results).toEqual([]);
    expect(routed).toEqual([]);
    expect(provider.calls).toEqual([]);
  });

  it('never re-checks a queued (not parked) PR through this path — the grace path already owns that population', () => {
    const provider = fakeProvider();
    const listPrFilesCalls = [];
    const pr = alreadyLabelledPr({ labels: [{ name: 'review:accepted' }, { name: CONFLICT_LABEL }] });
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [pr], provider,
      labelAgeMs: () => 0, // grace not yet due
      listPrFiles: () => { listPrFilesCalls.push(1); return []; },
    });
    expect(results).toEqual([]);
    expect(listPrFilesCalls).toEqual([]);
  });

  it('a real dry run reports the same routing decision without writing anything', () => {
    const provider = fakeProvider();
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [alreadyLabelledPr()], dryRun: true, provider,
      listPrComments: () => [watcherMarkerComment],
      listPrFiles: () => ['docs/agent/platform-decisions.md'],
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': PR_HUNK_10_13 }),
      listMainStatutePatches: () => ({ 'docs/agent/platform-decisions.md': MAIN_HUNK_NONOVERLAPPING }),
    });
    expect(results[0].routedTo).toBe('reconcile-finding (review-human statute amendment, marker superseded)');
    expect(results[0].supersededStandDown).toBe(true);
    expect(provider.calls).toEqual([]);
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
  fields: 'number,headRefName,baseRefName,mergeable,mergeStateStatus,labels,files',
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

  // xaer296 (epic #3383) — the FRESH-DETECTION path (first sighting of a conflict, `newlyDetected: true`) never
  // got the #2581 stacked-base check at all — ONLY the `graceDue` (queued, already-flagged) path did. For a
  // QUEUED PR that is unaffected: first sighting already defers to the drain unconditionally (see the "first
  // sighting" test above), regardless of base, and the later `graceDue` re-check (already fixed by #2581)
  // correctly defers a stacked base once grace elapses. But a PARKED (non-queued, e.g. `review:human`) PR that
  // is ALSO stacked and freshly drifts into conflict hits this path's PLAIN, non-statute `else` branch
  // (`postFinding` unconditionally, first tick, no grace to wait out) — which had NO `baseRefName` awareness at
  // all, so it would bounce an ordinary main-conflict onto a PR whose real conflict is against its own base,
  // reproducing the identical `chalbert/web-everything#2578` failure shape for a population `graceDue`'s own fix
  // never covered.
  it('xaer296 — FIRST sighting of a PARKED (non-queued) stacked-base PR is ALSO deferred to reconcile-core, never bounced as an ordinary main conflict', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{
      number: 2578, mergeable: 'CONFLICTING', baseRefName: 'lane/3681-ratify-daemon-lifecycle',
      labels: L('review:human'),
      files: [{ path: 'scripts/lib/daemon-self-sync.mjs' }],
    }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
      listPrFiles: () => { throw new Error('must not be called for a stacked PR'); },
    });
    expect(r.newlyDetected).toBe(true);
    expect(r.routedTo).toBe('deferred-to-reconcile (stacked base — see reconcile-core.mjs#3383, review labels untouched)');
    expect(routed).toEqual([]); // never bounced via postFinding, never stood down
    // The label add still happens (an evidence-only fact, unrelated to which ref this conflicts against) —
    // only the alert-comment + statute-classification + routing is skipped.
    expect(provider.calls.some((c) => c[0] === 'setLabels')).toBe(true);
    expect(provider.calls.some((c) => c[0] === 'postComment')).toBe(false);
  });

  it('xaer296 — a base of `main` at first sighting (the ordinary case) is UNCHANGED — still bounces immediately', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{
      number: 1920, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:human'),
      files: [{ path: 'scripts/lib/daemon-self-sync.mjs' }],
    }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
    });
    expect(r.routedTo).toBe('reconcile-finding');
    expect(routed).toEqual([1920]);
  });

  // #3383 — a STACKED PR (base isn't `main`) is never landed by the drain, so grace-expiry must NEVER bounce it
  // through `postFinding` (which strips `review:accepted`) — `reconcile-core.mjs`'s own STACKED-BASE CONFLICT
  // branch owns the mechanical rebase instead. `chalbert/web-everything#2578`'s real shape.
  it('already flagged, grace elapsed, but base is NOT main (stacked) → deferred to reconcile-core, no bounce', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{
      number: 2578, mergeable: 'CONFLICTING', baseRefName: 'lane/3681-ratify-daemon-lifecycle',
      labels: L('review:accepted', CONFLICT_LABEL),
    }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, listPrFiles: () => { throw new Error('must not be called for a stacked PR'); },
    });
    expect(r.routedTo).toBe('deferred-to-reconcile (stacked base — see reconcile-core.mjs#3383, review labels untouched)');
    expect(routed).toEqual([]); // never bounced, never stood down
    expect(provider.calls).toEqual([]); // no label write, no comment
  });

  it('a stacked base is reported even in dry-run — never silent', () => {
    const provider = fakeProvider();
    const listPrs = () => [{
      number: 2578, mergeable: 'CONFLICTING', baseRefName: 'lane/3681-ratify-daemon-lifecycle',
      labels: L('review:accepted', CONFLICT_LABEL),
    }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, dryRun: true,
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, listPrFiles: () => { throw new Error('must not be called'); },
    });
    expect(r.routedTo).toBe('deferred-to-reconcile (stacked base — see reconcile-core.mjs#3383, review labels untouched)');
  });

  it('a base of `main` (the ordinary case) is UNCHANGED — still bounces once grace elapses', () => {
    const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:accepted', CONFLICT_LABEL) }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(), postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, listPrFiles: () => [{ path: 'scripts/x.mjs' }],
    });
    expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
    expect(routed).toEqual([2514]);
  });

  it('a missing `baseRefName` (unknown) is UNCHANGED — still bounces, the safe pre-#3383 default', () => {
    const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(), postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, listPrFiles: () => [{ path: 'scripts/x.mjs' }],
    });
    expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
    expect(routed).toEqual([2514]);
  });

  // #3383 — dry-run used to bail out of the whole grace branch before computing anything (the SAME line that
  // handles the ordinary post-grace-not-yet-elapsed bail also caught this), so `--dry-run` could never surface
  // what a real sweep would actually do to a queued, grace-expired PR — exactly the blind spot that let #2505
  // sit unrouted with no visibility. The read-only classification (age, files, patches) now runs in BOTH modes;
  // only the write calls are gated.
  it('dry-run reports the grace-expired routing decision instead of skipping the branch, and makes no writes', () => {
    const provider = fakeProvider(); const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider, dryRun: true,
      postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, listPrFiles: () => [{ path: 'scripts/x.mjs' }],
    });
    expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
    expect(routed).toEqual([]); // no write called
    expect(provider.calls).toEqual([]);
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

  // #4118 finding (b) — adversarial review: "an unreadable events API waits forever with no output". A
  // PERSISTENTLY (every sweep) unreadable `labelAgeMs` used to mean this PR waits past grace forever, no matter
  // how long it has actually been conflicting — the same "silently stuck" shape #2503/#2514/#2515 already named.
  // The durable alert comment this watch itself posts at detection (now ALWAYS present once CONFLICT_LABEL is,
  // per #4118's own label-applies-last ordering) is a reliable fallback age source.
  it('#4118 (b) — a persistently unreadable events API does not wait forever: falls back to the durable alert-comment timestamp', () => {
    const routed = [];
    const oldAlert = {
      body: buildConflictComment({ num: 2514 }, {}),
      createdAt: new Date(Date.now() - (QUEUED_CONFLICT_GRACE_MS + 5 * 60 * 1000)).toISOString(),
      author: { login: 'web-everything' },
    };
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    const [r] = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(),
      postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => null, // the events API is unreadable on EVERY sweep — not a one-off blip
      listPrComments: () => [oldAlert],
      listPrFiles: () => [{ path: 'scripts/x.mjs' }],
    });
    expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
    expect(routed).toEqual([2514]);
  });

  it('#4118 (b) — still waits when the fallback alert comment is also unavailable (unchanged safe default)', () => {
    const routed = [];
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('ready-to-merge', CONFLICT_LABEL) }];
    watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(), postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => null, listPrComments: () => [], listPrFiles: () => [],
    });
    expect(routed).toEqual([]);
  });

  it('#4118 (b) — a fallback alert comment that has not YET sat past grace still waits (no premature bounce)', () => {
    const routed = [];
    const recentAlert = { body: buildConflictComment({ num: 2514 }, {}), createdAt: new Date().toISOString(), author: { login: 'web-everything' } };
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(), postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => null, listPrComments: () => [recentAlert], listPrFiles: () => [],
    });
    expect(routed).toEqual([]);
  });

  // #4118 review finding (security/authz) — a FORGED fallback alert comment (untrusted author) must never
  // substitute for a real one: an attacker who keeps posting fresh forged alert-marker comments could otherwise
  // hold this fallback age near zero forever, suppressing the post-drain-grace dispatch indefinitely.
  it('#4118 (b) — an UNTRUSTED-author fallback alert comment is never used as the age source, however old', () => {
    const routed = [];
    const forgedOldAlert = {
      body: buildConflictComment({ num: 2514 }, {}),
      createdAt: new Date(Date.now() - (QUEUED_CONFLICT_GRACE_MS + 5 * 60 * 1000)).toISOString(),
      author: { login: 'some-random-user' },
    };
    const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }];
    watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider: fakeProvider(), postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
      labelAgeMs: () => null, listPrComments: () => [forgedOldAlert], listPrFiles: () => [],
    });
    expect(routed).toEqual([]); // never bounced off a forged fallback comment — still waits, the safe default
  });

  it('statute-tier: handed to a human at first sighting, and NEVER re-posted by the grace path once the marker is on the PR', () => {
    const routed = [];
    const statuteFiles = [{ path: 'docs/agent/platform-decisions.md' }];
    const first = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [{ number: 2505, mergeable: 'CONFLICTING', labels: L('review:accepted'), files: statuteFiles }],
      provider: fakeProvider(), postFinding: () => routed.push('finding'), postStandDown: () => routed.push('sd'),
    });
    expect(first[0].routedTo).toBe('stand-down');
    // #3383 — idempotency now comes from READING the marker back off the PR's own comments (`listPrComments` +
    // `countStandDownComments`), not from a bare "isStatuteTier implies already handled" assumption (that
    // assumption is exactly what left #2505 stuck: a QUEUED PR that is NOT statute-tier at detection is deferred
    // to the drain, never handed to a human, so it can reach this grace path statute-tier for the FIRST time).
    const later = watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [{ number: 2505, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }],
      provider: fakeProvider(), postFinding: () => routed.push('finding'), postStandDown: () => routed.push('sd'),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS * 2, listPrFiles: () => statuteFiles,
      // #3383 — a trusted author is now required for the marker read-back to count.
      listPrComments: () => [{ body: STAND_DOWN_MARKER, author: { login: 'web-everything' } }],
      labelRemovedAtMs: () => 0,
    });
    expect(later).toEqual([]);
    expect(routed).toEqual(['sd']);
  });

  // #4118 round 2 — the grace-expiry stand-down dedup is scoped to the current episode too.
  it('grace expired, statute-tier: an OLD episode\'s stand-down (before the last label removal) does not silence this one', () => {
    const statuteFiles = [{ path: 'docs/agent/platform-decisions.md' }];
    const routed = [];
    const removedAt = Date.parse('2026-09-20T00:00:00Z');
    const oldStandDown = { body: STAND_DOWN_MARKER, createdAt: '2026-09-19T00:00:00Z', author: { login: 'web-everything' } };
    const newStandDown = { body: STAND_DOWN_MARKER, createdAt: '2026-09-21T00:00:00Z', author: { login: 'web-everything' } };
    const run = (comments) => watchParkedPrConflicts({
      repo: 'o/n', listPrs: () => [{ number: 2506, mergeable: 'CONFLICTING', labels: L('review:accepted', CONFLICT_LABEL) }],
      provider: fakeProvider(), postFinding: () => routed.push('finding'), postStandDown: () => routed.push('sd'),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS * 2, listPrFiles: () => statuteFiles,
      listPrComments: () => comments, labelRemovedAtMs: () => removedAt,
    });
    expect(run([oldStandDown])[0].routedTo).toBe('stand-down (after drain grace)');
    expect(routed).toEqual(['sd']);
    expect(run([oldStandDown, newStandDown])).toEqual([]); // this episode's own stand-down — never re-posted
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

  describe('#xngv3vn — defaultComputeConflictDisposition (injected exec, no real git/network)', () => {
    it('no headRefName → null, no git call made at all', () => {
      const exec = () => { throw new Error('must not be called'); };
      expect(defaultComputeConflictDisposition({ pr: {}, exec })).toBeNull();
    });

    it('a clean merge-tree (fetch + probe both succeed) → "clean"', () => {
      const calls = [];
      const exec = (cmd, args) => { calls.push([cmd, args[0]]); return 'abc123tree\n'; };
      const disp = defaultComputeConflictDisposition({ pr: { headRefName: 'lane/x', baseRefName: 'main' }, exec });
      expect(disp).toBe('clean');
      expect(calls[0]).toEqual(['git', 'fetch']);
      expect(calls[1]).toEqual(['git', 'merge-tree']);
    });

    it('a conflict confined to the manifest → "manifest-only"', () => {
      const conflictOut = [
        'abc123tree',
        '100644 aaa 2\t.lane-manifest.json',
        '100644 bbb 3\t.lane-manifest.json',
        '',
        'CONFLICT (content): Merge conflict in .lane-manifest.json',
      ].join('\n');
      const exec = (cmd, args) => {
        if (args[0] === 'merge-tree') { const e = new Error('exit 1'); e.status = 1; e.stdout = conflictOut; throw e; }
        return '';
      };
      expect(defaultComputeConflictDisposition({ pr: { headRefName: 'lane/x' }, exec })).toBe('manifest-only');
    });

    it('a conflict touching a real file beyond the manifest → "real" — the #2596 shape', () => {
      const conflictOut = [
        'abc123tree',
        '100644 aaa 2\tscripts/merge-ai-prs.mjs',
        '100644 bbb 3\tscripts/merge-ai-prs.mjs',
        '',
        'CONFLICT (content): Merge conflict in scripts/merge-ai-prs.mjs',
      ].join('\n');
      const exec = (cmd, args) => {
        if (args[0] === 'merge-tree') { const e = new Error('exit 1'); e.status = 1; e.stdout = conflictOut; throw e; }
        return '';
      };
      expect(defaultComputeConflictDisposition({ pr: { headRefName: 'lane/x' }, exec })).toBe('real');
    });

    it('a fetch failure is best-effort (swallowed) — the merge-tree probe still runs', () => {
      const exec = (cmd, args) => {
        if (args[0] === 'fetch') throw new Error('no route to host');
        return 'abc123tree\n';
      };
      expect(defaultComputeConflictDisposition({ pr: { headRefName: 'lane/x' }, exec })).toBe('clean');
    });

    it('an unparseable merge-tree failure (no stdout at all) → null, never guessed', () => {
      const exec = (cmd, args) => {
        if (args[0] === 'merge-tree') { const e = new Error('transient'); e.status = 1; e.stdout = ''; throw e; }
        return '';
      };
      expect(defaultComputeConflictDisposition({ pr: { headRefName: 'lane/x' }, exec })).toBeNull();
    });
  });

  // #xngv3vn (epic #3383/#4075) — LIVE INCIDENT, chalbert/web-everything#2596, 2026-09-24: an approved/queued
  // PR drifted into a REAL content conflict (not the shared manifest) and the queued-conflict watch deferred it
  // the full 30-minute `QUEUED_CONFLICT_GRACE_MS` to "give the drain first try" — but the drain's ONLY
  // self-heal path is `we:scripts/lib/rebase-drop-manifest.mjs`'s manifest-only rebase-drop, which cannot touch
  // a real conflict no matter how long it waits. `computeConflictDisposition` (default:
  // `defaultComputeConflictDisposition`, a real `git merge-tree` probe) lets the grace-expiry branch tell the
  // two shapes apart BEFORE waiting on age at all, so a real conflict is routed to the fixer immediately and
  // the grace is spent only on the one shape it can actually heal.
  describe('#xngv3vn — the queued-conflict grace is skipped entirely for a REAL (non-manifest) conflict', () => {
    it('a REAL conflict (computeConflictDisposition → "real") is bounced IMMEDIATELY, even with age 0 / just labelled', () => {
      const provider = fakeProvider(); const routed = [];
      const listPrs = () => [{ number: 2596, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:accepted', 'ready-to-merge', CONFLICT_LABEL) }];
      const [r] = watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider,
        postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
        computeConflictDisposition: () => 'real',
        labelAgeMs: () => { throw new Error('must not be called — a real conflict never waits on age'); },
        listPrFiles: () => [{ path: 'scripts/x.mjs' }],
      });
      expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
      expect(r.conflictDisposition).toBe('real');
      expect(routed).toEqual([2596]); // bounced to the fixer at once — not deferred to the drain
    });

    it('a manifest-only conflict (computeConflictDisposition → "manifest-only") is UNCHANGED — still waits out the grace', () => {
      const routed = [];
      const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:accepted', CONFLICT_LABEL) }];
      const results = watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider: fakeProvider(),
        postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
        computeConflictDisposition: () => 'manifest-only',
        labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS - 1000, // grace not yet elapsed
      });
      expect(results).toEqual([]); // nothing happens yet — the drain still has its turn
      expect(routed).toEqual([]);
    });

    it('a manifest-only conflict still bounces once the grace genuinely elapses (unchanged pre-#xngv3vn behaviour)', () => {
      const routed = [];
      const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:accepted', CONFLICT_LABEL) }];
      const [r] = watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider: fakeProvider(),
        postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
        computeConflictDisposition: () => 'manifest-only',
        labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000,
        listPrFiles: () => [{ path: 'scripts/x.mjs' }],
      });
      expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
      expect(routed).toEqual([2514]);
    });

    it('an UNCLASSIFIABLE conflict (computeConflictDisposition → null) fails toward the existing wait — the safe direction', () => {
      const routed = [];
      const listPrs = () => [{ number: 2514, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:accepted', CONFLICT_LABEL) }];
      const results = watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider: fakeProvider(),
        postFinding: (o) => routed.push(o.pr.number), postStandDown: () => {},
        computeConflictDisposition: () => null,
        labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS - 1000,
      });
      expect(results).toEqual([]);
      expect(routed).toEqual([]);
    });

    it('a REAL conflict is reported even in dry-run — never silent about why it skipped the wait', () => {
      const listPrs = () => [{ number: 2596, mergeable: 'CONFLICTING', baseRefName: 'main', labels: L('review:accepted', 'ready-to-merge', CONFLICT_LABEL) }];
      const [r] = watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider: fakeProvider(), dryRun: true,
        computeConflictDisposition: () => 'real',
        labelAgeMs: () => { throw new Error('must not be called'); },
        listPrFiles: () => [{ path: 'scripts/x.mjs' }],
      });
      expect(r.routedTo).toBe('reconcile-finding (after drain grace)');
      expect(r.conflictDisposition).toBe('real');
    });

    it('a REAL conflict on a STACKED-base PR still defers to reconcile-core, never bounced through postFinding', () => {
      // #3383's stacked-base carve-out stays authoritative regardless of disposition: the drain never lands a
      // stacked PR at all, so "route to the fixer immediately" (which strips review:accepted) would be worse
      // than today's behaviour, not better — reconcile-core's own mechanical rebase already owns this case.
      const routed = [];
      const listPrs = () => [{
        number: 2578, mergeable: 'CONFLICTING', baseRefName: 'lane/3681-ratify-daemon-lifecycle',
        labels: L('review:accepted', CONFLICT_LABEL),
      }];
      const [r] = watchParkedPrConflicts({
        repo: 'o/n', listPrs, provider: fakeProvider(),
        postFinding: (o) => routed.push(o.pr.number), postStandDown: () => routed.push('sd'),
        computeConflictDisposition: () => 'real',
        listPrFiles: () => { throw new Error('must not be called for a stacked PR'); },
      });
      expect(r.routedTo).toBe('deferred-to-reconcile (stacked base — see reconcile-core.mjs#3383, review labels untouched)');
      expect(routed).toEqual([]);
    });
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

  // #3383 — the live bug (PR #2505, chalbert/web-everything): a queued/approved PR that was NOT statute-tier
  // at detection (so it was correctly deferred to the drain, `routedTo: 'deferred-to-drain'`, never handed to a
  // human) is later re-checked, past the drain's grace window, and turns out to touch a statute-tier file whose
  // only change is an append-only new `### ` section. The grace path used to short-circuit on
  // `if (isStatuteTier) continue`, on the FALSE assumption that a statute-tier conflict was always already
  // handed to a human at detection — leaving this exact PR unrouted forever, with no label change, no comment,
  // no dispatch. This test reproduces that shape end to end and pins the fixed routing.
  it('#3383 — a queued PR that reaches statute-tier only at grace-expiry, append-only, is dispatched to the fixer (not silently dropped)', () => {
    const provider = fakeProvider();
    const routed = [];
    const listPrs = () => [{
      // Already labelled by an earlier sweep (that earlier sweep saw it as non-statute-tier and deferred it),
      // still queued/approved, still conflicting.
      number: 2505, mergeable: 'CONFLICTING', labels: [{ name: 'review:accepted' }, { name: CONFLICT_LABEL }],
    }];
    const results = watchParkedPrConflicts({
      repo: 'o/n', listPrs, provider,
      postFinding: (o) => routed.push(['finding', o.pr.number, o.appendOnlyStatute]),
      postStandDown: (o) => routed.push(['stand-down', o.pr.number]),
      labelAgeMs: () => QUEUED_CONFLICT_GRACE_MS + 1000, // grace has elapsed
      listPrFiles: () => [{ path: 'docs/agent/platform-decisions.md' }],
      listPrPatches: () => ({ 'docs/agent/platform-decisions.md': goodPatch }),
    });
    expect(results[0].routedTo).toBe('reconcile-finding (append-only statute, after drain grace)');
    expect(routed).toEqual([['finding', 2505, true]]);
    expect(provider.calls).toEqual([]); // no second label write, no second comment — the bounce IS the action
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
