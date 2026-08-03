/**
 * @file scripts/__tests__/sync-skills-deploy.test.mjs
 * @description Unit proof of the #2579 skills-src → deployed-skills-dir sync core: given a source skill dir,
 *   a destination dir, and the set of git-tracked relative paths, `planSkill` diffs them into add/update/remove
 *   actions and `applyPlan` executes them. Proves: a new file is added, a changed file is updated, a file no
 *   longer tracked in source is reported STALE and deleted only under --prune (#2579 review — the deploy root
 *   is the user's own tree, so deletion is never automatic), and an already-in-sync skill produces zero
 *   actions (idempotent — a second sync is a no-op). `applyPlan` refuses to write through a symlinked path
 *   that escapes the deploy root. `buildPlans`' default-scope rule (only sync skills already present at the
 *   destination unless --all/--only) is proven against a real tmp git repo — the one guard that stops
 *   repo-local orchestration skills from being deployed machine-globally.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { planSkill, applyPlan, listFilesRecursive, parseArgs, assertInsideRoot, buildPlans } from '../sync-skills-deploy.mjs';

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

  it('reports a dest file no longer tracked in source as STALE, and removes it only under --prune', () => {
    const srcDir = join(root, 'src');
    const destDir = join(root, 'dest');
    writeTree(srcDir, { 'SKILL.md': 'v1' });
    writeTree(destDir, { 'SKILL.md': 'v1', 'renamed-away.mjs': 'old content' });
    // #2579 review — default is REPORT, not delete: the deploy root is the user's own tree.
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md'] });
    expect(plan.actions).toEqual([]);
    expect(plan.stale).toEqual(['renamed-away.mjs']);
    const pruned = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md'], prune: true });
    expect(pruned.actions).toEqual([{ type: 'remove', rel: 'renamed-away.mjs' }]);
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
    // --prune so this keeps covering the remove path (deletion is opt-in since the #2579 review)
    const plan = planSkill({ name: 'x', srcDir, destDir, trackedRel: ['SKILL.md', 'added.mjs'], prune: true });
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
      all: true, check: true, dryRun: true, json: true, prune: false, only: null,
    });
    expect(parseArgs(['--only=a,b, c'])).toEqual({
      all: false, check: false, dryRun: false, json: false, prune: false, only: ['a', 'b', 'c'],
    });
  });

  it('rejects an unrecognised flag', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/unrecognised arg/);
  });
});

// ── #2579 review regressions ──────────────────────────────────────────────────────────────────────
// Each case below FAILED on the first cut and was caught by the review jury.
describe('sync-skills-deploy — #2579 review regressions', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'sync-review-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('does NOT delete untracked deploy-root files by default (data loss); --prune is opt-in', () => {
    const srcDir = join(root, 'src', 'demo');
    const destDir = join(root, 'dest', 'demo');
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(srcDir, 'SKILL.md'), 'v2');
    writeFileSync(join(destDir, 'SKILL.md'), 'v1');
    // the user's OWN file, living in the same deploy dir — must survive an ordinary sync
    writeFileSync(join(destDir, 'my-local-notes.md'), 'precious');

    const plan = planSkill({ name: 'demo', srcDir, destDir, trackedRel: ['SKILL.md'] });
    expect(plan.actions.some((a) => a.type === 'remove')).toBe(false);
    expect(plan.stale).toEqual(['my-local-notes.md']);   // reported, not destroyed
    applyPlan(plan);
    expect(existsSync(join(destDir, 'my-local-notes.md'))).toBe(true);
    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe('v2'); // the fix still went live

    // explicit --prune is the ONLY way a delete happens
    const pruned = planSkill({ name: 'demo', srcDir, destDir, trackedRel: ['SKILL.md'], prune: true });
    expect(pruned.actions.some((a) => a.type === 'remove' && a.rel === 'my-local-notes.md')).toBe(true);
  });

  it('refuses to write THROUGH a symlinked directory inside the deploy root', () => {
    const outside = join(root, 'outside');
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'victim.mjs'), 'ORIGINAL');

    const srcDir = join(root, 'src', 'demo');
    const destDir = join(root, 'dest', 'demo');
    mkdirSync(join(srcDir, 'nested'), { recursive: true });
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(srcDir, 'nested', 'victim.mjs'), 'PAYLOAD');
    symlinkSync(outside, join(destDir, 'nested'), 'dir');   // the escape hatch

    const plan = planSkill({ name: 'demo', srcDir, destDir, trackedRel: ['nested/victim.mjs'] });
    expect(() => applyPlan(plan)).toThrow(/resolves outside the deploy root/);
    // the file outside the deploy root is untouched
    expect(readFileSync(join(outside, 'victim.mjs'), 'utf8')).toBe('ORIGINAL');
  });

  it('assertInsideRoot allows an ordinary not-yet-existing path under the root', () => {
    const destDir = join(root, 'dest');
    mkdirSync(destDir, { recursive: true });
    expect(() => assertInsideRoot(destDir, join(destDir, 'a', 'b', 'c.md'))).not.toThrow();
    expect(() => assertInsideRoot(destDir, join(root, 'elsewhere.md'))).toThrow(/outside the deploy root/);
  });

  it('parseArgs understands --prune and still rejects unknown flags', () => {
    expect(parseArgs(['--prune']).prune).toBe(true);
    expect(parseArgs([]).prune).toBe(false);
  });
});

describe('buildPlans — default scope (#2579 review: the header claimed this was proven; it was not)', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'sync-buildplans-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

  it('by default deploys ONLY skills already present at the destination; --all/--only widen it', () => {
    // a real (tiny) git repo, because buildPlans shells `git ls-files`
    git(['init', '-q']);
    const srcRoot = join(root, 'skills-src');
    mkdirSync(join(srcRoot, 'deployed-one'), { recursive: true });
    mkdirSync(join(srcRoot, 'repo-local-only'), { recursive: true });
    writeFileSync(join(srcRoot, 'deployed-one', 'SKILL.md'), 'a');
    writeFileSync(join(srcRoot, 'repo-local-only', 'SKILL.md'), 'b');
    git(['add', '-A']);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'seed']);

    const destRoot = join(root, 'deploy');
    mkdirSync(join(destRoot, 'deployed-one'), { recursive: true }); // only ONE is already deployed

    const dflt = buildPlans({ srcRoot, destRoot, repoRoot: root });
    expect(dflt.map((p) => p.name)).toEqual(['deployed-one']);   // repo-local-only stays repo-local

    const all = buildPlans({ srcRoot, destRoot, all: true, repoRoot: root });
    expect(all.map((p) => p.name).sort()).toEqual(['deployed-one', 'repo-local-only']);

    const only = buildPlans({ srcRoot, destRoot, only: ['repo-local-only'], repoRoot: root });
    expect(only.map((p) => p.name)).toEqual(['repo-local-only']);
  });
});
