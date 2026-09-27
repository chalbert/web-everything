import { vi, it, expect, describe } from 'vitest';


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
  name: 'reconcile-pass', load: () => import('../reconcile-pass.mjs'),
  reader: 'defaultReadPrs', run: 'runReconcilePass',
  fields: 'number,headRefName,headRefOid,baseRefName,labels,statusCheckRollup,mergeStateStatus,comments,body', reconcile: true,
});


// we:backlog/x81m8xx-*.md (#4189) — a caller passing the internal repo KEY (`--repo=we`, exactly as
// `constellation-repos.mjs` names it) must not reach `gh` as the bare key: `gh pr list --repo we` fails
// (`gh` only understands `owner/name`). Both readers must see the NORMALISED slug.
it('normalises a bare repo KEY (e.g. --repo=we) to its gh owner/name slug before any IO', async () => {
  const { runReconcilePass } = await import('../reconcile-pass.mjs');
  const readPrs = vi.fn(() => []);
  const enrichMainRed = vi.fn((prs) => ({ prs, mainRedWindows: [] }));
  runReconcilePass({
    repo: 'we', readPrs, enrichMainRed,
    readAgents: () => [], enrich: (agents) => agents,
  });
  expect(readPrs).toHaveBeenCalledWith({ repo: 'chalbert/web-everything' });
  expect(enrichMainRed).toHaveBeenCalledWith([], { repo: 'chalbert/web-everything', defaultBranch: 'main' });
});

it('maps repo slugs before binding and refuses unknown repos before IO', async () => {
  const { runReconcilePass } = await import('../reconcile-pass.mjs');
  const options = {
    readPrs: () => [{ number: 49, headRefName: 'lane/1-x', labels: [{ name: 'review:pending' }], comments: [] }],
    readAgents: () => [{ name: 'review-fui-49', pidAlive: true, pid: 1 }], enrich: (agents) => agents,
  };
  expect(runReconcilePass({ ...options, repo: 'chalbert/frontierui' }).refusals.some((r) => r.kind === 'live-process')).toBe(true);
  expect(runReconcilePass(options).dispatch).toHaveLength(1);
  expect(() => runReconcilePass({ repo: 'other/repo', readPrs: () => { throw new Error('must not read'); } })).toThrow(/not a constellation repo/);
});

// we:backlog/x5uqim1-*.md (#4075/#3383) — enrichPrsWithMainRedFacts pays the extra `gh run list --branch main`
// read only when at least one PR is currently failing its required check; the other tests in this file (no PR
// ever fails) already prove the zero-cost path implicitly (no `readMainRuns`/`readAheadBy` was ever wired in and
// nothing broke). These pin the paying path explicitly, with the REAL shapes measured 2026-09-25. CORRECTED
// mid-build from an earlier `gh run view --json attempt` design to `ahead_by` (`gh api .../compare`) — see
// `main-red-recovery.mjs`'s own file header for why a rerun of the same stale commit does not actually resolve
// a red-main-caused failure.
it('enrichPrsWithMainRedFacts skips the extra main-run read entirely when nothing is ci-failed', async () => {
  const { enrichPrsWithMainRedFacts } = await import('../reconcile-pass.mjs');
  const readMainRuns = vi.fn();
  const prs = [{ number: 1, statusCheckRollup: [] }];
  const out = enrichPrsWithMainRedFacts(prs, { readMainRuns });
  expect(readMainRuns).not.toHaveBeenCalled();
  expect(out).toEqual({ prs, mainRedWindows: [] });
});

