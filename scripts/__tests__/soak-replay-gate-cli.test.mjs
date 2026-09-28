/**
 * @file soak-replay-gate-cli.test.mjs — CLI-level tests for `we:scripts/soak-replay-gate-cli.mjs`: the
 * `git diff --name-status` parser, flag parsing, and exit codes (0 clear, 1 red, 3 usage error). The pure
 * gate decision itself is tested in `we:scripts/lib/__tests__/soak-replay-gate.test.mjs`; this file only
 * covers the thin CLI shell around it (same split as every other CLI in this repo, e.g.
 * `we:scripts/__tests__/check-review-gate.test.mjs`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNameStatus, main } from '../soak-replay-gate-cli.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, '..', 'soak-replay-gate-cli.mjs');

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe('parseNameStatus', () => {
  it('parses added/modified/deleted lines', () => {
    expect(parseNameStatus('A\ta.mjs\nM\tb.mjs\nD\tc.mjs')).toEqual([
      { path: 'a.mjs', changeType: 'ADDED' },
      { path: 'b.mjs', changeType: 'MODIFIED' },
      { path: 'c.mjs', changeType: 'DELETED' },
    ]);
  });

  it('parses a rename line (R### old\\tnew) as RENAMED, keeping the NEW path', () => {
    expect(parseNameStatus('R100\told-name.mjs\tnew-name.mjs')).toEqual([{ path: 'new-name.mjs', changeType: 'RENAMED' }]);
  });

  it('ignores blank lines and trims trailing whitespace', () => {
    expect(parseNameStatus('\nA\ta.mjs\n\n')).toEqual([{ path: 'a.mjs', changeType: 'ADDED' }]);
  });

  it('returns [] for empty/undefined input', () => {
    expect(parseNameStatus('')).toEqual([]);
    expect(parseNameStatus(undefined)).toEqual([]);
  });
});

describe('main — exit codes', () => {
  it('exits 0 (clear) when the rule does not apply', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    main(['--title=docs: typo fix in README', '--body=', '--files-json=["README.md"]']);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 (red) for a daemon fix with no breaks/ file and no waiver', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    main([
      '--title=fix(daemon-rebuild): stop losing a passing candidate',
      '--body=## Problem\\nIt broke.\\n## Fix\\nDone.',
      '--files-json=["scripts/lib/daemon-rebuild.mjs"]',
    ]);
    expect(process.exitCode).toBe(1);
  });

  it('exits 0 (clear) for a daemon fix that adds a breaks/ file, via --files-status', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    main([
      '--title=fix(daemon-rebuild): stop losing a passing candidate',
      '--body=## Problem\\nIt broke.\\n## Fix\\nDone.',
      '--files-status=M\tscripts/lib/daemon-rebuild.mjs\nA\tscripts/conveyor/soak/breaks/my-break.mjs',
    ]);
    expect(process.exitCode).toBe(0);
  });

  it('exits 3 (usage error) when neither --files-json, --files-status, --base-sha/--head-sha, nor --pr is given', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    main(['--title=fix: something']);
    expect(process.exitCode).toBe(3);
  });

  it('exits 3 (usage error) when --files-json is not valid JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    main(['--title=fix: something', '--files-json=not json']);
    expect(process.exitCode).toBe(3);
  });

  it('emits machine-readable JSON with --json', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    main(['--title=docs: typo fix in README', '--files-json=["README.md"]', '--json']);
    expect(process.exitCode).toBe(0);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({ ok: true, applicable: false });
  });

  // ── --base-sha/--head-sha (backlog/4264) — real throwaway git fixture reproducing PR #2822's exact shape:
  //    a backlog-only PR whose base sha is BEHIND a daemon-soak-scope change `main` landed after the branch
  //    forked. Run as a real subprocess (not an in-process `main()` call) so `defaultExec`'s `execFileSync`
  //    genuinely shells out against the fixture repo, proving the CLI wiring end to end, not just the
  //    injected-exec unit tests in `soak-gate-merge-base-diff.test.mjs`. ──────────────────────────────────────
  describe('--base-sha/--head-sha — real git fixture reproducing PR #2822', () => {
    const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const commit = (cwd, msg) => {
      git(['commit', '-m', msg, '--no-gpg-sign'], cwd);
      return git(['rev-parse', 'HEAD'], cwd);
    };

    it('a backlog-only PR is NOT applicable once the diff is computed from the merge-base — the old two-endpoint diff (--files-status) misfires on the same shas, the fix (--base-sha/--head-sha) does not', () => {
      const root = mkdtempSync(join(tmpdir(), 'we-soak-gate-cli-'));
      try {
        git(['init', '-q', '-b', 'main'], root);
        git(['config', 'user.email', 'test@example.com'], root);
        git(['config', 'user.name', 'Test'], root);
        writeFileSync(join(root, 'README.md'), 'hello\n');
        git(['add', '-A'], root);
        commit(root, 'initial commit');

        // The PR's own branch: forks here, adds ONLY an unrelated backlog card (PR #2822's real shape).
        git(['checkout', '-q', '-b', 'lane/pr-branch'], root);
        writeFileSync(join(root, 'backlog-card.md'), 'a new card\n');
        git(['add', '-A'], root);
        const headSha = commit(root, 'backlog: file a new card');

        // `main` independently advances a daemon-soak-scope file AFTER the fork point, while the PR sits open.
        git(['checkout', '-q', 'main'], root);
        mkdirSync(join(root, 'scripts', 'conveyor'), { recursive: true });
        writeFileSync(join(root, 'scripts', 'conveyor', 'health-watch.mjs'), 'export const x = 1;\n');
        git(['add', '-A'], root);
        const baseSha = commit(root, 'conveyor: unrelated health-watch change');

        const title = 'backlog: file 4 gate-efficiency cards';
        const body = 'a daemon fix broke the bug — describes future daemon-soak work, no code changed here';

        // OLD path: the exact bug — a plain two-endpoint diff, fed in as CI used to compute it by hand. The
        // gate correctly reds on this (misfired) input, so the CLI itself exits 1 — caught here, not thrown,
        // since the point of this half is the (mis)verdict, not a clean exit.
        const oldStatus = git(['diff', '--name-status', '-M', baseSha, headSha], root);
        let oldOut;
        try {
          oldOut = execFileSync('node', [CLI, `--title=${title}`, `--body=${body}`, `--files-status=${oldStatus}`, '--json'], { encoding: 'utf8' });
        } catch (e) {
          oldOut = e.stdout;
        }
        expect(JSON.parse(oldOut)).toMatchObject({ applicable: true, ok: false });

        // NEW path: the CLI computes the diff itself, from the merge-base, run as a real subprocess in the
        // fixture repo (cwd = root) so `defaultExec`'s `execFileSync` shells real git.
        const newOut = execFileSync('node', [CLI, `--title=${title}`, `--body=${body}`, `--base-sha=${baseSha}`, `--head-sha=${headSha}`, '--json'], {
          cwd: root,
          encoding: 'utf8',
        });
        expect(JSON.parse(newOut)).toEqual({ ok: true, applicable: false, reason: 'no daemon-soak-scope file touched — rule does not apply', waiver: null });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
