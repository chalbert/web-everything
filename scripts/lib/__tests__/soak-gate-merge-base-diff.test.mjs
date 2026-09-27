/**
 * @file soak-gate-merge-base-diff.test.mjs — unit tests for `we:scripts/lib/soak-gate-merge-base-diff.mjs`
 * (backlog/4264): the merge-base-based diff that replaces the soak-replay gate's old two-endpoint
 * `base..head` diff. Two halves, mirroring `scope-reconcile.test.mjs` / `branch-drift.test.mjs`'s own split:
 *
 *   1. The pure logic on an injected FAKE `exec` — no git.
 *   2. A REAL throwaway git fixture (`mkdtemp` + real `git init`) reproducing the exact PR #2822 shape: a
 *      divergent base and head where `main` changes a daemon-soak-scope file AFTER the branch's own fork
 *      point. Proves the two-endpoint diff misfires (includes `main`'s own file) and the merge-base diff does
 *      not — the deterministic git-history integration test backlog/4264's "Done when" and the reviewer's
 *      PREVENTION note both ask for.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isShaLike,
  resolveMergeBaseDiffBasis,
  computeSoakGateNameStatus,
  defaultExec,
} from '../soak-gate-merge-base-diff.mjs';

describe('isShaLike', () => {
  it('accepts 7-40 hex chars', () => {
    expect(isShaLike('4e393c1')).toBe(true);
    expect(isShaLike('4e393c1a83c503884c8a9ce94d11d3f00505936f')).toBe(true);
  });
  it('rejects non-sha values', () => {
    expect(isShaLike('main')).toBe(false);
    expect(isShaLike('')).toBe(false);
    expect(isShaLike(undefined)).toBe(false);
    expect(isShaLike('not-hex-zzzz')).toBe(false);
  });
});

// ── 1. the pure logic, injected FAKE exec ───────────────────────────────────────────────────────────────────

describe('resolveMergeBaseDiffBasis — injected fake exec', () => {
  const fakeExec = (script) => (cmd, args) => {
    const key = [cmd, ...args].join(' ');
    if (script[key] && script[key].throw) throw new Error(script[key].throw);
    if (key in script) return script[key].stdout ?? script[key];
    throw new Error(`unscripted call: ${key}`);
  };

  it('resolves to the merge-base when it exists', () => {
    const exec = fakeExec({ 'git merge-base --end-of-options aaaaaaa bbbbbbb': 'forkpoint123\n' });
    expect(resolveMergeBaseDiffBasis({ exec, baseSha: 'aaaaaaa', headSha: 'bbbbbbb' })).toEqual({
      diffBase: 'forkpoint123',
      basisKind: 'merge-base',
    });
  });

  it('takes only the FIRST line of a multi-candidate merge-base (criss-cross history)', () => {
    const exec = fakeExec({ 'git merge-base --end-of-options aaaaaaa bbbbbbb': 'fork1\nfork2\n' });
    expect(resolveMergeBaseDiffBasis({ exec, baseSha: 'aaaaaaa', headSha: 'bbbbbbb' }).diffBase).toBe('fork1');
  });

  it('falls back to base-tip when merge-base throws (no common history)', () => {
    const exec = fakeExec({ 'git merge-base --end-of-options aaaaaaa bbbbbbb': { throw: 'no common ancestors' } });
    expect(resolveMergeBaseDiffBasis({ exec, baseSha: 'aaaaaaa', headSha: 'bbbbbbb' })).toEqual({
      diffBase: 'aaaaaaa',
      basisKind: 'base-tip',
    });
  });

  it('falls back to base-tip without even calling git when a sha is not sha-shaped', () => {
    const exec = () => { throw new Error('must not be called'); };
    expect(resolveMergeBaseDiffBasis({ exec, baseSha: 'main', headSha: 'bbbbbbb' })).toEqual({
      diffBase: 'main',
      basisKind: 'base-tip',
    });
  });

  it('throws a TypeError when exec is not a function — a caller bug, not a silent fallback', () => {
    expect(() => resolveMergeBaseDiffBasis({ baseSha: 'aaaaaaa', headSha: 'bbbbbbb' })).toThrow(TypeError);
  });
});

describe('computeSoakGateNameStatus — injected fake exec', () => {
  it('diffs from the resolved merge-base, not the base sha, to head', () => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push([cmd, ...args].join(' '));
      if (args[0] === 'merge-base') return 'forkpoint123\n';
      return 'A\tbacklog/new-card.md\n';
    };
    const result = computeSoakGateNameStatus({ exec, baseSha: 'aaaaaaa', headSha: 'bbbbbbb' });
    expect(result).toEqual({ nameStatus: 'A\tbacklog/new-card.md\n', diffBase: 'forkpoint123', basisKind: 'merge-base' });
    expect(calls).toEqual([
      'git merge-base --end-of-options aaaaaaa bbbbbbb',
      'git diff --name-status -M --end-of-options forkpoint123 bbbbbbb',
    ]);
  });
});

// ── 2. REAL throwaway git fixture — reproduces PR #2822's shape ─────────────────────────────────────────────

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (cwd, msg) => {
  git(['commit', '-m', msg, '--no-gpg-sign'], cwd);
  return git(['rev-parse', 'HEAD'], cwd);
};

describe('real git fixture — divergent base/head, main advances a daemon-soak-scope file after the fork point', () => {
  it('two-endpoint diff (the OLD bug) counts the file; merge-base diff (the FIX) does not', () => {
    const root = mkdtempSync(join(tmpdir(), 'we-soak-gate-diff-'));
    try {
      git(['init', '-q', '-b', 'main'], root);
      git(['config', 'user.email', 'test@example.com'], root);
      git(['config', 'user.name', 'Test'], root);

      writeFileSync(join(root, 'README.md'), 'hello\n');
      git(['add', '-A'], root);
      const forkSha = commit(root, 'initial commit');

      // The PR's own branch: diverges from the fork point, adds ONLY an unrelated backlog card — exactly
      // PR #2822's real shape.
      git(['checkout', '-q', '-b', 'lane/pr-branch'], root);
      writeFileSync(join(root, 'backlog-card.md'), 'a new card\n');
      git(['add', '-A'], root);
      const headSha = commit(root, 'backlog: file a new card');

      // Back on the base branch: main independently advances a daemon-soak-scope-shaped file AFTER the fork
      // point (mirrors the real incident's `scripts/conveyor/...` edits landing while the PR sat open).
      git(['checkout', '-q', 'main'], root);
      mkdirSync(join(root, 'scripts', 'conveyor'), { recursive: true });
      writeFileSync(join(root, 'scripts', 'conveyor', 'health-watch.mjs'), 'export const x = 1;\n');
      git(['add', '-A'], root);
      const baseSha = commit(root, 'conveyor: unrelated health-watch change');

      // OLD behaviour: a plain two-endpoint diff — misfires, counting main's own file as the PR's.
      const oldDiff = git(['diff', '--name-status', '-M', baseSha, headSha], root);
      expect(oldDiff).toContain('scripts/conveyor/health-watch.mjs');
      expect(oldDiff).toContain('backlog-card.md');

      // NEW behaviour: the merge-base-based diff this module computes — only the PR's own file.
      const exec = (cmd, args, opts) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
      const result = computeSoakGateNameStatus({ exec, baseSha, headSha });
      expect(result.basisKind).toBe('merge-base');
      expect(result.diffBase).toBe(forkSha);
      expect(result.nameStatus).toContain('backlog-card.md');
      expect(result.nameStatus).not.toContain('scripts/conveyor/health-watch.mjs');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('defaultExec really shells execFileSync (no git mocking) and agrees with the fake-exec unit tests above', () => {
    const root = mkdtempSync(join(tmpdir(), 'we-soak-gate-diff-defaultexec-'));
    try {
      git(['init', '-q', '-b', 'main'], root);
      git(['config', 'user.email', 'test@example.com'], root);
      git(['config', 'user.name', 'Test'], root);
      writeFileSync(join(root, 'a.md'), 'a\n');
      git(['add', '-A'], root);
      const baseSha = commit(root, 'base');
      writeFileSync(join(root, 'b.md'), 'b\n');
      git(['add', '-A'], root);
      const headSha = commit(root, 'head');

      const result = computeSoakGateNameStatus({
        exec: (cmd, args, opts) => defaultExec(cmd, args, { cwd: root, ...opts }),
        baseSha,
        headSha,
      });
      expect(result.basisKind).toBe('merge-base');
      expect(result.diffBase).toBe(baseSha);
      expect(result.nameStatus).toContain('A\tb.md');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