it('enrichPrsWithMainRedFacts attaches requiredCheckCompletedAt/aheadByOnMain only to the failing PR (PR #2635\'s real shape)', async () => {
  const { enrichPrsWithMainRedFacts } = await import('../reconcile-pass.mjs');
  const failingCheck = {
    __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE',
    completedAt: '2026-09-25T01:57:47Z',
  };
  const quietPr = { number: 1, statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }] };
  const redPr = { number: 2635, headRefOid: 'ab9985630d90019a07b94e946bc75f8de7a6161f', statusCheckRollup: [failingCheck] };
  const readMainRuns = vi.fn(() => [
    { status: 'completed', conclusion: 'failure', updatedAt: '2026-09-25T01:30:55Z', workflowName: 'CI' },
    { status: 'completed', conclusion: 'success', updatedAt: '2026-09-25T02:31:25Z', workflowName: 'CI' },
  ]);
  const readAheadBy = vi.fn(() => 33);
  const out = enrichPrsWithMainRedFacts([quietPr, redPr], { readMainRuns, readAheadBy });
  expect(readMainRuns).toHaveBeenCalledTimes(1);
  expect(readAheadBy).toHaveBeenCalledWith('ab9985630d90019a07b94e946bc75f8de7a6161f', { repo: null, base: 'main' });
  expect(out.prs[0]).toBe(quietPr); // untouched — not failing
  expect(out.prs[1]).toMatchObject({ number: 2635, requiredCheckCompletedAt: '2026-09-25T01:57:47Z', aheadByOnMain: 33 });
  expect(out.mainRedWindows).toEqual([{ start: '2026-09-25T01:30:55Z', end: '2026-09-25T02:31:25Z' }]);
});

it('enrichPrsWithMainRedFacts also enriches a PR red only on daemon-soak (soak-main-red: not test alone)', async () => {
  const { enrichPrsWithMainRedFacts } = await import('../reconcile-pass.mjs');
  const soakRed = {
    number: 2783, headRefOid: 'cec3090bc6e4342642295723c3f87f0d9216eb41', statusCheckRollup: [
      { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-09-27T02:03:00Z' },
      { __typename: 'CheckRun', name: 'daemon-soak', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: '2026-09-27T02:11:30Z' },
    ],
  };
  const readMainRuns = vi.fn(() => [{ status: 'completed', conclusion: 'failure', updatedAt: '2026-09-27T02:00:00Z', workflowName: 'CI' }]);
  const out = enrichPrsWithMainRedFacts([soakRed], { readMainRuns, readAheadBy: () => 2 });
  expect(readMainRuns).toHaveBeenCalledTimes(1);
  expect(out.prs[0]).toMatchObject({ requiredCheckName: 'daemon-soak', requiredCheckCompletedAt: '2026-09-27T02:11:30Z', aheadByOnMain: 2 });
  expect(out.mainRedWindows).toEqual([{ start: '2026-09-27T02:00:00Z', end: null }]);
});

it('defaultReadMainRuns filters to the CI workflow and passes the exact pinned argv', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync.mockReturnValueOnce(JSON.stringify([
    { databaseId: 1, workflowName: 'CI', status: 'completed', conclusion: 'success', createdAt: 'a', updatedAt: 'b' },
    { databaseId: 2, workflowName: 'release-please', status: 'completed', conclusion: 'success', createdAt: 'a', updatedAt: 'b' },
  ]));
  const { defaultReadMainRuns } = await import('../reconcile-pass.mjs');
  const runs = defaultReadMainRuns({});
  expect(runs).toEqual([{ databaseId: 1, workflowName: 'CI', status: 'completed', conclusion: 'success', createdAt: 'a', updatedAt: 'b' }]);
  expect(execFileSync).toHaveBeenCalledWith('gh', [
    'run', 'list', '--branch', 'main', '--limit', '100', '--json', 'databaseId,conclusion,status,createdAt,updatedAt,workflowName',
  ], expect.any(Object));
});

it('defaultReadAheadBy reads ahead_by off the real compare-endpoint shape, and degrades to null on any failure (best-effort)', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync.mockReturnValueOnce('33\n');
  const { defaultReadAheadBy } = await import('../reconcile-pass.mjs');
  expect(defaultReadAheadBy('ab9985630d90019a07b94e946bc75f8de7a6161f', { repo: 'chalbert/web-everything' })).toBe(33);
  expect(execFileSync).toHaveBeenCalledWith('gh', [
    'api', '--method', 'GET',
    'repos/chalbert/web-everything/compare/ab9985630d90019a07b94e946bc75f8de7a6161f...main', '--jq', '.ahead_by',
  ], expect.any(Object));

  execFileSync.mockImplementationOnce(() => { throw new Error('gh: not found'); });
  expect(defaultReadAheadBy('deadbeef', {})).toBeNull();
});

