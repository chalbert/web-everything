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
