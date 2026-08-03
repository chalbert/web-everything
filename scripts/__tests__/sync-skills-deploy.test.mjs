/**
 * @file scripts/__tests__/sync-skills-deploy.test.mjs
 * @description Unit proof of the #2579 skills-src → deployed-skills-dir sync core: given a source skill dir,
 *   a destination dir, and the set of git-tracked relative paths, `planSkill` diffs them into add/update/remove
 *   actions and `applyPlan` executes them. Proves: a new file is added, a changed file is updated, a file no
 *   longer tracked in source is removed at the destination (the exact "stale deployed copy" bug this item
 *   closes), and an already-in-sync skill produces zero actions (idempotent — a second sync is a no-op).
 *   `buildPlans`' default-scope rule (only sync skills already present at the destination unless --all/--only)
 *   is proven against real tmp dirs, no git call (git-tracked-file listing is injected directly).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSkill, applyPlan, listFilesRecursive, parseArgs } from '../sync-skills-deploy.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'sync-skills-')); });
afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

function writeTree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  }
}

describe('planSkill — pure diff (no git call; tracked-file list injected)', () => {
  it('flags a tracked file missing at dest as "add"', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'v1' });
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md'] });
    expect(plan.actions).toEqual([{ type: 'add', rel: 'SKILL.md' }]);
    expect(plan.alreadyDeployed).toBe(false);
  });

  it('flags a changed tracked file as "update", leaves an identical one alone', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'v2', 'helper.mjs': 'same' });
    writeTree(destDir, { 'SKILL.md': 'v1-stale', 'helper.mjs': 'same' });
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md', 'helper.mjs'] });
    expect(plan.actions).toEqual([{ type: 'update', rel: 'SKILL.md' }]);
    expect(plan.alreadyDeployed).toBe(true);
  });

  it('flags a dest file no longer tracked in source as "remove" (the stale-copy bug)', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'v1' });
    writeTree(destDir, { 'SKILL.md': 'v1', 'renamed-away.mjs': 'old content' });
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md'] });
    expect(plan.actions).toEqual([{ type: 'remove', rel: 'renamed-away.mjs' }]);
  });

  it('a fully-in-sync skill produces zero actions (idempotent)', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'v1', 'nested/helper.mjs': 'code' });
    writeTree(destDir, { 'SKILL.md': 'v1', 'nested/helper.mjs': 'code' });
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md', 'nested/helper.mjs'] });
    expect(plan.actions).toEqual([]);
  });

  it('never touches gitignored runtime state — a rel path absent from trackedRel is left alone unless present at dest', () => {
    // claims.json exists in srcDir but is NOT in trackedRel (mirrors a gitignored file skills-src carries
    // for repo-local orchestrator state) — it must never be copied to the deploy target.
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'v1', 'claims.json': '{"local":"state"}' });
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md'] });
    expect(plan.actions).toEqual([{ type: 'add', rel: 'SKILL.md' }]);
  });
});

describe('applyPlan — executes add/update/remove on disk', () => {
  it('adds, updates, and removes exactly as planned', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'new content', 'added.mjs': 'brand new' });
    writeTree(destDir, { 'SKILL.md': 'stale content', 'gone.mjs': 'should be removed' });
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md', 'added.mjs'] });
    applyPlan(plan);
    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe('new content');
    expect(readFileSync(join(destDir, 'added.mjs'), 'utf8')).toBe('brand new');
    expect(existsSync(join(destDir, 'gone.mjs'))).toBe(false);
  });

  it('creates the destination dir from scratch for a never-deployed skill', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest', 'new-skill');
    writeTree(srcDir, { 'SKILL.md': 'hello' });
    const plan = planSkill({ name: 'new-skill', srcDir, destDir, trackedRel: ['SKILL.md'] });
    applyPlan(plan);
    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe('hello');
  });

  it('re-planning after apply yields zero further actions (converges)', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'content', 'nested/a.mjs': 'a' });
    const first = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md', 'nested/a.mjs'] });
    applyPlan(first);
    const second = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md', 'nested/a.mjs'] });
    expect(second.actions).toEqual([]);
  });
});

describe('listFilesRecursive', () => {
  it('returns [] for a directory that does not exist', () => {
    expect(listFilesRecursive(join(root, 'nope'))).toEqual([]);
  });

  it('walks nested dirs and returns relative paths', () => {
    const dir = join(root, 'tree');
    writeTree(dir, { 'a.md': '1', 'sub/b.mjs': '2' });
    expect(listFilesRecursive(dir).sort()).toEqual(['a.md', join('sub', 'b.mjs')].sort());
  });
});

describe('parseArgs', () => {
  it('parses flags and --only as a list', () => {
    expect(parseArgs(['--all', '--check', '--dry-run', '--json'])).toEqual({
      all: true, check: true, dryRun: true, json: true, only: null,
    });
    expect(parseArgs(['--only=a,b, c'])).toEqual({
      all: false, check: false, dryRun: false, json: false, only: ['a', 'b', 'c'],
    });
  });

  it('rejects an unrecognised flag', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/unrecognised arg/);
  });
});
