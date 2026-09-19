// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { changedLines, attributeBranches, checkFloor, scanDiffBranchCoverage,
  DIFF_BRANCH_COVERAGE_FLOOR } from '../diff-branch-coverage.mjs';

const file = 'scripts/lib/review-core.mjs';
const loc = (start, end = start, column = 10) => ({ start: { line: start, column: 0 }, end: { line: end, column } });
const entry = (hits = [1, 0]) => ({ branchMap: { 0: { loc: loc(2, 4), locations: [loc(2, 3), loc(4)] } }, b: { 0: hits } });
const changes = (...lines) => new Map([[file, new Set(lines)]]);

describe('changed new-side lines', () => {
  it('maps additions, replacements, omitted counts and multiple hunks, ignoring deletion-only hunks', () => {
    expect([...changedLines('--- a/x\n+++ b/x\n@@ -1,0 +2,2 @@\n+a\n+b\n@@ -5 +7 @@ name\n-old\n+new\n@@ -9,2 +10,0 @@\n-x\n-y')]).toEqual([2, 3, 7]);
  });
  it('handles empty patches and new files without final newline', () => {
    expect(changedLines('').size).toBe(0);
    expect([...changedLines('@@ -0,0 +1 @@\n+x\n\\ No newline at end of file')]).toEqual([1]);
  });
});

describe('Istanbul outcome attribution', () => {
  it('counts each outcome once across multiple touched lines, ignoring unrelated branches', () => {
    const report = entry();
    report.branchMap[1] = { loc: loc(20), locations: [loc(20)] };
    report.b[1] = [0];
    expect(attributeBranches(changes(2, 3, 4), { [file]: report }, '/repo')).toEqual({
      total: 2, exercised: 1, uncovered: [{ file, branch: '0', outcome: 1, line: 4 }],
    });
  });
  it('accepts absolute JSON keys and one-outcome V8 branches', () => {
    const report = { branchMap: { 0: { loc: loc(1, 8), locations: [loc(1, 8)] } }, b: { 0: [3] } };
    expect(attributeBranches(changes(7), { ['/repo/' + file]: report }, '/repo').exercised).toBe(1);
  });
  it('selects an arm outside the parent condition range and respects exclusive end column zero', () => {
    const report = entry();
    report.branchMap[0].loc = loc(1);
    report.branchMap[0].locations = [loc(2, 4, 0), loc(5)];
    expect(attributeBranches(changes(3), { [file]: report }, '/repo').total).toBe(1);
    expect(attributeBranches(changes(4), { [file]: report }, '/repo').total).toBe(0);
  });
  it('ignores non-tier files and empty changed-line sets without requiring coverage', () => {
    expect(attributeBranches(new Map([['README.md', new Set([1])], [file, new Set()]]), {}, '/repo').total).toBe(0);
  });
  it('accepts genuine branchless source but rejects missing coverage, mismatched counters and invalid locations', () => {
    expect(attributeBranches(changes(2), { [file]: { branchMap: {}, b: {} } }, '/repo').total).toBe(0);
    for (const report of [undefined, {}, entry([1]), entry([NaN, 1]), entry([-1, 1]), { branchMap: {}, b: { 1: [1] } }]) {
      expect(() => attributeBranches(changes(2), { [file]: report }, '/repo')).toThrow();
    }
    const report = entry();
    report.branchMap[0].loc = null;
    expect(() => attributeBranches(changes(2), { [file]: report }, '/repo')).toThrow('location');
  });
});

describe('per-diff floor', () => {
  it('passes at 80%, fails below without rounding, and explicitly handles no branches', () => {
    expect(DIFF_BRANCH_COVERAGE_FLOOR).toBe(80);
    expect(checkFloor({ total: 5, exercised: 4 }).ok).toBe(true);
    expect(checkFloor({ total: 100001, exercised: 80000 }).ok).toBe(false);
    expect(checkFloor({ total: 0, exercised: 0 })).toEqual({ percent: null, ok: true });
    expect(checkFloor({ total: 2, exercised: 1 }, 50).ok).toBe(true);
  });
});

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function repository() {
  const root = mkdtempSync(resolve(tmpdir(), 'diff-coverage-'));
  roots.push(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const write = (path, text) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text); };
  git('init', '-q');
  write(file, 'first\nsecond\nthird\nfourth\n');
  git('add', '.');
  const tree = git('write-tree');
  const sha = git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit-tree', tree, '-m', 'fixture base');
  git('update-ref', 'HEAD', sha);
  const report = (hits) => write('coverage/coverage-final.json', JSON.stringify({ [resolve(root, file)]: entry(hits) }));
  return { root, git, write, report };
}

