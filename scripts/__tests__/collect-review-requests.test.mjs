/**
 * @file collect-review-requests.test.mjs — which staged verdicts a push actually delivers (#x39x752 slice 2).
 *
 * THE BUG THIS EXISTS FOR, in full, because it is the kind that never announces itself: the collection step was
 * four lines of workflow YAML, and on the push that CREATES `ops/review-requests` it listed only the tip
 * commit's own tree delta. Stage two verdicts as two commits, push them together, and the FIRST one is never
 * read, never applied — and the job exits 0, because the failure counter only counts requests it attempted.
 * A review verdict silently not landing is worse than one landing wrong: nothing anywhere says it went missing.
 *
 * So the first `describe` below is not a nicety. It is the regression.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NO_PARENT_SHA, REQUEST_DIR, collectArgv, collectRequests, isGenesisPush, parseNames,
} from '../collect-review-requests.mjs';

const AFTER = 'a'.repeat(40);
const BEFORE = 'b'.repeat(40);

describe('the push that CREATES the branch — the case that silently dropped verdicts', () => {
  it('reads the whole directory at the pushed commit, NOT one commit’s delta', () => {
    // `ls-tree -r` is the whole point: it does not care how many commits the push carried.
    expect(collectArgv({ before: NO_PARENT_SHA, after: AFTER }))
      .toEqual(['ls-tree', '-r', '--name-only', AFTER, '--', REQUEST_DIR]);
  });

  it('delivers BOTH verdicts of a two-commit genesis push — the exact regression', () => {
    const seen = [];
    const files = collectRequests({
      before: NO_PARENT_SHA,
      after: AFTER,
      exec: (argv) => {
        seen.push(argv);
        // What `ls-tree -r` returns: the tree, so both commits' requests. The old `git show` returned only
        // the second, and the first verdict vanished.
        return `${REQUEST_DIR}/1463-accepted.json\n${REQUEST_DIR}/1465-accepted.json\n`;
      },
    });
    expect(files).toEqual([`${REQUEST_DIR}/1463-accepted.json`, `${REQUEST_DIR}/1465-accepted.json`]);
    expect(seen[0]).not.toContain('show');
  });

  it('treats a missing or blank `before` as genesis too — both mean "nothing to diff against"', () => {
    for (const before of [undefined, null, '', '   ', NO_PARENT_SHA, '0000000']) {
      expect(isGenesisPush(before)).toBe(true);
      expect(collectArgv({ before, after: AFTER })[0]).toBe('ls-tree');
    }
  });
});

describe('a push to an EXISTING branch', () => {
  it('diffs the two commits the push names', () => {
    expect(isGenesisPush(BEFORE)).toBe(false);
    expect(collectArgv({ before: BEFORE, after: AFTER }))
      .toEqual(['diff', '--name-only', '--diff-filter=AM', '--no-renames', BEFORE, AFTER, '--', REQUEST_DIR]);
  });

  it('ignores a request the push DELETED — a removal is not a verdict to carry out', () => {
    expect(collectArgv({ before: BEFORE, after: AFTER })).toContain('--diff-filter=AM');
  });

  it('turns git’s rename detection OFF — a heuristic must not decide whether a verdict lands', () => {
    expect(collectArgv({ before: BEFORE, after: AFTER })).toContain('--no-renames');
  });
});

describe('what counts as a request file', () => {
  it('keeps only .json directly under the request directory', () => {
    const out = [
      `${REQUEST_DIR}/1466-changes.json`,
      `${REQUEST_DIR}/README.md`,            // `ls-tree` returns everything under the directory
      `${REQUEST_DIR}/nested/1467.json`,     // not the flat shape the workflow reads
      'scripts/apply-review-request.mjs',    // outside the directory entirely
      '',
      '   ',
    ].join('\n');
    expect(parseNames(out)).toEqual([`${REQUEST_DIR}/1466-changes.json`]);
  });

  it('returns nothing — not a phantom entry — when the push added no request', () => {
    for (const out of ['', '\n', '  \n \n', undefined, null]) expect(parseNames(out)).toEqual([]);
  });
});

describe('refusals', () => {
  it('refuses to run without a commit to read', () => {
    for (const after of [undefined, '', 'HEAD', 'main', 'not-a-sha', 42]) {
      expect(() => collectArgv({ before: BEFORE, after })).toThrow(/must be a commit sha/);
    }
  });
});

/**
 * #xaoja7a — THE SECOND TRANSPORT. `we:.github/workflows/stage-pr-view.yml` collects PR-VIEW requests from
 * `ops/pr-views/requests`, and both silent drops this file exists for — the genesis push and git's rename
 * heuristic — are properties of git and of GitHub's push payload, not of which directory is watched.
 * Re-implementing the diff in that workflow's shell would have re-earned both, where no unit test can reach.
 */