// live incident, chalbert/web-everything PR #2752 (#4034/#2748) — see `we:scripts/lib/already-landed-content.mjs`'s
// own header for the incident. These pin the IO shell that computes `alreadyLandedInMain` off per-file blob
// identity against `main`'s own history, injected so the whole path is exercisable with no real git/gh.
const HEAD_2752 = '253d75c2b82988be773903cba4e5ed172be57fb8';
const BASE_2752 = '06d01a43e0000000000000000000000000000000';
const BLOB = 'b'.repeat(40);

it('enrichPrsWithAlreadyLandedFacts skips a PR with no merge-status:conflicting label entirely — zero extra IO', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const fetchRef = vi.fn();
  const readMergeBase = vi.fn();
  const prs = [{ number: 1, labels: [{ name: 'review:changes' }] }];
  const out = enrichPrsWithAlreadyLandedFacts(prs, { fetchRef, readMergeBase });
  expect(fetchRef).not.toHaveBeenCalled();
  expect(readMergeBase).not.toHaveBeenCalled();
  expect(out).toEqual(prs);
  expect(out[0].alreadyLandedInMain).toBeUndefined();
});

it('enrichPrsWithAlreadyLandedFacts attaches alreadyLandedInMain with the attributed carrier PR when every change matches (PR #2752\'s real shape)', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const pr = {
    number: 2752, headRefName: 'lane/4034-critical-work-gate', headRefOid: HEAD_2752,
    labels: [{ name: 'review:changes' }, { name: 'merge-status:conflicting' }],
  };
  const fetchRef = vi.fn();
  const readMergeBase = vi.fn(() => BASE_2752);
  const changes = [
    { status: 'A', path: 'scripts/lib/critical-work.mjs', dstMode: '100644', dstBlob: BLOB },
    { status: 'M', path: 'scripts/lib/provider-routing.mjs', dstMode: '100644', dstBlob: BLOB },
  ];
  const readChanges = vi.fn(() => changes);
  const findMatchingCommit = vi.fn(() => '22faaaa916445657928d5e30720881b830387ab6');
  const readPulls = vi.fn(() => [2759]);
  const out = enrichPrsWithAlreadyLandedFacts([pr], { fetchRef, readMergeBase, readChanges, findMatchingCommit, readPulls });
  // Fetched by PR NUMBER — never by the author-controlled branch name (PR #2769 security review).
  expect(fetchRef).toHaveBeenCalledWith(2752, {});
  expect(readMergeBase).toHaveBeenCalledWith(HEAD_2752, 'origin/main', {});
  expect(readChanges).toHaveBeenCalledWith(BASE_2752, HEAD_2752, {});
  // Every change is searched only within `<merge-base>..origin/main`.
  expect(findMatchingCommit).toHaveBeenCalledWith(changes[0], { base: BASE_2752, mainRef: 'origin/main' });
  expect(out[0].alreadyLandedInMain).toEqual({ carrierPr: 2759 });
  // one pulls lookup per DISTINCT matched commit, never one per file.
  expect(readPulls).toHaveBeenCalledTimes(1);
});

it('enrichPrsWithAlreadyLandedFacts leaves the PR untouched when even one change has no match — never guesses partial containment', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const pr = {
    number: 2752, headRefName: 'lane/4034-critical-work-gate', headRefOid: HEAD_2752,
    labels: [{ name: 'merge-status:conflicting' }],
  };
  const readChanges = vi.fn(() => [
    { status: 'A', path: 'b.txt', dstMode: '100644', dstBlob: BLOB },
    { status: 'D', path: 'a.txt', dstMode: '000000', dstBlob: '0'.repeat(40) }, // a rename's source half
  ]);
  const findMatchingCommit = vi.fn((change) => (change.path === 'b.txt' ? 'commit1' : null));
  const out = enrichPrsWithAlreadyLandedFacts([pr], {
    fetchRef: vi.fn(), readMergeBase: () => BASE_2752, readChanges, findMatchingCommit, readPulls: vi.fn(),
  });
  expect(out[0].alreadyLandedInMain).toBeUndefined();
});

