/**
 * @file scripts/operations/__tests__/land-advance-io-real.test.mjs
 * @description THE REAL-MECHANISM half of `land-advance-io.mjs` (#2949's fidelity qualifier, motivated by
 *   #3264). Its sibling `land-advance-io.test.mjs` drives every DECISION through injected doubles, and
 *   those stay: they pin judgement, not mechanics. This file exists because two things that module does
 *   have no honest double:
 *
 *   • THE BRANCH-DISTANCE READ. The reader's default `prototype` source runs `git rev-list --left-right
 *     --count origin/main...origin/lane/mechanical-dispatcher`, and the sibling suite answers it with a
 *     stub returning `'321 180'`. A stub has no clone geometry. `git fetch origin` writes
 *     `refs/remotes/origin/<branch>` only when the clone's configured refspec covers that branch, which is
 *     true of a full clone and false of a `--single-branch` one, so the number the operator reads is only
 *     right on the geometry the stub cannot have. `withBareOrigin` / `withNarrowClone` supply both.
 *   • THE FILE MECHANISMS. `readJsonlTail` seeks into a real file and drops the torn first line of a capped
 *     read; `writeFollowUp` / `readFollowUps` round-trip through a real run-store directory. An injected
 *     `fs` cannot say whether a seek lands mid-line, or whether the directory is created.
 *
 * No `gh`, no `claude`, no network. The repo listing is an empty swept-repos file and the lane listing is
 * answered by the `run` wrapper below, so no live PR or session is ever read. Only `git` runs for real,
 * against a temp clone whose `origin` is a bare directory on this machine (never a URL: see
 * `real-repo.mjs` detail (2)).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { withBareOrigin, withNarrowClone } from './helpers/real-repo.mjs';
import { createLandAdvanceReader, readJsonlTail, readFollowUps, writeFollowUp } from '../land-advance-io.mjs';
import { createFileRunStore } from '../run-store.mjs';

const PROTOTYPE_BRANCH = 'lane/mechanical-dispatcher';

/** REAL `git`, run in `cwd`. The lane listing (`node scripts/lane-pool.mjs …`) is answered with "none", and
 *  anything else (`gh`, `claude`) throws, so a stray live call shows up as a recorded error, not a request. */
const realGitRun = (cwd) => (program, args) => {
  if (program === 'git') return String(execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }));
  if (program === 'node') return '';
  throw new Error(`unexpected external call in a real-mechanism test: ${program}`);
};

/** A reader over REAL fs and REAL git in `clone`, with the empty swept-repos file that keeps `gh` out. */
function realReader({ tmp, clone, refreshPrototype = false }) {
  const home = join(tmp, 'home');
  mkdirSync(home, { recursive: true });
  const sweptReposPath = join(home, 'swept-repos.json');
  writeFileSync(sweptReposPath, '[]');
  return createLandAdvanceReader({
    run: realGitRun(clone), home, sweptReposPath, refreshPrototype,
    now: () => Date.parse('2026-09-20T00:00:00Z'), machineLoad: () => 0,
    readSessions: () => [], store: createFileRunStore(join(home, 'runs')),
  });
}

/** Origin: `main` gains a commit AFTER the lane branch forked, and the lane branch has one commit of its own.
 *  Distance is therefore exactly 1 behind, 1 ahead, and none of it exists in the clone until it fetches. */
function seedDivergedPrototype({ seedOriginBranch }) {
  seedOriginBranch(PROTOTYPE_BRANCH, { 'prototype.txt': 'prototype work\n' });
  seedOriginBranch('main', { 'main-only.txt': 'landed on main later\n' });
}

describe('prototype branch distance — REAL git, real clone geometry', () => {
  it('a full clone that has not fetched reports unknown, never a made-up number', async () => {
    await withBareOrigin(async (ctx) => {
      seedDivergedPrototype(ctx);
      const inputs = realReader({ tmp: ctx.tmp, clone: ctx.clone })();
      expect(inputs.prototype).toEqual({ status: 'unknown' });
      expect(inputs.errors.map((e) => e.source)).toEqual(['prototype']);
    });
  });

  it('a full clone with refreshPrototype fetches for real and counts the real distance', async () => {
    await withBareOrigin(async (ctx) => {
      seedDivergedPrototype(ctx);
      const refreshed = realReader({ tmp: ctx.tmp, clone: ctx.clone, refreshPrototype: true })();
      expect(refreshed.prototype).toMatchObject({ ahead: 1, behind: 1, refreshed: true, reason: 'fetched origin' });
      expect(refreshed.errors).toEqual([]);
      // The fetch left real tracking refs behind, so the no-fetch plan path now reads the same distance.
      const cached = realReader({ tmp: ctx.tmp, clone: ctx.clone })();
      expect(cached.prototype).toMatchObject({ ahead: 1, behind: 1, refreshed: false });
    });
  });

  it('a --single-branch clone cannot see the prototype branch even after a fetch, and says unknown (#3264 geometry)', async () => {
    await withNarrowClone(async (ctx) => {
      expect(ctx.fetchRefspecs()).toEqual([`+refs/heads/main:refs/remotes/origin/main`]);
      seedDivergedPrototype(ctx);
      const inputs = realReader({ tmp: ctx.tmp, clone: ctx.clone, refreshPrototype: true })();
      expect(inputs.prototype).toEqual({ status: 'unknown' });
      expect(inputs.errors.map((e) => e.source)).toEqual(['prototype']);
      expect(ctx.git(['for-each-ref', '--format=%(refname)', 'refs/remotes/origin/']).trim().split('\n')).not.toContain(`refs/remotes/origin/${PROTOTYPE_BRANCH}`);
    });
  });
});

describe('file mechanisms — real files, real directory', () => {
  it('readJsonlTail on a real file over the byte cap drops the torn first line and reports capped', async () => {
    await withBareOrigin(async ({ tmp }) => {
      const path = join(tmp, 'history.jsonl');
      const lines = Array.from({ length: 50 }, (_, i) => JSON.stringify({ n: i, pad: 'x'.repeat(20) }));
      writeFileSync(path, `${lines.join('\n')}\n`);
      const tail = readJsonlTail(path, { maxBytes: 200 });
      expect(tail.capped).toBe(true);
      expect(tail.entries.length).toBeGreaterThan(0);
      expect(tail.entries.length).toBeLessThan(50);
      expect(tail.entries.at(-1)).toMatchObject({ n: 49 });
      // every surviving line parsed as a whole record, so the seek never handed back a half line
      for (const e of tail.entries) expect(e.pad).toBe('x'.repeat(20));
      expect(readJsonlTail(path)).toMatchObject({ capped: false });
      expect(readJsonlTail(join(tmp, 'absent.jsonl'))).toEqual({ entries: [], capped: false });
    });
  });

  it('writeFollowUp creates the run-store directory and readFollowUps reads it back from disk', async () => {
    await withBareOrigin(async ({ tmp }) => {
      const dir = join(tmp, 'not-yet-created', 'runs');
      const store = createFileRunStore(dir);
      const entry = { session: 'sess-1', kind: 'review', target: 'we#1', launchedAt: '2026-09-20T00:00:00.000Z', deadline: '2026-09-20T02:00:00.000Z' };
      writeFollowUp(entry, { store, mintId: () => 'run-real-1' });
      expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
      expect(readdirSync(dir)).toHaveLength(1);
      // a second store over the same directory shares no memory with the first: only the disk can answer
      expect(readFollowUps({ store: createFileRunStore(dir) })).toEqual([entry]);
    });
  });
});
