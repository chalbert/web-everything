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

import { describe, it, expect } from 'vitest';
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
      .toEqual(['diff', '--name-only', '--diff-filter=AM', BEFORE, AFTER, '--', REQUEST_DIR]);
  });

  it('ignores a request the push DELETED — a removal is not a verdict to carry out', () => {
    expect(collectArgv({ before: BEFORE, after: AFTER })).toContain('--diff-filter=AM');
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
