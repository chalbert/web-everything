/**
 * @file diff-hunks.test.mjs — proof of #2890's write-time half of the base-vs-head diff-CONTENT plumbing:
 *   `computeProposedFileDiffText` computes a unified diff between on-disk content and a proposed (not yet
 *   written) edit, with NO git ref on either side, and fails soft on every error path.
 */
import { describe, it, expect } from 'vitest';
import { computeProposedFileDiffText } from '../diff-hunks.mjs';

describe('computeProposedFileDiffText — #2890 single-file base(disk)-vs-head(proposed) diff TEXT', () => {
  it('identical base/head text short-circuits to \'\' with no subprocess call', () => {
    let called = false;
    const exec = () => { called = true; return ''; };
    const text = computeProposedFileDiffText({ filePath: 'foo.mjs', baseText: 'same\n', headText: 'same\n', exec });
    expect(text).toBe('');
    expect(called).toBe(false);
  });

  it('a real content change produces unified-diff text carrying the +/- lines (real git, no injected exec)', () => {
    const text = computeProposedFileDiffText({
      filePath: 'example.mjs',
      baseText: 'const x = 1;\n',
      headText: 'const x = 2;\n',
    });
    expect(text).toMatch(/^diff --git /m);
    expect(text).toMatch(/@@ .* @@/);
    expect(text).toMatch(/-const x = 1;/);
    expect(text).toMatch(/\+const x = 2;/);
  });

  it('unwraps the exit-1 "differences found" case via an injected exec (the expected `--no-index` path)', () => {
    const err = Object.assign(new Error('git diff --no-index exited 1'), {
      status: 1,
      stdout: '@@ -1 +1 @@\n-old\n+new\n',
    });
    const exec = () => { throw err; };
    const text = computeProposedFileDiffText({ filePath: 'x.mjs', baseText: 'old\n', headText: 'new\n', exec });
    expect(text).toBe('@@ -1 +1 @@\n-old\n+new\n');
  });

  it('fails SOFT to \'\' on a real failure (non-1 exit, or a thrown error with no stdout)', () => {
    const notFound = Object.assign(new Error('spawn git ENOENT'), { status: null });
    expect(computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: () => { throw notFound; } })).toBe('');

    const otherExit = Object.assign(new Error('git diff --no-index exited 128'), { status: 128 });
    expect(computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: () => { throw otherExit; } })).toBe('');
  });

  it('fails SOFT to \'\' on unusable input — never throws', () => {
    expect(computeProposedFileDiffText({ baseText: null, headText: 'b\n' })).toBe('');
    expect(computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: 'not-a-function' })).toBe('');
    expect(() => computeProposedFileDiffText()).not.toThrow();
    expect(computeProposedFileDiffText()).toBe('');
  });
  it('an omitted headText defaults to \'\' — a valid (different) string, not an error path', () => {
    // Destructuring gives `headText: undefined` the same default as an omitted key (`''`), so `baseText: 'a\n'`
    // vs default `''` is a genuine content change, not the unusable-input case above.
    const text = computeProposedFileDiffText({ baseText: 'a\n', headText: undefined });
    expect(text).toMatch(/-a/);
  });

  it('a bare filePath (no directory) is used as-is for the temp-file basename — no throw, no path traversal', () => {
    const text = computeProposedFileDiffText({
      filePath: '../../etc/passwd',
      baseText: 'a\n',
      headText: 'b\n',
    });
    // Only the BASENAME travels into the temp path (basenameOf) — the diff still runs and produces content;
    // this is not a path-traversal vector because both temp files live under the function's own mkdtemp dir.
    expect(text).toMatch(/-a/);
    expect(text).toMatch(/\+b/);
  });

  it('same shape as computeNetDiffText\'s .text — plain unified-diff text a hunk-content detector can parse identically', () => {
    const text = computeProposedFileDiffText({
      filePath: 'docs/agent/platform-decisions.md',
      baseText: '### Some Rule {#some-rule}\n\nOld ruling text.\n',
      headText: '### Some Rule {#some-rule}\n\nNew ruling text.\n',
    });
    expect(text).toContain('-Old ruling text.');
    expect(text).toContain('+New ruling text.');
  });
});
