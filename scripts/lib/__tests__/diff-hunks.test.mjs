/**
 * @file diff-hunks.test.mjs — proof of #2890's write-time half of the base-vs-head diff-CONTENT plumbing:
 *   `computeProposedFileDiffText` computes a unified diff between on-disk content and a proposed (not yet
 *   written) edit, with NO git ref on either side, and fails soft on every error path — while still telling
 *   the caller WHICH outcome it was (#2890-review-fix finding 2: "identical" and "I could not look" used to be
 *   the same `''`).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeProposedFileDiffText, DEFAULT_DIFF_MAX_BUFFER } from '../diff-hunks.mjs';

describe('computeProposedFileDiffText — #2890 single-file base(disk)-vs-head(proposed) diff TEXT', () => {
  it('identical base/head text short-circuits with no subprocess call — and is SCORED (computed, empty)', () => {
    let called = false;
    const exec = () => { called = true; return ''; };
    const r = computeProposedFileDiffText({ filePath: 'foo.mjs', baseText: 'same\n', headText: 'same\n', exec });
    expect(r).toEqual({ text: '', scored: true });
    expect(called).toBe(false);
  });

  it('a real content change produces unified-diff text carrying the +/- lines (real git, no injected exec)', () => {
    const r = computeProposedFileDiffText({
      filePath: 'example.mjs',
      baseText: 'const x = 1;\n',
      headText: 'const x = 2;\n',
    });
    expect(r.scored).toBe(true);
    expect(r.text).toMatch(/^diff --git /m);
    expect(r.text).toMatch(/@@ .* @@/);
    expect(r.text).toMatch(/-const x = 1;/);
    expect(r.text).toMatch(/\+const x = 2;/);
  });

  it('unwraps the exit-1 "differences found" case via an injected exec (the expected `--no-index` path)', () => {
    const err = Object.assign(new Error('git diff --no-index exited 1'), {
      status: 1,
      stdout: '@@ -1 +1 @@\n-old\n+new\n',
    });
    const exec = () => { throw err; };
    const r = computeProposedFileDiffText({ filePath: 'x.mjs', baseText: 'old\n', headText: 'new\n', exec });
    expect(r).toEqual({ text: '@@ -1 +1 @@\n-old\n+new\n', scored: true });
  });

  it('fails SOFT on a real failure (non-1 exit, or a thrown error with no stdout) — unscored, reason diff-failed', () => {
    const notFound = Object.assign(new Error('spawn git ENOENT'), { status: null });
    expect(computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: () => { throw notFound; } }))
      .toEqual({ text: '', scored: false, reason: 'diff-failed' });

    const otherExit = Object.assign(new Error('git diff --no-index exited 128'), { status: 128 });
    expect(computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: () => { throw otherExit; } }))
      .toEqual({ text: '', scored: false, reason: 'diff-failed' });
  });

  it('fails SOFT on unusable input — never throws, and says WHICH kind of unusable', () => {
    expect(computeProposedFileDiffText({ baseText: null, headText: 'b\n' }))
      .toEqual({ text: '', scored: false, reason: 'bad-input' });
    expect(computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: 'not-a-function' }))
      .toEqual({ text: '', scored: false, reason: 'exec-contract' });
    expect(() => computeProposedFileDiffText()).not.toThrow();
    // No args ⇒ both texts default to '' ⇒ IDENTICAL, which is a computed answer, not a failure.
    expect(computeProposedFileDiffText()).toEqual({ text: '', scored: true });
  });

  it('an omitted headText defaults to \'\' — a valid (different) string, not an error path', () => {
    // Destructuring gives `headText: undefined` the same default as an omitted key (`''`), so `baseText: 'a\n'`
    // vs default `''` is a genuine content change, not the unusable-input case above.
    const r = computeProposedFileDiffText({ baseText: 'a\n', headText: undefined });
    expect(r.scored).toBe(true);
    expect(r.text).toMatch(/-a/);
  });

  it('a bare filePath (no directory) is used as-is for the temp-file basename — no throw, no path traversal', () => {
    const r = computeProposedFileDiffText({
      filePath: '../../etc/passwd',
      baseText: 'a\n',
      headText: 'b\n',
    });
    // Only the BASENAME travels into the temp path (basenameOf) — the diff still runs and produces content;
    // this is not a path-traversal vector because both temp files live under the function's own mkdtemp dir.
    expect(r.text).toMatch(/-a/);
    expect(r.text).toMatch(/\+b/);
  });

  it('same shape as computeNetDiffText\'s .text — plain unified-diff text a hunk-content detector can parse identically', () => {
    const r = computeProposedFileDiffText({
      filePath: 'docs/agent/platform-decisions.md',
      baseText: '### Some Rule {#some-rule}\n\nOld ruling text.\n',
      headText: '### Some Rule {#some-rule}\n\nNew ruling text.\n',
    });
    expect(r.text).toContain('-Old ruling text.');
    expect(r.text).toContain('+New ruling text.');
  });
});

// #2890-review-fix finding 2 — the over-`maxBuffer` hole. Left at Node's DEFAULT 1 MiB `execFileSync` buffer,
// this function returned `''` for any diff above ~1 MB: git is SIGTERM'd, `ENOBUFS` is thrown with a truncated
// stdout, and the old code fell out the fail-soft path to the SAME `''` it returns for "identical". A large
// edit is precisely the shape most likely to mix a principle surface with impl, so it got a free pass, and the
// caller had no way to tell.
describe('#2890-review-fix finding 2 — the over-maxBuffer diff is BOUNDED and DISTINGUISHABLE', () => {
  it('sets an explicit maxBuffer far above Node\'s 1 MiB default, and passes it to the exec', () => {
    expect(DEFAULT_DIFF_MAX_BUFFER).toBeGreaterThan(1024 * 1024);
    let seen = null;
    const exec = (cmd, args, opts) => { seen = opts; return 'diff\n'; };
    computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec });
    expect(seen.maxBuffer).toBe(DEFAULT_DIFF_MAX_BUFFER);
  });

  it('an ENOBUFS throw (git SIGTERM\'d for exceeding the buffer) reports diff-too-large, NOT an empty diff', () => {
    const enobufs = Object.assign(new Error('spawnSync git ENOBUFS'), {
      code: 'ENOBUFS', errno: -55, status: null, signal: 'SIGTERM', stdout: 'diff --git a/base/a b/head/a\n@@ -1 +1 @@\n-a\n',
    });
    const r = computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec: () => { throw enobufs; } });
    expect(r).toEqual({ text: '', scored: false, reason: 'diff-too-large' });
    // The critical property: NOT confusable with the identical-texts answer.
    expect(r.scored).not.toBe(computeProposedFileDiffText({ baseText: 'same\n', headText: 'same\n' }).scored);
  });

  it('a TRUNCATED exit-1 stdout that reaches the cap is treated as too-large, never returned as a complete diff', () => {
    // A child that exits on its own as the pipe fills surfaces as a plain non-zero exit with a short stdout —
    // no ENOBUFS to key off. Any payload that REACHES the cap is therefore assumed truncated.
    const err = Object.assign(new Error('git diff --no-index exited 1'), { status: 1, stdout: 'x'.repeat(64) });
    const r = computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', maxBuffer: 64, exec: () => { throw err; } });
    expect(r).toEqual({ text: '', scored: false, reason: 'diff-too-large' });
  });

  it('a REAL 2 MB single-line edit is now diffed in full (was 0 bytes under the 1 MiB default) — real git', () => {
    const r = computeProposedFileDiffText({
      filePath: 'big.txt',
      baseText: 'small\n',
      headText: `${'x'.repeat(2 * 1024 * 1024)}\n`,
    });
    expect(r.scored).toBe(true);
    expect(r.text.length).toBeGreaterThan(2 * 1024 * 1024);
    expect(r.text).toContain('-small');
  });

  it('a REAL diff over an explicitly TINY maxBuffer is reported as diff-too-large, not as \'\' — real git', () => {
    const r = computeProposedFileDiffText({
      filePath: 'big.txt',
      baseText: 'small\n',
      headText: `${'y'.repeat(200 * 1024)}\n`,
      maxBuffer: 4096,
    });
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('diff-too-large');
    expect(r.text).toBe('');
  });
});

// #2890-review-r2 finding 2 — two SILENT CLEARANCES, both reproduced against real git before the fix. Neither
// is caught by the `null` contract or by an emptiness check: each returns `scored:true` with a NON-empty string
// that simply has no hunks in it, so the only property a content detector reads (`hunks.includes(<term>)`)
// answers `false` for an edit that really did change the line. `''` being "at least reportable" is true of the
// EMPTY string and irrelevant here.
describe('#2890-review-r2 finding 2 — the diff a detector reads cannot be silenced by content or by config', () => {
  const NUL = String.fromCharCode(0);

  it('a NUL byte no longer collapses the diff to "Binary files … differ" — real git, --text', () => {
    // Pre-fix, measured: {text: 'diff --git …\nBinary files … differ\n', scored: true} — non-empty, scored, and
    // `.includes('New ruling')` false. This repo has been bitten by exactly this class before (a NUL byte
    // making `grep` treat a source file as binary), and the review hit it again while probing this function.
    const r = computeProposedFileDiffText({
      filePath: 'platform-decisions.md',
      baseText: `### Some Rule\n\nOld ruling.\n${NUL}\n`,
      headText: `### Some Rule\n\nNew ruling.\n${NUL}\n`,
    });
    expect(r.scored).toBe(true);
    expect(r.text).not.toContain('Binary files');
    expect(r.text).toMatch(/@@ .* @@/);
    // THE property — a content detector's own check, on the real term:
    expect(r.text.includes('New ruling')).toBe(true);
    expect(r.text).toContain('-Old ruling.');
  });

  it('a NUL-bearing edit whose content is UNCHANGED still reports the identical short-circuit, not a fake diff', () => {
    const same = `a\n${NUL}b\n`;
    expect(computeProposedFileDiffText({ filePath: 'x.md', baseText: same, headText: same })).toEqual({ text: '', scored: true });
  });

  it('a diff.external driver can no longer hijack the output — real git, --no-ext-diff', () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-extdiff-test-'));
    try {
      const evil = join(dir, 'evil.sh');
      writeFileSync(evil, '#!/bin/sh\necho "HIJACKED - no hunks here"\n');
      chmodSync(evil, 0o755);
      // Pre-fix, measured: {text: 'HIJACKED - no hunks here\n', scored: true} — exit 0, arbitrary content, no
      // hunks. `diff.external` is a config a delta / difftastic user really does set.
      const cfgExec = (cmd, args, opts) => execFileSync(cmd, ['-c', `diff.external=${evil}`, ...args], opts);
      const viaConfig = computeProposedFileDiffText({ filePath: 'a.md', baseText: 'old\n', headText: 'new\n', exec: cfgExec });
      expect(viaConfig.text).not.toContain('HIJACKED');
      expect(viaConfig.text).toContain('+new');

      // GIT_EXTERNAL_DIFF is the same hazard by another route, and a PreToolUse hook inherits the developer's
      // whole environment — so this is the variant that needs no git config at all.
      const envExec = (cmd, args, opts) => execFileSync(cmd, args, { ...opts, env: { ...process.env, GIT_EXTERNAL_DIFF: evil } });
      const viaEnv = computeProposedFileDiffText({ filePath: 'a.md', baseText: 'old\n', headText: 'new\n', exec: envExec });
      expect(viaEnv.text).not.toContain('HIJACKED');
      expect(viaEnv.text).toContain('+new');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('both flags are on the argv, in front of --end-of-options', () => {
    let seen = null;
    const exec = (cmd, args) => { seen = args; return 'diff\n'; };
    computeProposedFileDiffText({ baseText: 'a\n', headText: 'b\n', exec });
    expect(seen).toContain('--no-ext-diff');
    expect(seen).toContain('--text');
    expect(seen.indexOf('--no-ext-diff')).toBeLessThan(seen.indexOf('--end-of-options'));
    expect(seen.indexOf('--text')).toBeLessThan(seen.indexOf('--end-of-options'));
  });
});