it('enrichPrsWithAlreadyLandedFacts never guesses containment with no merge-base, no readable changes, or a non-sha head', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const pr = { number: 2752, headRefOid: HEAD_2752, labels: [{ name: 'merge-status:conflicting' }] };
  const readChanges = vi.fn(() => []);
  expect(enrichPrsWithAlreadyLandedFacts([pr], { fetchRef: vi.fn(), readMergeBase: () => null, readChanges })[0]
    .alreadyLandedInMain).toBeUndefined();
  expect(readChanges).not.toHaveBeenCalled();
  expect(enrichPrsWithAlreadyLandedFacts([pr], { fetchRef: vi.fn(), readMergeBase: () => BASE_2752, readChanges })[0]
    .alreadyLandedInMain).toBeUndefined();
  const readMergeBase = vi.fn();
  const hostile = { ...pr, headRefOid: '--output=/x' };
  expect(enrichPrsWithAlreadyLandedFacts([hostile], { fetchRef: vi.fn(), readMergeBase })[0]).toBe(hostile);
  expect(readMergeBase).not.toHaveBeenCalled();
});

it('defaultFetchRef fetches refs/pull/<n>/head behind --end-of-options into an explicit destination — never the branch name (PR #2769 security review)', async () => {
  const { defaultFetchRef } = await import('../reconcile-pass.mjs');
  const exec = vi.fn();
  defaultFetchRef(2752, { exec });
  expect(exec).toHaveBeenCalledWith('git', [
    'fetch', '--quiet', '--end-of-options', 'origin', '+refs/pull/2752/head:refs/already-landed/pr/2752',
  ], expect.any(Object));
  // A hostile branch-name-shaped value (the live exploit: `--upload-pack=<cmd>`) never reaches git at all.
  exec.mockClear();
  for (const bad of ['--upload-pack=touch /tmp/x;', 'lane/x', '0', '-1', '12abc', null, undefined, 2.5]) defaultFetchRef(bad, { exec });
  expect(exec).not.toHaveBeenCalled();
  expect(() => defaultFetchRef(1, { exec: () => { throw new Error('offline'); } })).not.toThrow();
});

it('defaultReadMergeBase / defaultReadChanges guard their revisions and degrade to null / [] on failure', async () => {
  const { defaultReadMergeBase, defaultReadChanges } = await import('../reconcile-pass.mjs');
  const exec = vi.fn(() => `${BASE_2752}\n`);
  expect(defaultReadMergeBase(HEAD_2752, 'origin/main', { exec })).toBe(BASE_2752);
  expect(exec).toHaveBeenCalledWith('git', ['merge-base', '--end-of-options', HEAD_2752, 'origin/main'], expect.any(Object));
  expect(defaultReadMergeBase('--evil', 'origin/main', { exec: vi.fn() })).toBeNull();
  expect(defaultReadMergeBase(HEAD_2752, 'origin/main', { exec: () => { throw new Error('x'); } })).toBeNull();

  const raw = `:100644 100755 ${BLOB} ${BLOB} M\0s.sh\0`;
  const dexec = vi.fn(() => raw);
  expect(defaultReadChanges(BASE_2752, HEAD_2752, { exec: dexec })).toEqual([
    { status: 'M', path: 's.sh', dstMode: '100755', dstBlob: BLOB },
  ]);
  expect(dexec).toHaveBeenCalledWith('git', [
    'diff', '--raw', '-z', '--no-renames', '--no-abbrev', '--end-of-options', BASE_2752, HEAD_2752,
  ], expect.any(Object));
  expect(defaultReadChanges('nope', HEAD_2752, { exec: dexec })).toEqual([]);
  expect(defaultReadChanges(BASE_2752, HEAD_2752, { exec: () => { throw new Error('x'); } })).toEqual([]);
});

// These four inject `exec` EXPLICITLY (mirroring `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`'s own
// `spyExec` pattern) rather than relying on the module-level `node:child_process` mock: that mock is already
// proven to work for `execFileSyncThrottled` (a SEPARATE mocked module wrapping it) elsewhere in this file, but
// a direct default-parameter reference to the bare `execFileSync` binding inside a freshly-added function here
// was measured, live, to bypass it and run REAL git — explicit injection is the reliable, established way this
// codebase asserts an exact argv with no dependence on that mock's own quirks.
it('defaultReadEntryAt reads {mode, blob} for exactly the named path via ls-tree; null only for a clean absence, THROWS on a failed read', async () => {
  const { defaultReadEntryAt } = await import('../reconcile-pass.mjs');
  const exec = vi.fn(() => `100755 blob 774a24d2703ada7a5c3bec4ced8696b13a5f6026\tscripts/run.sh\0`);
  expect(defaultReadEntryAt('253d75c2b', 'scripts/run.sh', { exec })).toEqual({ mode: '100755', blob: '774a24d2703ada7a5c3bec4ced8696b13a5f6026' });
  expect(exec).toHaveBeenCalledWith('git', [
    '--literal-pathspecs', 'ls-tree', '-z', '--full-tree', '--end-of-options', '253d75c2b', '--', 'scripts/run.sh',
  ], expect.any(Object));
  expect(defaultReadEntryAt('253d75c2b', 'missing.mjs', { exec: () => '' })).toBeNull();
  // A failed read is NOT absence — `null` would let a deletion pass for landed (PR #2769 review, round 2).
  expect(() => defaultReadEntryAt('deadbeef', 'x.mjs', { exec: () => { throw new Error('fatal: bad revision'); } })).toThrow(/bad revision/);
});

