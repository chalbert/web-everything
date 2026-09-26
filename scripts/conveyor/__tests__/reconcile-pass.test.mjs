import { vi, it, expect } from 'vitest';


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
it('enrichPrsWithAlreadyLandedFacts skips a PR with no merge-status:conflicting label entirely — zero extra IO', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const readFiles = vi.fn();
  const prs = [{ number: 1, labels: [{ name: 'review:changes' }] }];
  const out = enrichPrsWithAlreadyLandedFacts(prs, { readFiles });
  expect(readFiles).not.toHaveBeenCalled();
  expect(out).toEqual(prs);
  expect(out[0].alreadyLandedInMain).toBeUndefined();
});

it('enrichPrsWithAlreadyLandedFacts attaches alreadyLandedInMain with the attributed carrier PR when every file matches (PR #2752\'s real shape)', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const pr = {
    number: 2752, headRefName: 'lane/4034-critical-work-gate', headRefOid: '253d75c2b82988be773903cba4e5ed172be57fb8',
    labels: [{ name: 'review:changes' }, { name: 'merge-status:conflicting' }],
  };
  const readFiles = vi.fn(() => ['scripts/lib/critical-work.mjs', 'scripts/lib/__tests__/critical-work.test.mjs']);
  const fetchRef = vi.fn();
  const readBlobAt = vi.fn((ref, file) => `${ref}:${file}`.slice(0, 10)); // any stable per-(ref,file) fake blob
  const findMatchingCommit = vi.fn(() => '22faaaa916445657928d5e30720881b830387ab6');
  const readPulls = vi.fn(() => [2759]);
  const out = enrichPrsWithAlreadyLandedFacts([pr], { readFiles, fetchRef, readBlobAt, findMatchingCommit, readPulls });
  expect(readFiles).toHaveBeenCalledWith(2752, { repo: null });
  expect(fetchRef).toHaveBeenCalledWith('lane/4034-critical-work-gate', {});
  expect(out[0].alreadyLandedInMain).toEqual({ carrierPr: 2759 });
  // one pulls lookup per DISTINCT matched commit, never one per file.
  expect(readPulls).toHaveBeenCalledTimes(1);
});

it('enrichPrsWithAlreadyLandedFacts leaves the PR untouched when even one file has no match — never guesses partial containment', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const pr = {
    number: 2752, headRefName: 'lane/4034-critical-work-gate', headRefOid: 'deadbeef',
    labels: [{ name: 'merge-status:conflicting' }],
  };
  const readFiles = vi.fn(() => ['a.mjs', 'b.mjs']);
  const readBlobAt = vi.fn(() => 'someblob');
  const findMatchingCommit = vi.fn((file) => (file === 'a.mjs' ? 'commit1' : null));
  const out = enrichPrsWithAlreadyLandedFacts([pr], { readFiles, fetchRef: vi.fn(), readBlobAt, findMatchingCommit, readPulls: vi.fn() });
  expect(out[0].alreadyLandedInMain).toBeUndefined();
});

it('enrichPrsWithAlreadyLandedFacts never guesses containment when the PR\'s files could not even be read', async () => {
  const { enrichPrsWithAlreadyLandedFacts } = await import('../reconcile-pass.mjs');
  const pr = { number: 2752, headRefOid: 'deadbeef', labels: [{ name: 'merge-status:conflicting' }] };
  const out = enrichPrsWithAlreadyLandedFacts([pr], { readFiles: () => [] });
  expect(out[0].alreadyLandedInMain).toBeUndefined();
});

it('defaultReadPrFiles reads the changed-file paths off `gh pr view --json files`, degrading to [] on any failure', async () => {
  const { execFileSyncThrottled } = await import('../../lib/gh-throttle.mjs');
  execFileSyncThrottled.mockReturnValueOnce(JSON.stringify({ files: [{ path: 'a.mjs' }, { path: 'b.mjs' }] }));
  const { defaultReadPrFiles } = await import('../reconcile-pass.mjs');
  expect(defaultReadPrFiles(2752, { repo: 'chalbert/web-everything' })).toEqual(['a.mjs', 'b.mjs']);
  expect(execFileSyncThrottled).toHaveBeenCalledWith('gh', ['pr', 'view', '2752', '--json', 'files', '--repo', 'chalbert/web-everything'], expect.any(Object));

  execFileSyncThrottled.mockImplementationOnce(() => { throw new Error('gh: not found'); });
  expect(defaultReadPrFiles(2752, {})).toEqual([]);
});

// These four inject `exec` EXPLICITLY (mirroring `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`'s own
// `spyExec` pattern) rather than relying on the module-level `node:child_process` mock: that mock is already
// proven to work for `execFileSyncThrottled` (a SEPARATE mocked module wrapping it) elsewhere in this file, but
// a direct default-parameter reference to the bare `execFileSync` binding inside a freshly-added function here
// was measured, live, to bypass it and run REAL git — explicit injection is the reliable, established way this
// codebase asserts an exact argv with no dependence on that mock's own quirks.
it('defaultReadBlobAt reads a git blob OID via rev-parse, degrading to null on any failure', async () => {
  const { defaultReadBlobAt } = await import('../reconcile-pass.mjs');
  const exec = vi.fn(() => '774a24d2703ada7a5c3bec4ced8696b13a5f6026\n');
  expect(defaultReadBlobAt('253d75c2b', 'scripts/lib/critical-work.mjs', { exec })).toBe('774a24d2703ada7a5c3bec4ced8696b13a5f6026');
  expect(exec).toHaveBeenCalledWith('git', ['rev-parse', '253d75c2b:scripts/lib/critical-work.mjs'], expect.any(Object));

  const throwingExec = vi.fn(() => { throw new Error('fatal: bad revision'); });
  expect(defaultReadBlobAt('deadbeef', 'missing.mjs', { exec: throwingExec })).toBeNull();
});

it('defaultFindMatchingMainCommit walks main\'s own log for the file and returns the first blob-identical commit, most-recent-first', async () => {
  const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
  const exec = vi.fn(() => 'commitA\ncommitB\ncommitC\n');
  const readBlobAt = vi.fn((ref) => (ref === 'commitB' ? 'targetblob' : 'other'));
  const found = defaultFindMatchingMainCommit('scripts/lib/critical-work.mjs', 'targetblob', { exec, readBlobAt });
  expect(found).toBe('commitB');
  expect(exec).toHaveBeenCalledWith('git', [
    'log', '--format=%H', '-n300', 'origin/main', '--', 'scripts/lib/critical-work.mjs',
  ], expect.any(Object));
});

it('defaultFindMatchingMainCommit returns null (never throws) with no target blob, or when the log read fails', async () => {
  const { defaultFindMatchingMainCommit } = await import('../reconcile-pass.mjs');
  expect(defaultFindMatchingMainCommit('a.mjs', null)).toBeNull();
  const throwingExec = vi.fn(() => { throw new Error('not a git repo'); });
  expect(defaultFindMatchingMainCommit('a.mjs', 'blob', { exec: throwingExec })).toBeNull();
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
