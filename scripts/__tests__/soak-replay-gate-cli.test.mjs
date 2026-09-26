/**
 * @file soak-replay-gate-cli.test.mjs — CLI-level tests for `we:scripts/soak-replay-gate-cli.mjs`: the
 * `git diff --name-status` parser, flag parsing, and exit codes (0 clear, 1 red, 3 usage error). The pure
 * gate decision itself is tested in `we:scripts/lib/__tests__/soak-replay-gate.test.mjs`; this file only
 * covers the thin CLI shell around it (same split as every other CLI in this repo, e.g.
 * `we:scripts/__tests__/check-review-gate.test.mjs`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseNameStatus, main } from '../soak-replay-gate-cli.mjs';

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

  it('exits 3 (usage error) when neither --files-json, --files-status, nor --pr is given', () => {
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
});