describe('defaultTipCarriesChange — main\'s tip still carries the PR\'s change (PR #2769 review, round 2)', () => {
  const OLD = 'a'.repeat(40);
  const TIP = 'd'.repeat(40);
  const blobs = (map) => vi.fn((cmd, args) => {
    if (args[0] === 'cat-file') return map[args.at(-1)];
    if (args[0] === 'merge-file') return map.merged;
    throw new Error(`unexpected ${args.join(' ')}`);
  });

  it('edited file: a conflict-free `git merge-file` of the PR into the tip must reproduce the tip exactly', async () => {
    const { defaultTipCarriesChange } = await import('../reconcile-pass.mjs');
    const exec = blobs({ [TIP]: 'a\nfeature=true\nunrelated=1\n', merged: 'a\nfeature=true\nunrelated=1\n' });
    expect(defaultTipCarriesChange(TIP, OLD, BLOB, { exec })).toBe(true);
    expect(exec).toHaveBeenCalledWith('git', ['merge-file', '-p', '--object-id', '--end-of-options', TIP, OLD, BLOB], expect.any(Object));
    // the merge re-applied the PR's change (main had reverted it) — the tip does not carry it.
    expect(defaultTipCarriesChange(TIP, OLD, BLOB, { exec: blobs({ [TIP]: 'a\nfeature=false\nunrelated=1\n', merged: 'a\nfeature=true\nunrelated=1\n' }) })).toBe(false);
  });

  it('edited file: a merge conflict (non-zero exit) throws for the caller to fail closed', async () => {
    const { defaultTipCarriesChange } = await import('../reconcile-pass.mjs');
    const exec = vi.fn((cmd, args) => { if (args[0] === 'merge-file') throw new Error('exit 1: 1 conflict'); return 'x\n'; });
    expect(() => defaultTipCarriesChange(TIP, OLD, BLOB, { exec })).toThrow(/conflict/);
  });

  it('added file: never merged against git\'s empty blob — the PR\'s whole text must sit in the tip unbroken', async () => {
    const { defaultTipCarriesChange } = await import('../reconcile-pass.mjs');
    const exec = blobs({ [TIP]: 'l1\nl2\nrefined\n', [BLOB]: 'l1\nl2\n' });
    expect(defaultTipCarriesChange(TIP, null, BLOB, { exec })).toBe(true);
    expect(exec).toHaveBeenCalledWith('git', ['cat-file', 'blob', '--end-of-options', BLOB], expect.any(Object));
    expect(exec.mock.calls.some(([, args]) => args[0] === 'merge-file')).toBe(false);
    expect(defaultTipCarriesChange(TIP, null, BLOB, { exec: blobs({ [TIP]: 'l1\nmid\nl2\n', [BLOB]: 'l1\nl2\n' }) })).toBe(false);
  });

  it('refuses a non-sha argument before any git call', async () => {
    const { defaultTipCarriesChange } = await import('../reconcile-pass.mjs');
    const exec = vi.fn();
    expect(defaultTipCarriesChange('--upload-pack=x', OLD, BLOB, { exec })).toBe(false);
    expect(defaultTipCarriesChange(TIP, '-x', BLOB, { exec })).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });
});

