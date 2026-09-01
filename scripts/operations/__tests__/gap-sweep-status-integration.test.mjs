/**
 * @file gap-sweep-status-integration.test.mjs — `gap-sweep-status`'s runner driving the REAL
 *   `we:scripts/gap-sweep-status.mjs`.
 *
 * WHY A REAL SPAWN. `./gap-sweep-status.test.mjs` proves `classifyGapSweepResult` maps FABRICATED `{status,
 * stdout}` fixtures correctly — the right way to reach every branch cheaply. What it cannot prove is that the
 * real CLI ever PRODUCES text matching those fixtures: that `✓ invariants ok` is really the success marker,
 * that a duplicate capability id really prints the exact `✗ gap-sweep invariant violations (N):` block the
 * regex expects, and that a missing `--baseline` file really crashes with no parseable violation block rather
 * than some other shape. Only a real spawn against real files is a witness for any of that.
 *
 * ISOLATED DATA, NEVER THE LANE'S OWN. The CLI resolves `src/_data/` and `reports/gap-sweep-snapshots/`
 * relative to ITS OWN file location (see its header) — there is no `--repo`/`--checkout` flag the way
 * `verify-lane.mjs` has one. So `mode: 'snapshot'` genuinely writes a file, and running it against this
 * repo's own checked-in data would either collide with an existing snapshot date or leave an untracked file
 * behind. `withTmpGapSweepData` copies the CLI plus the three real data files into a throwaway temp
 * directory with the same relative layout, so every write in this file lands there and nowhere else.
 *
 * BUILT ON `withRealRepo` (#2949 fidelity qualifier, `we:scripts/lib/operation-io-fidelity.mjs`) — not for
 * its git repo, which this module's CLI never touches, but for its `ctx.tmp`: the same real, disposable
 * scratch directory every other operation's fidelity test is built on, cleaned up the same way on every exit
 * path. Reusing it here means this file proves fidelity through the repo's ONE canonical harness rather than
 * a second, parallel tmp-dir convention that the #2949 scan cannot see and would report this module as having
 * no real-mechanism test at all.
 */
import { describe, it, expect } from 'vitest';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGapSweepRunner } from '../gap-sweep-status-io.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Build `<scratch>/scripts/gap-sweep-status.mjs` + `<scratch>/src/_data/*.json` — the exact relative layout
 * the real CLI's own `ROOT = resolve(__dirname, '..')` expects, populated with COPIES of the real data.
 * `<scratch>` is `ctx.tmp` from `withRealRepo`, kept separate from its `ctx.root` git checkout (this CLI has
 * no use for one). Runs `fn` with a `{ cliPath, dataPath(name), run(input) }` helper.
 */
async function withTmpGapSweepData(fn) {
  await withRealRepo(async (ctx) => {
    const scratch = join(ctx.tmp, 'gap-sweep');
    const scriptsDir = join(scratch, 'scripts');
    const dataDir = join(scratch, 'src', '_data');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    cpSync(join(REPO_ROOT, 'scripts', 'gap-sweep-status.mjs'), join(scriptsDir, 'gap-sweep-status.mjs'));
    for (const name of ['benchmarkCorpus.json', 'benchmarkCapabilities.json', 'benchmarkCoverage.json']) {
      cpSync(join(REPO_ROOT, 'src', '_data', name), join(dataDir, name));
    }
    const cliPath = join(scriptsDir, 'gap-sweep-status.mjs');
    // `cwdRoot`/`baselineRoot` PINNED TO SCRATCH — the exact correctness gap a 2026-09-01 review round caught:
    // leaving these at their real-repo defaults here meant this test's own "isolated" `diff` calls silently
    // resolved `baseline` against the REAL repo's own reports/gap-sweep-snapshots/, not this scratch copy, and
    // the round trip only ever passed because the real repo happened to carry a matching snapshot file.
    const cwdRoot = scratch;
    const baselineRoot = join(scratch, 'reports', 'gap-sweep-snapshots');
    const runner = createGapSweepRunner({ cliPath, cwdRoot, baselineRoot });
    await fn({
      tmp: scratch,
      cliPath,
      dataPath: (name) => join(dataDir, name),
      run: (input) => runner(input),
    });
  });
}