describe('a second watched directory reuses the logic rather than re-earning its bugs', () => {
  const VIEWS = 'ops/pr-views/requests';

  it('carries the directory into both git argv shapes', () => {
    expect(collectArgv({ before: NO_PARENT_SHA, after: AFTER, dir: VIEWS }))
      .toEqual(['ls-tree', '-r', '--name-only', AFTER, '--', VIEWS]);
    expect(collectArgv({ before: BEFORE, after: AFTER, dir: VIEWS }))
      .toEqual(['diff', '--name-only', '--diff-filter=AM', '--no-renames', BEFORE, AFTER, '--', VIEWS]);
  });

  // The genesis-push and rename guards are properties of the ARGV, so a second directory inherits both.
  it('keeps `--no-renames` and the genesis `ls-tree` for the second directory too', () => {
    expect(collectArgv({ before: BEFORE, after: AFTER, dir: VIEWS })).toContain('--no-renames');
    expect(collectArgv({ before: '', after: AFTER, dir: VIEWS })[0]).toBe('ls-tree');
  });

  it('filters on the directory it was given, not on the default', () => {
    const out = [`${VIEWS}/a.json`, `${REQUEST_DIR}/b.json`, `${VIEWS}/nested/c.json`, `${VIEWS}/README.md`].join('\n');
    expect(parseNames(out, VIEWS)).toEqual([`${VIEWS}/a.json`]);
    expect(parseNames(out)).toEqual([`${REQUEST_DIR}/b.json`]);
  });

  it('defaults to the review-request directory, so every existing caller is unchanged', () => {
    expect(collectArgv({ before: BEFORE, after: AFTER })).toEqual(collectArgv({ before: BEFORE, after: AFTER, dir: REQUEST_DIR }));
  });

  /**
   * The string goes into a git PATHSPEC and into a `RegExp`. A `..` segment would collect files outside the
   * transport directory; an unescaped metacharacter would silently widen or narrow the filter with no error.
   */
  it('refuses a directory that is not a plain repo-relative path', () => {
    for (const bad of ['', '   ', '../etc', 'ops/../../x', 'ops/pr-views/*', '/abs/path', 'a b']) {
      expect(() => collectArgv({ before: BEFORE, after: AFTER, dir: bad })).toThrow(/plain repo-relative path/);
      expect(() => parseNames('x', bad)).toThrow(/plain repo-relative path/);
    }
  });
});

/**
 * THE RENAME TRAP, pinned against REAL GIT because a stub cannot reproduce it: the defect is git's own
 * similarity heuristic, not our argv handling. A push that adds `1463-accepted-retry1.json` while deleting
 * `1463-accepted.json` is reported as ONE `R099` rename, and `R` is not in `AM` — so the new request was
 * dropped and the job went green having applied nothing. Measured live on run 32248646760's follow-up push:
 * four brand-new request files, zero collected.
 *
 * This is the SECOND silent-drop in this one function. The first was the genesis push. Both had the same
 * shape — a verdict that never lands and nothing anywhere says so — which is why this one gets a real
 * repository rather than another argv assertion.
 */
describe('git’s rename detection must not swallow a request', () => {
  const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collect-renames-'));
    git(dir, 'init', '-q', '-b', 'main', '.');
    git(dir, 'config', 'user.email', 't@t');
    git(dir, 'config', 'user.name', 't');
    mkdirSync(join(dir, REQUEST_DIR), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (name, body) => writeFileSync(join(dir, REQUEST_DIR, name), body);

  it('collects a request that git pairs with a deleted one as a rename', () => {
    // A verdict body long enough that git scores the pair at ~99% similar, exactly as the live push did.
    const body = `${JSON.stringify({ repo: 'o/n', pr: 1463, to: 'accepted', actor: 'x' }, null, 2)}\n`;
    write('1463-accepted.json', body);
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'first attempt');
    const before = git(dir, 'rev-parse', 'HEAD');

    rmSync(join(dir, REQUEST_DIR, '1463-accepted.json'));
    write('1463-accepted-retry1.json', body);
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'retry');
    const after = git(dir, 'rev-parse', 'HEAD');

    // Git really does call it a rename — assert the precondition, so this test cannot pass vacuously if a
    // future git changes its default.
    expect(git(dir, 'diff', '--name-status', '-M', before, after)).toMatch(/^R/);

    expect(collectRequests({ before, after, exec: (argv) => git(dir, ...argv) }))
      .toEqual([`${REQUEST_DIR}/1463-accepted-retry1.json`]);
  });

  it('still ignores a request the push only DELETED', () => {
    write('1465-accepted.json', '{"pr":1465}\n');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'staged');
    const before = git(dir, 'rev-parse', 'HEAD');
    rmSync(join(dir, REQUEST_DIR, '1465-accepted.json'));
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'withdrawn');
    const after = git(dir, 'rev-parse', 'HEAD');
    expect(collectRequests({ before, after, exec: (argv) => git(dir, ...argv) })).toEqual([]);
  });
});
