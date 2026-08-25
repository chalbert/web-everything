/**
 * @file gate-health-integration.test.mjs — `readCommitStream` against REAL git history.
 *
 * WHY A REAL REPO. `readCommitStream`'s docblock states the failure it is built around:
 *
 *   *"`--first-parent` is CORRECTNESS, not tidiness. Without it a merge commit lists no files at all (git
 *   shows no diff for a merge by default), every merge-commit lookup returns an empty set, and the analysis
 *   reports '0 measurable' while looking exactly like a successful run."*
 *
 * That claim is about what GIT DOES, and only git can be its witness. The analysis this reader feeds joins
 * merged PRs to their MERGE COMMITS by sha — so if merge commits come back with no files, every PR is
 * `unmeasurable` and `gate-health` reports a clean, confident, entirely empty answer. It is the same shape as
 * #3264: a self-consistent success over a read that returned nothing.
 *
 * A fixture history therefore has to contain a REAL MERGE COMMIT, with a real second parent, and a stub cannot
 * have one — the "commit" a stub returns is a string somebody typed. `we:scripts/operations/__tests__/helpers/real-repo.mjs`
 * builds the history; every assertion below is on what git reports about it.
 *
 * NOT COVERED HERE, and deliberately: `readMergedPrs` shells `gh` against the network. There is no hermetic
 * fixture for it, so the join it feeds (`joinHistory`) is pure by construction and tested with fixture arrays
 * in `./gate-health.test.mjs`. This file closes the other half — the read that has a filesystem under it.
 */
import { describe, expect, it } from 'vitest';

import { readCommitStream } from '../gate-health-io.mjs';
import { DEFAULT_BRANCH, withRealRepo } from './helpers/real-repo.mjs';

/**
 * A history with a REAL merge: `main` gets a commit, a side branch gets its own, and the two are joined with
 * `--no-ff` so the merge commit genuinely has two parents. Returns the shas by role.
 */
function buildMergeHistory(ctx) {
  const base = ctx.commit({ 'docs/base.md': 'base\n' }, 'base: first change');
  ctx.git(['checkout', '--quiet', '-b', 'feature']);
  const side = ctx.commit({ 'src/feature.ts': 'export const feature = 1;\n' }, 'feat: the side-branch change');
  ctx.git(['checkout', '--quiet', DEFAULT_BRANCH]);
  ctx.git(['merge', '--no-ff', '--quiet', '-m', 'Merge pull request #42 from chalbert/feature', 'feature']);
  const merge = ctx.git(['rev-parse', 'HEAD']).trim();
  const after = ctx.commit({ 'docs/after.md': 'after\n' }, 'fix: a later independent change');
  return { base, side, merge, after };
}

