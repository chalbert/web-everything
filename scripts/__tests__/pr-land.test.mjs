/**
 * @file scripts/__tests__/pr-land.test.mjs
 * @description Unit proof of the pure helpers in `scripts/pr-land.mjs` — the self-approved-PR landing
 *   substrate for #2138 Fork 5 (#2153): the `gh pr create`/`gh pr merge` arg construction and the
 *   check-classification that decides merge-vs-wait-vs-abort. The live gh/git driver is the I/O boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeMethodFlag, buildCreateArgs, buildMergeArgs, classifyChecks } from '../pr-land.mjs';

describe('pr-land pure helpers (#2138 Fork 5 / #2153)', () => {
  it('maps merge methods to gh flags (default = --merge, the no-ff history the drain wants)', () => {
    expect(mergeMethodFlag('merge')).toBe('--merge');
    expect(mergeMethodFlag('squash')).toBe('--squash');
    expect(mergeMethodFlag('rebase')).toBe('--rebase');
    expect(mergeMethodFlag(undefined)).toBe('--merge');
    expect(mergeMethodFlag('bogus')).toBe('--merge');
  });

  it('builds a self-approved PR create (NO reviewer; --fill unless title given)', () => {
    expect(buildCreateArgs({ base: 'main', head: 'lane/2153-x' }))
      .toEqual(['pr', 'create', '--base', 'main', '--head', 'lane/2153-x', '--fill']);
    // No --reviewer is ever added — self-approved (0 required approvals, #2152).
    expect(buildCreateArgs({ base: 'main', head: 'lane/2153-x' })).not.toContain('--reviewer');
    // With an explicit title, uses --title/--body instead of --fill.
    const withTitle = buildCreateArgs({ base: 'main', head: 'lane/2153-x', title: 'land #2153', body: 'b' });
    expect(withTitle).toContain('--title');
    expect(withTitle).not.toContain('--fill');
    expect(withTitle[withTitle.indexOf('--body') + 1]).toBe('b');
  });

  it('builds a one-PR merge that deletes the lane ref (not --auto on a native queue)', () => {
    expect(buildMergeArgs({ pr: 4, method: 'merge' }))
      .toEqual(['pr', 'merge', '4', '--merge', '--delete-branch']);
    expect(buildMergeArgs({ pr: 7, method: 'squash' })).not.toContain('--auto'); // drain owns ordering
  });

  it('classifies checks: pass → merge, any fail → abort, any pending → wait', () => {
    expect(classifyChecks([]).status).toBe('passed');                                  // no required checks
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'skipping' }]).status).toBe('passed');
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'pending' }]).status).toBe('pending');
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'fail' }]).status).toBe('failed');
    // fail dominates pending (never merge a red PR even if something else is still running).
    expect(classifyChecks([{ bucket: 'pending' }, { bucket: 'fail' }]).status).toBe('failed');
    // tolerates the raw `state` field when `bucket` is absent.
    expect(classifyChecks([{ state: 'in_progress' }]).status).toBe('pending');
  });
});

describe('pr-land contract guards (source-level, mirrors gated-push-wiring)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/pr-land.mjs'), 'utf8');
  it('only ever pushes a lane/* head (guard carve-out) and never force-pushes', () => {
    expect(src).toMatch(/\/\^lane\\\//);        // enforces --ref starts with lane/
    expect(src).not.toMatch(/--force/);          // never force
  });
  it('aborts on a red required check (never merges a red PR)', () => {
    expect(src).toMatch(/check-red/);            // the abort path exists
    // The functional guarantee that no --auto native-queue flag is ever emitted is covered by the
    // buildMergeArgs test above (…).not.toContain('--auto') — the drain owns ordering, not GitHub.
  });
  it('retains a git-merge fallback (#2138 Fork 5 (a))', () => {
    expect(src).toMatch(/fallback-git/);
    expect(src).toMatch(/merge', '--no-ff'/);
  });
});