describe('real Git and filesystem gate', () => {
  it('skips clean and non-tier-only diffs without reading coverage', () => {
    const { root, write } = repository();
    expect(scanDiffBranchCoverage(root).status).toBe('no-scope');
    write('README.md', 'new docs');
    expect(scanDiffBranchCoverage(root).status).toBe('no-scope');
  });
  it('gates unstaged and staged edits, missing reports, passing reports and stale reports', () => {
    const { root, write, git, report } = repository();
    write(file, 'first\nchanged\nthird\nfourth\n');
    expect(scanDiffBranchCoverage(root).status).toBe('fail');
    report([1, 0]);
    expect(scanDiffBranchCoverage(root)).toMatchObject({ status: 'fail', total: 2, exercised: 1 });
    git('add', file);
    report([1, 1]);
    expect(scanDiffBranchCoverage(root)).toMatchObject({ status: 'pass', total: 2, exercised: 2 });
    utimesSync(resolve(root, 'coverage/coverage-final.json'), 1, 1);
    expect(scanDiffBranchCoverage(root).message).toContain('predates');
  });
  it('handles deletion-only and untracked tier additions', () => {
    const { root, write, git, report } = repository();
    write(file, 'first\nthird\nfourth\n');
    expect(scanDiffBranchCoverage(root).status).toBe('no-scope');
    git('rm', '--cached', '-f', file);
    report([1, 1]);
    expect(scanDiffBranchCoverage(root).status).toBe('pass');
  });
  it('uses a supplied base and fails closed on an invalid base or malformed JSON', () => {
    const { root, write, git } = repository();
    expect(scanDiffBranchCoverage(root, { base: git('rev-parse', 'HEAD') }).status).toBe('no-scope');
    expect(scanDiffBranchCoverage(root, { base: 'missing-ref' }).status).toBe('fail');
    write(file, 'first\nchanged\n');
    write('coverage/coverage-final.json', '{');
    expect(scanDiffBranchCoverage(root).status).toBe('fail');
  });
  it('attributes committed branch changes against the supplied base, even with a clean tree', () => {
    const { root, write, git, report } = repository();
    const base = git('rev-parse', 'HEAD');
    write(file, 'first\nchanged\nthird\nfourth\n');
    git('add', file);
    const sha = git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
      'commit-tree', git('write-tree'), '-p', base, '-m', 'branch change');
    git('update-ref', 'HEAD', sha);
    report([1, 0]);
    expect(scanDiffBranchCoverage(root).status).toBe('no-scope');
    expect(scanDiffBranchCoverage(root, { base })).toMatchObject({ status: 'fail', total: 2 });
  });
  it('skips fully deleted tier files but treats a renamed tier destination as new lines', () => {
    const { root, git } = repository();
    git('mv', file, 'scripts/lib/disposition-judge.mjs');
    expect(scanDiffBranchCoverage(root).status).toBe('fail'); // new destination needs coverage
    git('rm', '-f', 'scripts/lib/disposition-judge.mjs');
    expect(scanDiffBranchCoverage(root).status).toBe('no-scope');
  });
  it('is registered as a distinct standards check with a machine-readable result', () => {
    const source = readFileSync(new URL('../../check-standards.mjs', import.meta.url), 'utf8');
    expect(source).toContain('scanDiffBranchCoverage(ROOT)');
    expect(source).toContain('for (const e of diffBranchCoverage.errors) err(e.message, e.descriptor)');
    expect(source).toContain('  diffBranchCoverage,');
  });
});
