/**
 * @file lane-salvage.test.mjs — snapshot-then-reclaim (2026-09-27 lane-pool starvation). Pure-core tests plus
 * real-git tests: a dirty lane with an unpushed commit, an untracked file, a CONFLICTED index and a litter
 * worktree is salvaged into a verified bundle that restores every byte, and the working tree is untouched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  salvageStamp, salvageRefNames, isWorktreeLitterPath, parseLsofCwds, pidsWithCwdIn, salvageEligibility,
  liveAgentInLane, deriveSalvageTargets, salvageLane, removeLitterWorktrees, listLitterWorktrees,
} from '../lane-salvage.mjs';

describe('lane-salvage pure core', () => {
  it('stamps sortable UTC and names refs like the manual salvage', () => {
    expect(salvageStamp(new Date('2026-09-27T01:36:05Z'))).toBe('20260927-013605');
    expect(salvageRefNames({ lane: 7, stamp: 's' })).toEqual({ head: 'refs/salvage/lane-7-s-head', wip: 'refs/salvage/lane-7-s-wip' });
    expect(salvageRefNames({ lane: 7, stamp: 's', worktree: 'fix 1' }).wip).toBe('refs/salvage/lane-7-s-wt-fix_1-wip');
  });

  it('treats only .claude/worktrees/ as worktree litter', () => {
    expect(isWorktreeLitterPath('.claude/worktrees/fix-1/')).toBe(true);
    expect(isWorktreeLitterPath('.claude/settings.json')).toBe(false);
  });

  it('parses lsof cwd output and matches pids inside a lane (never itself)', () => {
    const cwds = parseLsofCwds('p10\nfcwd\nn/pool/lane-1\np11\nfcwd\nn/pool/lane-10\np12\nfcwd\nn/pool/lane-1/.claude/worktrees/x\n');
    expect(pidsWithCwdIn(cwds, '/pool/lane-1', 999)).toEqual([10, 12]);
    expect(pidsWithCwdIn(cwds, '/pool/lane-1', 10)).toEqual([12]);
  });

  it('counts a stateless or working agent anywhere inside the lane as live; a done one is not', () => {
    const agents = [{ state: null, cwd: '/pool/lane-3/.claude/worktrees/fix-9', sessionId: 'a' }, { state: 'done', cwd: '/pool/lane-4', sessionId: 'b' }];
    expect(liveAgentInLane(agents, '/pool/lane-3')).toBe(true);
    expect(liveAgentInLane(agents, '/pool/lane-4')).toBe(false);
    expect(liveAgentInLane([{ state: 'working', cwd: '/elsewhere', sessionId: 's1' }], '/pool/lane-5', ['s1'])).toBe(true);
  });

  it('eligibility refuses lease, live owner, live pid, and a recently touched lane', () => {
    const base = { leased: false, liveOwner: false, livePids: [], newestMtimeMs: 0, nowMs: 60 * 60_000, quietMs: 30 * 60_000 };
    expect(salvageEligibility(base).eligible).toBe(true);
    expect(salvageEligibility({ ...base, leased: true }).eligible).toBe(false);
    expect(salvageEligibility({ ...base, liveOwner: true }).eligible).toBe(false);
    expect(salvageEligibility({ ...base, livePids: [42] }).reason).toMatch(/pid 42/);
    expect(salvageEligibility({ ...base, newestMtimeMs: 50 * 60_000 }).reason).toMatch(/quiet period/);
  });

  it('derives PR numbers and card ids from lease purpose/holder and branch names', () => {
    expect(deriveSalvageTargets({ holder: 'conveyor-ci-heal-lane-2-201b', purpose: 'fix-2748', branches: ['lane/4229-slug', 'worktree-fix-2769'] }))
      .toEqual({ cards: ['4229'], prs: [2748, 2769] });
    expect(deriveSalvageTargets({ session: 'build-x9fbg1x' }).cards).toEqual(['x9fbg1x']);
  });
});

describe('salvageLane (real git)', () => {
  let root; let origin; let lane; let salvageRoot;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lane-salvage-test-'));
    origin = join(root, 'origin.git');
    lane = join(root, 'lane-5');
    salvageRoot = join(root, 'salvage');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
    execFileSync('git', ['clone', '-q', origin, lane], { stdio: 'ignore' });
    for (const [k, v] of [['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false']]) git(lane, 'config', k, v);
    writeFileSync(join(lane, 'a.txt'), 'base\n');
    writeFileSync(join(lane, 'c.txt'), 'base-c\n');
    git(lane, 'add', '.'); git(lane, 'commit', '-qm', 'base'); git(lane, 'push', '-q', 'origin', 'main');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('bundles an unpushed commit + tracked edit + untracked file + conflicted file + litter worktree, without touching the tree', () => {
    writeFileSync(join(lane, 'a.txt'), 'ahead\n'); git(lane, 'commit', '-qam', 'unpushed work');
    // A conflicted index (the lane-22 case: "needs merge" made `git stash` fail).
    git(lane, 'checkout', '-qb', 'side', 'origin/main'); writeFileSync(join(lane, 'c.txt'), 'side\n'); git(lane, 'commit', '-qam', 'side');
    git(lane, 'checkout', '-q', 'main'); writeFileSync(join(lane, 'c.txt'), 'main-c\n'); git(lane, 'commit', '-qam', 'main-c');
    try { git(lane, 'merge', 'side'); } catch { /* conflict expected */ }
    expect(git(lane, 'status', '--porcelain')).toMatch(/^UU c\.txt/m);
    writeFileSync(join(lane, 'new.txt'), 'untracked\n');
    mkdirSync(join(lane, '.claude', 'worktrees'), { recursive: true });
    git(lane, 'worktree', 'add', '-q', '-b', 'worktree-fix-2777', join(lane, '.claude', 'worktrees', 'fix-2777'), 'origin/main');
    writeFileSync(join(lane, '.claude', 'worktrees', 'fix-2777', 'wt.txt'), 'wt work\n');
    const before = git(lane, 'status', '--porcelain');

    const rec = salvageLane({ dir: lane, lane: 5, pool: 'p', branchRef: 'origin/main', salvageRoot, now: new Date('2026-09-27T02:00:00Z'), meta: { lastHolder: { purpose: 'fix-2748' } } });

    expect(git(lane, 'status', '--porcelain')).toBe(before); // working tree + real index untouched
    expect(rec.bundle).toBe(join(salvageRoot, 'p', '20260927-020000', 'lane-5.bundle'));
    expect(rec.prs).toEqual(expect.arrayContaining([2748, 2777]));
    expect(rec.changedFiles).toEqual(expect.arrayContaining(['a.txt', 'c.txt', 'new.txt', 'wt.txt']));
    const index = readFileSync(join(salvageRoot, 'index.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({ lane: 5, pool: 'p', landed: false });

    // Restore from the bundle ALONE into a fresh clone of origin: every byte comes back.
    const restore = join(root, 'restore');
    execFileSync('git', ['clone', '-q', origin, restore], { stdio: 'ignore' });
    git(restore, 'fetch', '-q', rec.bundle, 'refs/salvage/*:refs/salvage/*');
    const wip = 'refs/salvage/lane-5-20260927-020000-wip';
    expect(git(restore, 'show', `${wip}:a.txt`)).toBe('ahead');
    expect(git(restore, 'show', `${wip}:new.txt`)).toBe('untracked');
    expect(git(restore, 'show', `${wip}:c.txt`)).toMatch(/<<<<<<<[\s\S]*main-c[\s\S]*side/);
    expect(git(restore, 'show', 'refs/salvage/lane-5-20260927-020000-wt-fix-2777-wip:wt.txt')).toBe('wt work');
    expect(git(restore, 'ls-tree', '-r', '--name-only', wip)).not.toMatch(/\.claude\/worktrees/);
    expect(readFileSync(join(salvageRoot, 'p', '20260927-020000', 'lane-5.unpushed.txt'), 'utf8')).toMatch(/unpushed work/);

    // Worktree litter is removed properly afterwards.
    const wts = listLitterWorktrees(lane);
    expect(wts.map((w) => w.name)).toEqual(['fix-2777']);
    expect(removeLitterWorktrees(lane, wts)).toEqual(['fix-2777']);
    expect(existsSync(join(lane, '.claude', 'worktrees', 'fix-2777'))).toBe(false);
  });

  it('a lane with nothing unique writes no bundle (nothing to lose)', () => {
    const rec = salvageLane({ dir: lane, lane: 5, pool: 'p', branchRef: 'origin/main', salvageRoot, now: new Date('2026-09-27T02:00:00Z') });
    expect(rec.bundle).toBeNull();
    expect(rec.refs).toEqual([]);
  });
});