describe('gap-sweep-status — the real CLI, against real (copied) data', () => {
  it('status: `ok` on the real corpus, with the real report text on it', async () => {
    await withTmpGapSweepData(({ run }) => {
      const result = run({ mode: 'status' });
      expect(result.outcome).toBe('ok');
      expect(result.report).toMatch(/✓ invariants ok/);
      expect(result.report).toMatch(/gap sweep — status/);
    });
  });

  /**
   * ★ A GENUINE INVARIANT VIOLATION, not a fabricated fixture string. Duplicating a real capability id and
   * running the real CLI is the only way to know the regex in `gap-sweep-status-io.mjs` matches what the CLI
   * ACTUALLY prints for `validate()`'s `duplicate capability id` error, rather than a string this suite
   * imagined for it.
   */
  it('status: a real duplicate capability id is a real `violations` outcome', async () => {
    await withTmpGapSweepData(({ dataPath, run }) => {
      const capsPath = dataPath('benchmarkCapabilities.json');
      const caps = JSON.parse(readFileSync(capsPath, 'utf8'));
      expect(caps.capabilities.length).toBeGreaterThan(0);
      caps.capabilities.push({ ...caps.capabilities[0] }); // a real, structurally valid duplicate
      writeFileSync(capsPath, JSON.stringify(caps, null, 2));

      const result = run({ mode: 'status' });
      expect(result.outcome).toBe('violations');
      expect(result.violations.some((v) => v.includes(`duplicate capability id: ${caps.capabilities[0].id}`))).toBe(true);
    });
  });

  it('snapshot: writes a REAL file at the reported path, with the real corpus\'s `lastSwept` in its name', async () => {
    await withTmpGapSweepData(({ tmp, dataPath, run }) => {
      const corpus = JSON.parse(readFileSync(dataPath('benchmarkCorpus.json'), 'utf8'));

      const result = run({ mode: 'snapshot' });
      expect(result.outcome).toBe('ok');
      expect(result.snapshotPath).toBe(`reports/gap-sweep-snapshots/${corpus.lastSwept}.json`);

      const written = join(tmp, result.snapshotPath);
      expect(existsSync(written)).toBe(true);
      const snapshot = JSON.parse(readFileSync(written, 'utf8'));
      expect(snapshot.corpus.lastSwept).toBe(corpus.lastSwept);
    });
  });

  /**
   * ★ THE ROUND TRIP: snapshot the real data, mutate a REAL field, diff against the snapshot, and let the
   * real CLI's own diff logic (never re-implemented here) report the delta. Only a real spawn on both sides
   * can show the operation's `noop` flag tracks what the CLI itself concluded.
   */
  it('diff: noop against an unchanged snapshot, changed once the real data moves', async () => {
    await withTmpGapSweepData(({ dataPath, run }) => {
      const snap = run({ mode: 'snapshot' });
      expect(snap.outcome).toBe('ok');

      const unchanged = run({ mode: 'diff', baseline: snap.snapshotPath });
      expect(unchanged.outcome).toBe('ok');
      expect(unchanged.noop).toBe(true);

      const corpusPath = dataPath('benchmarkCorpus.json');
      const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
      corpus.sources.push({ ...corpus.sources[0], id: `${corpus.sources[0].id}-test-clone` });
      writeFileSync(corpusPath, JSON.stringify(corpus, null, 2));

      const changed = run({ mode: 'diff', baseline: snap.snapshotPath });
      expect(changed.outcome).toBe('ok');
      expect(changed.noop).toBe(false);
      expect(changed.report).toContain(`${corpus.sources[0].id}-test-clone`);
    });
  });

  /** A missing `--baseline` file is a real, uncaught `ENOENT` — `unrun`, never `violations`. */
  it('diff: a real missing baseline path is `unrun`, not a fabricated violations shape', async () => {
    await withTmpGapSweepData(({ run }) => {
      const result = run({ mode: 'diff', baseline: 'reports/gap-sweep-snapshots/does-not-exist.json' });
      expect(result.outcome).toBe('unrun');
      expect(result.reason).toMatch(/exit 1/);
    });
  });
});