describe('defaultFindMatchingMainCommit — searches only `<merge-base>..main`, per change status (PR #2769 review)', () => {
  const base = BASE_2752;
  const mainRef = 'origin/main';

  it('A/M: returns the first in-window commit whose entry has the SAME blob AND mode, most-recent-first', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const exec = vi.fn(() => 'commitA\ncommitB\ncommitC\n');
    const readEntryAt = vi.fn((ref) => {
      if (ref === base) return null; // an added file: absent at the PR's base
      return ref === 'commitB' || ref === mainRef ? { mode: '100644', blob: BLOB } : { mode: '100644', blob: 'c'.repeat(40) };
    });
    const change = { status: 'A', path: 'scripts/lib/critical-work.mjs', dstMode: '100644', dstBlob: BLOB };
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec, readEntryAt })).toBe('commitB');
    expect(exec).toHaveBeenCalledWith('git', [
      '--literal-pathspecs', 'log', '--format=%H', '-n300', `${base}..origin/main`, '--', 'scripts/lib/critical-work.mjs',
    ], expect.any(Object));
  });

  it('A/M: a same-blob, different-mode entry is NOT a match — a mode-only change is never "landed" by its old blob', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const change = { status: 'M', path: 's.sh', dstMode: '100755', dstBlob: BLOB };
    const readEntryAt = () => ({ mode: '100644', blob: BLOB });
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec: () => 'c1\n', readEntryAt })).toBeNull();
  });

  it('A/M: an in-window match that main later UNDID is not landed — tip gone, or tip back at the base version', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const exec = () => 'carrier\n';
    const OLD = 'a'.repeat(40);
    const add = { status: 'A', path: 'n.mjs', dstMode: '100644', dstBlob: BLOB };
    // added by a carrier, then the add was reverted: gone from the tip.
    expect(defaultFindMatchingMainCommit(add, { base, mainRef, exec, readEntryAt: (ref) => (ref === 'carrier' ? { mode: '100644', blob: BLOB } : null) })).toBeNull();
    // modified by a carrier, then reverted: the tip holds the base version again.
    const mod = { status: 'M', path: 'm.mjs', dstMode: '100644', dstBlob: BLOB };
    const entry = (ref) => (ref === 'carrier' ? { mode: '100644', blob: BLOB } : { mode: '100644', blob: OLD });
    // (a revert makes the merge re-apply the PR's change, so the tip-carries check says no)
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: entry, tipCarriesChange: () => false })).toBeNull();
  });

  // `main` held the PR's BLOB at `carrier`, then moved the file on to TIP.
  const OLD = 'a'.repeat(40);
  const TIP = 'd'.repeat(40);
  const refinedEntry = (ref) => (ref === 'carrier' ? { mode: '100644', blob: BLOB }
    : ref === base ? { mode: '100644', blob: OLD } : { mode: '100644', blob: TIP });
  const mod = { status: 'M', path: 'm.mjs', dstMode: '100644', dstBlob: BLOB };

  it('A/M: refined after the carry is landed only when the tip still carries the PR\'s change (PR #2769 review, round 2)', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const exec = () => 'carrier\n';
    const carries = vi.fn(() => true);
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: refinedEntry, tipCarriesChange: carries })).toBe('carrier');
    expect(carries).toHaveBeenCalledWith(TIP, OLD, BLOB, expect.any(Object));
    // the transient-carry and revert-plus-unrelated-edit shapes: main held BLOB once, the tip no longer carries it.
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: refinedEntry, tipCarriesChange: () => false })).toBeNull();
    // a failed check (conflict, binary, git error) fails closed.
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: refinedEntry, tipCarriesChange: () => { throw new Error('conflict'); } })).toBeNull();
    // the tip IS the PR's blob: no content check needed.
    const exact = vi.fn();
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: (ref) => (ref === base ? { mode: '100644', blob: OLD } : { mode: '100644', blob: BLOB }), tipCarriesChange: exact })).toBe('carrier');
    expect(exact).not.toHaveBeenCalled();
  });

  it('A/M: the tip must keep the PR\'s mode; an added file is checked with a null base', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const exec = () => 'carrier\n';
    const modeFlipped = (ref) => (ref === mainRef ? { mode: '100755', blob: BLOB } : refinedEntry(ref));
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: modeFlipped, tipCarriesChange: () => true })).toBeNull();
    const add = { status: 'A', path: 'n.mjs', dstMode: '100644', dstBlob: BLOB };
    const carries = vi.fn(() => true);
    const addEntry = (ref) => (ref === base ? null : refinedEntry(ref));
    expect(defaultFindMatchingMainCommit(add, { base, mainRef, exec, readEntryAt: addEntry, tipCarriesChange: carries })).toBe('carrier');
    expect(carries).toHaveBeenCalledWith(TIP, null, BLOB, expect.any(Object));
    // an M whose path is missing at the PR's base is inconsistent — never guessed.
    expect(defaultFindMatchingMainCommit(mod, { base, mainRef, exec, readEntryAt: addEntry, tipCarriesChange: () => true })).toBeNull();
  });

  it('D: landed only when the path is gone from main\'s tip AND an in-window commit deleted it', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const change = { status: 'D', path: 'dead.mjs', dstMode: '000000', dstBlob: '0'.repeat(40) };
    const exec = vi.fn(() => 'delcommit\n');
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec, readEntryAt: () => null })).toBe('delcommit');
    expect(exec).toHaveBeenCalledWith('git', [
      '--literal-pathspecs', 'log', '--format=%H', '-n300', '--diff-filter=D', `${base}..origin/main`, '--', 'dead.mjs',
    ], expect.any(Object));
    // still alive on main (e.g. a rename's source main kept editing) — never landed, no log read at all.
    const exec2 = vi.fn();
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec: exec2, readEntryAt: () => ({ mode: '100644', blob: BLOB }) })).toBeNull();
    expect(exec2).not.toHaveBeenCalled();
    // gone from the tip but no in-window deletion (it was deleted before the PR's base) — never landed.
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec: () => '', readEntryAt: () => null })).toBeNull();
  });

  it('D: a FAILED tip read is not absence — main deleted then re-added the path, the tip ls-tree times out (PR #2769 review, round 2)', async () => {
    const { defaultFindMatchingMainCommit, defaultReadEntryAt } = await import('../reconcile-pass.mjs');
    const change = { status: 'D', path: 'dead.mjs', dstMode: '000000', dstBlob: '0'.repeat(40) };
    // Real reader, injected exec: the ls-tree fails, the log would find the earlier in-window deletion.
    const exec = vi.fn((cmd, args) => {
      if (args.includes('ls-tree')) throw new Error('ETIMEDOUT');
      return 'olddelete\n';
    });
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec, readEntryAt: defaultReadEntryAt })).toBeNull();
    expect(exec.mock.calls.some(([, args]) => args.includes('log'))).toBe(false);
  });

  it('an unsupported status (type change, unmerged) never matches', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const exec = vi.fn(() => 'c1\n');
    for (const status of ['T', 'U', 'X']) {
      expect(defaultFindMatchingMainCommit({ status, path: 'a', dstMode: '120000', dstBlob: BLOB }, { base, mainRef, exec, readEntryAt: () => ({ mode: '120000', blob: BLOB }) })).toBeNull();
    }
    expect(exec).not.toHaveBeenCalled();
  });

  it('returns null (never throws) with no base / main ref, or when the log read fails', async () => {
    const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
    const change = { status: 'A', path: 'a.mjs', dstMode: '100644', dstBlob: BLOB };
    expect(defaultFindMatchingMainCommit(change, { base: null, mainRef })).toBeNull();
    expect(defaultFindMatchingMainCommit(change, { base, mainRef: null })).toBeNull();
    expect(defaultFindMatchingMainCommit(change, { base, mainRef, exec: () => { throw new Error('not a git repo'); } })).toBeNull();
  });
});

it('defaultReadPullsForCommit reads the PR numbers GitHub associates with a commit, degrading to [] on any failure', async () => {
  const { execFileSyncThrottled } = await import('../../lib/gh-throttle.mjs');
  execFileSyncThrottled.mockReturnValueOnce('2759\n');
  const { defaultReadPullsForCommit } = await import('../reconcile-pass.mjs');
  expect(defaultReadPullsForCommit('22faaaa9', { repo: 'chalbert/web-everything' })).toEqual([2759]);
  expect(execFileSyncThrottled).toHaveBeenCalledWith('gh', [
    'api', 'repos/chalbert/web-everything/commits/22faaaa9/pulls', '--jq', '.[].number',
  ], expect.any(Object));

  execFileSyncThrottled.mockImplementationOnce(() => { throw new Error('404'); });
  expect(defaultReadPullsForCommit('deadbeef', {})).toEqual([]);
});
