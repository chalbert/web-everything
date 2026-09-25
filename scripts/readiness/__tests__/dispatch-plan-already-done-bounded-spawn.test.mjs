/**
 * @file scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs
 * @description Spawn-count budget test for `dispatch-plan.mjs`'s ALREADY-DONE ground-truth pass (#3457/#3460),
 *   named as a candidate in x3xz8qp/#3988 (the work-bound-tests item this file answers): "dispatch-plan.mjs's
 *   already-done ground-truth `gh pr list --search` per stale queue id (already made concurrent, not
 *   spawn-bounded, per its own #3383 header comment)".
 *
 *   `defaultCheckAlreadyDoneAsync`'s own docblock (`scripts/operations/dispatch-lane-io.mjs`) says the shape
 *   plainly: "The check itself (one `gh` call per id) is unavoidable — there is no bulk … query `gh pr list
 *   --search` supports". So ONE `gh` spawn per stale item is the INHERENT, accepted cost (linear-in-items, never
 *   multiplicative) — #3383's own live incident was the sequential-round-trip WALL-TIME cost, fixed by running
 *   the checks concurrently (`Promise.all`), not by reducing the spawn count. This file pins the spawn-count
 *   side of that fix, which nothing before it asserted: total `gh` spawns for one dispatch-plan tick must equal
 *   exactly the number of age-gated-stale ids (queue + cleared-but-not-ready), and must NOT grow with any OTHER
 *   fan-out dimension in the same tick — the free-lane count, or the number of PRs the (fake) `gh` already knows
 *   about. A regression that re-checked every stale id once per free lane, or once per known PR, would blow this
 *   budget up exactly the way #2542/#2547/#2920's `git cherry`/`merge-base` loops did for `lane-pool.mjs`.
 *
 *   Runs the REAL `dispatch-plan.mjs` CLI in FIXTURE MODE (`--backlog-dir`, #x7xv2xt) so the real lane pool /
 *   `scope-lease-collect.mjs` are never touched (fixtureMode short-circuits both), with `--no-drift-check
 *   --no-pause-check --no-pr-limit-check` dropping the OTHER best-effort child spawns (we:xniq7xs added the
 *   third), and a fake `gh` on `PATH`
 *   ({@link withFakeGh}, the SAME shim `dispatcher-fixture-harness.test.mjs` uses) standing in for GitHub so the
 *   test costs nothing and needs no auth/network. Every `gh pr list …` call it receives is logged, so the
 *   assertions are on SPAWN COUNT, never wall time — this can't flake under load.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withFakeGh } from '../../conveyor/__tests__/helpers/fake-gh.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PLAN_CLI = join(ROOT, 'scripts', 'readiness', 'dispatch-plan.mjs');

/** One fixture backlog item — frontmatter (JSON values are valid YAML) + a one-line body. */
function writeItem(dir, filename, frontmatter, title) {
  const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  writeFileSync(join(dir, filename), `---\n${fm}\n---\n\n# ${title}\n`, 'utf8');
}

/** Every `pr list` call a fake-gh instance's log recorded. */
const prListCalls = (fakeGh) => fakeGh.calls().filter((c) => c.argv[0] === 'pr' && c.argv[1] === 'list');

const N_READY = 60; // ready, cleared, stale queue items
const N_NOT_READY = 10; // cleared-but-blocked (notReady) stale items — the OTHER stale-id population
const N_FILLER_PRS = 300; // unrelated PRs the fake `gh` already "knows about" — must not multiply the spawn count

function buildFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'dispatch-plan-bound-spawn-'));
  const backlogDir = join(fixtureRoot, 'backlog');
  mkdirSync(backlogDir, { recursive: true });
  const queueFile = join(fixtureRoot, 'queue.json');

  const cleared = [];
  // Ready, unblocked, disjoint-scope items — old enough (`dateOpened` far in the past) to clear
  // `ALREADY_DONE_AGE_GATE_MS` deterministically (never relying on the missing-date fallback).
  for (let i = 0; i < N_READY; i++) {
    const num = String(8000 + i);
    writeItem(backlogDir, `${num}-fixture-ready-${i}.md`, {
      bornAs: `x${num}fix`, kind: 'story', size: 1, status: 'open',
      scope: [`we:scripts/fixture-ready-${i}.mjs`], dateOpened: '2020-01-01', tags: [],
    }, `Ready fixture item ${i}`);
    cleared.push({ num, addedAt: new Date().toISOString() });
  }
  // Cleared-but-blocked items — land in `notReady` (a ready-queue row never exists for them), the SECOND
  // stale-id population `dispatch-plan.mjs` checks separately (`staleNotReadyIds`).
  for (let i = 0; i < N_NOT_READY; i++) {
    const num = String(8100 + i);
    writeItem(backlogDir, `${num}-fixture-blocked-${i}.md`, {
      bornAs: `x${num}fix`, kind: 'story', size: 1, status: 'open',
      scope: [`we:scripts/fixture-blocked-${i}.mjs`], blockedBy: ['9999'], dateOpened: '2020-01-01', tags: [],
    }, `Blocked fixture item ${i}`);
    cleared.push({ num, addedAt: new Date().toISOString() });
  }
  writeFileSync(queueFile, JSON.stringify(cleared, null, 2), 'utf8');

  const fillerPrs = Array.from({ length: N_FILLER_PRS }, (_, i) => ({
    number: 20000 + i, state: 'MERGED', headRefName: `lane/unrelated-${i}`,
    statusCheckRollup: [], labels: [], mergeStateStatus: 'CLEAN',
  }));

  return { fixtureRoot, backlogDir, queueFile, fillerPrs };
}

describe('dispatch-plan.mjs already-done ground truth — spawn count is LINEAR in stale ids, never multiplicative (#3457/#3460, x3xz8qp)', () => {
  it('spends exactly one `gh` spawn per stale id, regardless of free-lane count or how many PRs `gh` already knows about', () => {
    const { fixtureRoot, backlogDir, queueFile, fillerPrs } = buildFixture();
    const fakeGh = withFakeGh({ prs: fillerPrs });
    try {
      const env = { ...process.env, ...fakeGh.env, CONVEYOR_QUEUE_FILE: queueFile };
      // A LARGE explicit free-lane list — a second fan-out dimension in the very same tick. If the already-done
      // pass ever regressed to checking each stale id once per free lane (or per known PR), this is exactly
      // the shape that would multiply it out.
      const freeLanes = Array.from({ length: 80 }, (_, i) => 9000 + i).join(',');
      const out = execFileSync(
        'node',
        [PLAN_CLI, '--json', `--backlog-dir=${backlogDir}`, `--free-lanes=${freeLanes}`, '--no-drift-check', '--no-pause-check', '--no-pr-limit-check'],
        { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 },
      );
      const plan = JSON.parse(out);
      // Sanity: the fixture actually reached the dispatcher (all ready items present, held or launched).
      const allNums = [...plan.launch.map((l) => String(l.num)), ...plan.held.map((h) => String(h.num))];
      expect(allNums.length).toBeGreaterThanOrEqual(N_READY);

      const calls = prListCalls(fakeGh);
      // Exactly one `gh pr list --search` per stale id (60 ready + 10 not-ready) — the INHERENT linear cost,
      // pinned exactly (not just "under a generous ceiling") because the code's own docblock says this ratio IS
      // the design, not an approximation of it.
      expect(calls.length).toBe(N_READY + N_NOT_READY);
      // Every recorded call really is the age-gated already-done search, not some other `gh` verb.
      for (const c of calls) expect(c.argv).toEqual(expect.arrayContaining(['pr', 'list', '--search']));
    } finally {
      fakeGh.cleanup();
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it('`--no-ground-truth` drops the spawn count to zero — the escape hatch really disables the axis', () => {
    const { fixtureRoot, backlogDir, queueFile, fillerPrs } = buildFixture();
    const fakeGh = withFakeGh({ prs: fillerPrs });
    try {
      const env = { ...process.env, ...fakeGh.env, CONVEYOR_QUEUE_FILE: queueFile };
      execFileSync(
        'node',
        [PLAN_CLI, '--json', `--backlog-dir=${backlogDir}`, '--free-lanes=1', '--no-drift-check', '--no-pause-check', '--no-ground-truth', '--no-pr-limit-check'],
        { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 },
      );
      expect(prListCalls(fakeGh).length).toBe(0);
    } finally {
      fakeGh.cleanup();
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