describe('readCommitStream over a real merge history', () => {
  /**
   * ★ THE ONE THAT CANNOT BE STUBBED. A merge commit must report the files it brought in — which git only
   * volunteers under `--first-parent`. Dropping that flag makes `files` come back EMPTY for the merge, and
   * `joinHistory` then classifies every PR as `unmeasurable`. Verified by removing the flag: this test goes
   * red, and it is the only thing that does.
   */
  it('a MERGE commit reports the files it brought in', async () => {
    await withRealRepo(async (ctx) => {
      const { merge } = buildMergeHistory(ctx);

      const commits = readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH });
      const mergeEntry = commits.find((c) => c.sha === merge);

      expect(mergeEntry).toBeTruthy();
      expect(mergeEntry.files).toEqual(['src/feature.ts']);
      expect(mergeEntry.subject).toBe('Merge pull request #42 from chalbert/feature');
    });
  });

  /**
   * THE OTHER HALF of `--first-parent`, and the reason "just walk every commit" is not a fix for the above:
   * the side branch's own commit must NOT appear as a separate entry. It does under a plain `git log`, and
   * the analysis would then count the same change twice — once as the merge's surface and once as a
   * standalone commit that could be mistaken for a FOLLOW-UP to the very PR it belongs to.
   */
  it('the side branch\'s own commit is NOT a separate entry — first-parent history only', async () => {
    await withRealRepo(async (ctx) => {
      const { side, merge, after, base } = buildMergeHistory(ctx);

      const shas = readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH }).map((c) => c.sha);

      expect(shas).toContain(merge);
      expect(shas).toContain(after);
      expect(shas).toContain(base);
      expect(shas).not.toContain(side);
    });
  });

  /** Newest first, which the follow-up window walk depends on for its `c.t <= mc.t` ordering to mean
   *  anything. Read off real committer timestamps rather than asserted about the format string. */
  it('returns commits newest first, with real committer timestamps', async () => {
    await withRealRepo(async (ctx) => {
      const { after, merge } = buildMergeHistory(ctx);

      const commits = readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH });

      expect(commits[0].sha).toBe(after);
      expect(commits[1].sha).toBe(merge);
      expect(commits[0].t).toBeGreaterThan(0);
      expect(commits.every((c) => Number.isInteger(c.t))).toBe(true);
    });
  });

  /**
   * THE PARSER, against subjects only git can produce. The stream is `<sep>%H|%ct|%s` with `--name-only`
   * underneath, and the subject is reassembled with `rest.join('|')` precisely because a real subject may
   * contain the delimiter. `rest[0]` would silently truncate `feat: a|b` to `feat: a` — a corruption that no
   * assertion about the format string would notice, and that then flows into `classifyFollowUp`.
   */
  it('a subject containing the field delimiter survives intact', async () => {
    await withRealRepo(async (ctx) => {
      const sha = ctx.commit({ 'src/piped.ts': 'x\n' }, 'fix: guard a|b against c|d');

      const entry = readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH }).find((c) => c.sha === sha);

      expect(entry.subject).toBe('fix: guard a|b against c|d');
      expect(entry.files).toEqual(['src/piped.ts']);
    });
  });

  /** `max` is a real `-n`, not a slice applied afterwards — worth pinning because the analysis's hot-file cut
   *  is a SHARE of `commits.length`, so a bound that did not bind would silently move that threshold. */
  it('honours `max` as git\'s own -n bound', async () => {
    await withRealRepo(async (ctx) => {
      for (let i = 0; i < 5; i += 1) ctx.commit({ [`src/f${i}.ts`]: `${i}\n` }, `chore: change ${i}`);

      expect(readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH, max: 2 })).toHaveLength(2);
      expect(readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH }).length).toBe(6);
    });
  });

  /**
   * DELETIONS COUNT AS SURFACE. `joinHistory` attributes a follow-up by intersecting the PR's touched files
   * with a later commit's, so a commit that REMOVES a file has to report it — otherwise a fix that deletes
   * the thing a PR added is invisible to the very measurement it is evidence for.
   *
   * Also the parser's `filter(Boolean)`, against real output: git separates each commit's name-only block
   * with a blank line, so an unfiltered split yields a phantom `''` in every entry's file list, and `''`
   * intersects with nothing while quietly inflating every count that reads `files.length`.
   */
  it('reports added AND deleted paths, and never a blank one', async () => {
    await withRealRepo(async (ctx) => {
      ctx.commit({ 'src/a.ts': 'a\n', 'src/b.ts': 'b\n' }, 'chore: add a and b');
      ctx.git(['rm', '--quiet', '--', 'src/a.ts']);
      ctx.git(['commit', '--quiet', '-m', 'fix: drop a']);

      const commits = readCommitStream({ root: ctx.root, ref: DEFAULT_BRANCH });

      expect(commits[0].files).toEqual(['src/a.ts']);
      expect(commits[1].files.sort()).toEqual(['src/a.ts', 'src/b.ts']);
      expect(commits.every((c) => !c.files.includes(''))).toBe(true);
    });
  });
});
