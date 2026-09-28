/**
 * @file lane-salvage.test.mjs — snapshot-then-reclaim (2026-09-27 lane-pool starvation). Pure-core tests plus
 * real-git tests: a dirty lane with an unpushed commit, an untracked file, a CONFLICTED index and a litter
 * worktree is salvaged into a verified bundle that restores every byte, and the working tree is untouched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  salvageStamp, salvageRefNames, isWorktreeLitterPath, parseLsofCwds, pidsWithCwdIn, salvageEligibility,
  liveAgentInLane, deriveSalvageTargets, salvageLane, removeLitterWorktrees, listLitterWorktrees, laneLivenessGate,
  newestContentMtimeMs,
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

  // #xl5xhmj — this is a PURE unit test of `salvageEligibility`'s own clamp math, with a synthetic
  // `quietMs: 0` chosen ONLY to isolate that arithmetic — it is NOT a description of `cmdReclaim`'s own
  // production gate, which always runs at the REAL 30-minute default (`resolveSalvageQuietMs()`;
  // `cmdReclaim` never passes a `quietMs` override at all — see `we:scripts/lane-pool.mjs`). That real-default
  // path gets its own dedicated end-to-end coverage in `we:scripts/__tests__/lane-pool-reclaim.test.mjs`'s
  // "quiet period at the REAL 30-minute default" describe block, via `runPoolWithEnv` with the env var UNSET.
  // The clamp itself defends a file's on-disk mtime landing a few ms AFTER `nowMs` was sampled (mtime/clock
  // granularity, or git's own background housekeeping touching `.git/logs/HEAD` a moment after the visible
  // commit/push returned). An unclamped negative "elapsed" wrongly read as "not yet quiet" even at
  // `quietMs: 0`, where ANY elapsed time (including ~0) must trivially satisfy the threshold.
  it('a newestMtimeMs slightly AHEAD of nowMs (clock/mtime skew) never reads as "not quiet" at quietMs:0', () => {
    const g = salvageEligibility({
      leased: false, liveOwner: false, livePids: [], newestMtimeMs: 1_000_014, nowMs: 1_000_000, quietMs: 0,
    });
    expect(g).toEqual({ eligible: true, reason: 'unleased, no live owner or process, quiet' });
  });

  it('the same skew still correctly refuses when quietMs is genuinely not yet satisfied', () => {
    const g = salvageEligibility({
      leased: false, liveOwner: false, livePids: [], newestMtimeMs: 1_000_014, nowMs: 1_000_000, quietMs: 60_000,
    });
    expect(g.eligible).toBe(false);
    expect(g.reason).toMatch(/0 min ago/); // clamped to 0, never a negative minute count
  });

  it('derives PR numbers and card ids from lease purpose/holder and branch names', () => {
    expect(deriveSalvageTargets({ holder: 'conveyor-ci-heal-lane-2-201b', purpose: 'fix-2748', branches: ['lane/4229-slug', 'worktree-fix-2769'] }))
      .toEqual({ cards: ['4229'], prs: [2748, 2769] });
    expect(deriveSalvageTargets({ session: 'build-x9fbg1x' }).cards).toEqual(['x9fbg1x']);
  });
});

// #xl5xhmj — `laneLivenessGate` is the ONE liveness read `lane-pool.mjs#cmdReclaim`'s direct-reset path and
// `lane-pool-health-watch.mjs`'s litter-reap pass now both share, extracted from what used to be
// `cmdReclaimSalvage`'s own inline `gate()` closure (only that ONE path ever ran it before this fix).
describe('laneLivenessGate (#xl5xhmj)', () => {
  it('a live owner (by cwd) refuses, even with no matching sessionId supplied', () => {
    const readAgents = () => [{ state: 'working', cwd: '/pool/lane-9', sessionId: 'unrelated' }];
    const readCwds = () => [];
    const g = laneLivenessGate({ dir: '/pool/lane-9', readAgents, readCwds, quietMs: 0 });
    expect(g.eligible).toBe(false);
    expect(g.reason).toMatch(/live/i);
  });

  it('a live owner by lastHolder sessionId (agent cwd elsewhere) also refuses', () => {
    const readAgents = () => [{ state: 'working', cwd: '/elsewhere', sessionId: 's1' }];
    const readCwds = () => [];
    const g = laneLivenessGate({ dir: '/pool/lane-9', lastHolder: { workerSession: 's1' }, readAgents, readCwds, quietMs: 0 });
    expect(g.eligible).toBe(false);
  });

  it('a live process cwd (no matching agent) also refuses', () => {
    const readAgents = () => [];
    const readCwds = () => [{ pid: 123, cwd: '/pool/lane-9' }];
    const g = laneLivenessGate({ dir: '/pool/lane-9', readAgents, readCwds, quietMs: 0 });
    expect(g.eligible).toBe(false);
    expect(g.reason).toMatch(/pid 123/);
  });

  it('no live owner, no live pid, quiet period satisfied — eligible', () => {
    const readAgents = () => [];
    const readCwds = () => [];
    const g = laneLivenessGate({ dir: '/pool/lane-9', readAgents, readCwds, quietMs: 0 });
    expect(g).toEqual({ eligible: true, reason: 'unleased, no live owner or process, quiet' });
  });

  it('fails CLOSED when `claude agents` cannot be read — never treats an unreadable lane as safe', () => {
    const g = laneLivenessGate({ dir: '/pool/lane-9', readAgents: () => null, readCwds: () => [], quietMs: 0 });
    expect(g.eligible).toBe(false);
    expect(g.reason).toMatch(/claude agents/);
  });

  it('fails CLOSED when live process cwds cannot be read (lsof unavailable)', () => {
    const g = laneLivenessGate({ dir: '/pool/lane-9', readAgents: () => [], readCwds: () => null, quietMs: 0 });
    expect(g.eligible).toBe(false);
    expect(g.reason).toMatch(/lsof/);
  });
});

// Red-team finding — `newestContentMtimeMs` deliberately never stats `.git/index` at all (see that function's
// own docblock for why an ordering fix inside this ONE function could not close the race: an EARLIER, unrelated
// `git status` elsewhere in the same call chain — `laneReclaimPreservationProof`'s own `gitStatusSummary` in
// `cmdReclaim` — races the index just as much as this function's own call would). These tests prove BOTH halves
// still hold without it: a staged/working-tree DELETION (no file left to stat) still reads as fresh via the
// unstatable-path fallback, and a genuinely quiet lane still reads as quiet.
describe('newestContentMtimeMs (real git, #xl5xhmj)', () => {
  let dir;
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'newest-mtime-'));
    git('init', '-q');
    git('config', 'user.email', 't@t.com');
    git('config', 'user.name', 't');
    writeFileSync(join(dir, 'a.txt'), 'base\n');
    writeFileSync(join(dir, 'b.txt'), 'base\n');
    git('add', '.');
    git('commit', '-qm', 'base');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('a STAGED DELETION (the tracked path no longer exists on disk) still reads as recent, via the unstatable-path fallback', () => {
    // Back-date logs/HEAD first so the ONLY fresh signal left is the deletion itself — `bump` cannot stat a
    // path `git rm` already removed from the working tree, so this pins the fallback, not logs/HEAD.
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(join(dir, '.git', 'logs', 'HEAD'), old, old);
    git('rm', '-q', 'a.txt'); // staged deletion — a.txt no longer exists on disk to stat
    const before = Date.now();
    const newest = newestContentMtimeMs(dir);
    expect(newest).not.toBeNull();
    expect(newest).toBeGreaterThanOrEqual(before - 5_000); // recent (within a few seconds), not the back-dated hour
  });

  it('a genuinely quiet lane (nothing staged, HEAD reflog old) still reads as old — the original racy-index bug stays fixed', () => {
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(join(dir, '.git', 'logs', 'HEAD'), old, old);
    // `git status` (what `dirtyPaths` shells) may itself rewrite `.git/index` here — the exact race this
    // function's docblock describes. Never stat-ing the index at all is what this test pins.
    const newest = newestContentMtimeMs(dir);
    expect(newest).not.toBeNull();
    expect(Date.now() - newest).toBeGreaterThan(55 * 60_000); // still reads as ~an hour old, not "just now"
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

  it('includeLocalBranches (a clone about to be deleted) also bundles a non-HEAD branch no remote has', () => {
    git(lane, 'checkout', '-qb', 'side-work'); writeFileSync(join(lane, 's.txt'), 'side\n'); git(lane, 'add', 's.txt'); git(lane, 'commit', '-qm', 'side only');
    git(lane, 'checkout', '-q', 'main');
    const rec = salvageLane({ dir: lane, lane: 'stray', pool: 'p', branchRef: 'origin/main', salvageRoot, now: new Date('2026-09-27T02:00:00Z'), includeLocalBranches: true });
    expect(rec.refs).toEqual(['refs/salvage/lane-stray-20260927-020000-ref-heads_side-work']);
    expect(git(lane, 'bundle', 'list-heads', rec.bundle)).toMatch(/ref-heads_side-work/);
  });

  it('a lane with nothing unique writes no bundle (nothing to lose)', () => {
    const rec = salvageLane({ dir: lane, lane: 5, pool: 'p', branchRef: 'origin/main', salvageRoot, now: new Date('2026-09-27T02:00:00Z') });
    expect(rec.bundle).toBeNull();
    expect(rec.refs).toEqual([]);
  });
});
