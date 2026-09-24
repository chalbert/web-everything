/**
 * @file scripts/readiness/__tests__/conveyor-state-pr-list-single-spawn.test.mjs
 * @description Spawn-count budget test for `conveyor-state.mjs`'s PR-picture read, named as a candidate in
 *   x3xz8qp/#3988 (the work-bound-tests item this file answers): "conveyor-state.mjs's per-PR `gh` enrichment
 *   calls". Audited directly (see this item's PR description): there is exactly ONE `gh` spawn in the whole
 *   file — a single batched `gh pr list --state open --limit 100 --json number,state,statusCheckRollup,labels,
 *   headRefName,mergeStateStatus,comments` that fetches every open PR's full shape (including `comments`, so
 *   `shapePrs` never needs a second per-PR round-trip to derive `stoodDown`) — never a loop that re-fetches or
 *   enriches per PR. So this file's job is not to FIX a fan-out (there isn't one) but to PIN it: a future change
 *   that re-introduced a per-PR `gh pr view`/`gh pr checks` call (the exact shape #2542/#2547/#2920 killed for
 *   `lane-pool.mjs`, and the shape `dispatch-plan.mjs`'s already-done pass deliberately accepts ONLY because it
 *   is genuinely per-ITEM, not per-PR-times-something) would regress silently without a spawn-count assertion.
 *
 *   Runs the REAL `conveyor-state.mjs` CLI in FIXTURE MODE (`--backlog-dir`, #x7xv2xt — this ALSO skips
 *   `lane-pool.mjs`/`scope-lease-collect.mjs`, so the only `gh`/`git`-adjacent spawn left is the PR read) with a
 *   fake `gh` on `PATH` ({@link withFakeGh}) standing in for GitHub. Asserts the `gh` spawn count directly from
 *   the fake's own call log — never wall time — at two very different open-PR counts, so it can't pass by
 *   accident at a small N.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withFakeGh } from '../../conveyor/__tests__/helpers/fake-gh.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const STATE_CLI = join(ROOT, 'scripts', 'readiness', 'conveyor-state.mjs');

const prListCalls = (fakeGh) => fakeGh.calls().filter((c) => c.argv[0] === 'pr' && c.argv[1] === 'list');
// EVERY `gh` call the run made, of any subcommand — not just `pr list`. A per-PR enrichment regression (the
// exact shape this file exists to catch) would most plausibly add a per-PR `gh pr view` call rather than a
// SECOND `pr list`, so the budget must be on total `gh` spawns, never narrowed to one verb.
const allGhCalls = (fakeGh) => fakeGh.calls();

function fakePr(i) {
  return {
    number: 10000 + i, state: 'OPEN', headRefName: `lane/fixture-${i}`,
    statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    labels: [], mergeStateStatus: 'CLEAN', comments: [],
  };
}

function runState(backlogDir, fakeGh, nPrs) {
  const env = { ...process.env, ...fakeGh.env };
  const out = execFileSync(
    'node',
    [STATE_CLI, '--json', `--backlog-dir=${backlogDir}`, '--repo=fixture-org/fixture-repo'],
    { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 },
  );
  const state = JSON.parse(out);
  expect(state.prs.length).toBe(nPrs);
  return state;
}

describe('conveyor-state.mjs PR read — ONE `gh` spawn total, independent of open-PR count (x3xz8qp/#3988)', () => {
  it('a handful of open PRs costs exactly one `gh pr list` spawn', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'conveyor-state-spawn-'));
    const backlogDir = join(fixtureRoot, 'backlog');
    mkdirSync(backlogDir, { recursive: true });
    const fakeGh = withFakeGh({ prs: Array.from({ length: 5 }, (_, i) => fakePr(i)) });
    try {
      runState(backlogDir, fakeGh, 5);
      expect(prListCalls(fakeGh).length).toBe(1);
      expect(allGhCalls(fakeGh).length).toBe(1); // no OTHER gh call hiding behind the one `pr list`
    } finally {
      fakeGh.cleanup();
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('150 open PRs STILL costs exactly one `gh pr list` spawn — the count does not scale with PR volume', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'conveyor-state-spawn-'));
    const backlogDir = join(fixtureRoot, 'backlog');
    mkdirSync(backlogDir, { recursive: true });
    const N = 150;
    const fakeGh = withFakeGh({ prs: Array.from({ length: N }, (_, i) => fakePr(i)) });
    try {
      const state = runState(backlogDir, fakeGh, N);
      const calls = prListCalls(fakeGh);
      // Pinned exactly, not just "under a ceiling" — this endpoint is a single batched read by design (the
      // docblock above), so ANY count other than 1 is a regression, in either direction.
      expect(calls.length).toBe(1);
      expect(calls[0].argv).toEqual(expect.arrayContaining(['--repo=fixture-org/fixture-repo']));
      // The decisive assertion: total `gh` spawns of ANY subcommand stays at 1 even at N=150 PRs — a per-PR
      // enrichment regression (e.g. a `gh pr view` added per row) would push this to N+1, not just add a
      // second `pr list`.
      expect(allGhCalls(fakeGh).length).toBe(1);
      // Every PR really was shaped from the ONE call's payload (comments included, for `stoodDown`), not dropped.
      expect(state.prs.every((p) => 'stoodDown' in p)).toBe(true);
    } finally {
      fakeGh.cleanup();
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
