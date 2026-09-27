/**
 * @file salvage-index.test.mjs — the read side of lane salvage: brief hint, landed marking, 14-day expiry,
 * manual-salvage backfill; plus pool-leftover classification, pool-exhaustion summary and the health-watch
 * salvage candidate / low-pool alert cores.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  salvageEntriesFor, salvageHintLine, withSalvageHint, refreshSalvageIndex, readSalvageIndex, parseSalvageStamp,
  backfillSalvageDir,
} from '../salvage-index.mjs';
import { salvageLane, appendSalvageIndex } from '../lane-salvage.mjs';
import { classifyPoolLeftover } from '../pool-leftovers.mjs';
import { summarizePoolExhaustion, formatPoolExhaustion, makePoolExhaustionLogger } from '../../conveyor/pool-exhaustion.mjs';
import { planSalvageCandidates, lowPoolAlert, reclaimFinishedLanes } from '../../conveyor/lane-pool-health-watch.mjs';

const DAY = 24 * 60 * 60 * 1000;

describe('salvage hint', () => {
  const entries = [
    { ts: '2026-09-27T01:00:00Z', cards: ['4229'], prs: [], bundle: '/s/a.bundle', landed: false },
    { ts: '2026-09-27T02:00:00Z', cards: [], prs: [2769], bundle: '/s/b.bundle', landed: false },
    { ts: '2026-09-27T03:00:00Z', cards: [], prs: [2769], bundle: '/s/c.bundle', landed: true },
  ];
  it('matches not-landed entries by card or PR, newest first', () => {
    expect(salvageEntriesFor(entries, { prs: [2769] }).map((e) => e.bundle)).toEqual(['/s/b.bundle']);
    expect(salvageEntriesFor(entries, { cards: ['4229'], prs: [2769] }).map((e) => e.bundle)).toEqual(['/s/b.bundle', '/s/a.bundle']);
    expect(salvageEntriesFor(entries, { cards: [undefined, ''] })).toEqual([]);
  });
  it('renders the one brief line, and appends it to a prompt only when there is a match', () => {
    expect(salvageHintLine([entries[0]])).toMatch(/^Earlier unfinished work for this item was salvaged at \/s\/a\.bundle — inspect\/reuse before starting over/);
    const root = mkdtempSync(join(tmpdir(), 'salv-hint-'));
    try {
      appendSalvageIndex(root, entries[1]);
      expect(withSalvageHint('BRIEF', { prs: [2769], root })).toMatch(/^BRIEF\n\nEarlier unfinished work .*\/s\/b\.bundle/);
      expect(withSalvageHint('BRIEF', { prs: [1], root })).toBe('BRIEF');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('parses both manual and automatic stamps', () => {
    expect(new Date(parseSalvageStamp('20260926-2136')).toISOString()).toBe('2026-09-26T21:36:00.000Z');
    expect(new Date(parseSalvageStamp('20260927-015411')).toISOString()).toBe('2026-09-27T01:54:11.000Z');
    expect(parseSalvageStamp('nope')).toBeNull();
  });
});

describe('refreshSalvageIndex + backfill (real git)', () => {
  let root; let origin; let lane; let salvageRoot;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salv-idx-'));
    origin = join(root, 'origin.git'); lane = join(root, 'lane-3'); salvageRoot = join(root, 'salvage');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
    execFileSync('git', ['clone', '-q', origin, lane], { stdio: 'ignore' });
    for (const [k, v] of [['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false']]) git(lane, 'config', k, v);
    writeFileSync(join(lane, 'a.txt'), 'base\n'); git(lane, 'add', '.'); git(lane, 'commit', '-qm', 'base'); git(lane, 'push', '-q', 'origin', 'main');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('marks an entry landed once main carries the salvaged content, and expires entries past 14 days (files + refs + row)', () => {
    writeFileSync(join(lane, 'a.txt'), 'work\n');
    const now = new Date('2026-09-27T02:00:00Z');
    const rec = salvageLane({ dir: lane, lane: 3, pool: 'p', branchRef: 'origin/main', salvageRoot, now });
    expect(refreshSalvageIndex({ root: salvageRoot, nowMs: now.getTime() }).landed).toHaveLength(0);
    // The same change lands on main by another path.
    const other = join(root, 'other');
    execFileSync('git', ['clone', '-q', origin, other], { stdio: 'ignore' });
    for (const [k, v] of [['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false']]) git(other, 'config', k, v);
    writeFileSync(join(other, 'a.txt'), 'work\n'); git(other, 'commit', '-qam', 'landed'); git(other, 'push', '-q', 'origin', 'main');
    git(lane, 'fetch', '-q', 'origin');
    const r = refreshSalvageIndex({ root: salvageRoot, nowMs: now.getTime() });
    expect(r.landed.map((e) => e.lane)).toEqual([3]);
    expect(readSalvageIndex(salvageRoot)[0].landed).toBe(true);
    // Dry-run expiry reports, real expiry deletes.
    const later = now.getTime() + 15 * DAY;
    expect(refreshSalvageIndex({ root: salvageRoot, nowMs: later, dryRun: true }).expired).toHaveLength(1);
    expect(existsSync(rec.bundle)).toBe(true);
    refreshSalvageIndex({ root: salvageRoot, nowMs: later });
    expect(existsSync(rec.bundle)).toBe(false);
    expect(readSalvageIndex(salvageRoot)).toEqual([]);
    expect(git(lane, 'for-each-ref', 'refs/salvage')).toBe('');
  });

  it('backfills a hand-made salvage dir once (idempotent), deriving the PR from the last lease purpose', () => {
    writeFileSync(join(lane, 'a.txt'), 'manual\n');
    git(lane, 'update-ref', 'refs/salvage/lane-3-20260926-2136-head', 'HEAD');
    git(lane, 'stash', 'push', '-q');
    git(lane, 'update-ref', 'refs/salvage/lane-3-20260926-2136-wip', 'stash@{0}');
    const dir = join(salvageRoot, '20260926-2136');
    execFileSync('mkdir', ['-p', dir]);
    git(lane, 'bundle', 'create', join(dir, 'lane-3.bundle'), '--all');
    writeFileSync(join(dir, 'lane-3.uncommitted.patch'), 'diff --git a/a.txt b/a.txt\n');
    const args = { dir, pool: 'p', root: salvageRoot, laneDirFor: () => lane, readLastHolder: () => ({ purpose: 'ci-heal-2783' }) };
    const rows = backfillSalvageDir(args);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lane: 3, prs: [2783], changedFiles: ['a.txt'], ts: '2026-09-26T21:36:00.000Z', backfilled: true });
    expect(rows[0].refs.sort()).toEqual(['refs/salvage/lane-3-20260926-2136-head', 'refs/salvage/lane-3-20260926-2136-wip']);
    expect(backfillSalvageDir(args)).toEqual([]);
    expect(readFileSync(join(salvageRoot, 'index.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
});

describe('pool leftovers', () => {
  const now = Date.parse('2026-09-27T00:00:00Z');
  const old = now - 10 * DAY;
  const e = (o) => ({ isDir: false, isSymlink: false, isGit: false, newestMtimeMs: old, liveCwd: false, ...o });
  it('never touches lanes, dot-entries, symlinks, live or recent entries', () => {
    for (const x of [e({ name: 'lane-3', isDir: true }), e({ name: '.free-lanes.json' }), e({ name: 'webeverything', isSymlink: true }),
      e({ name: 'scratch', isDir: true, liveCwd: true }), e({ name: 'gate.log', newestMtimeMs: now - DAY })]) {
      expect(classifyPoolLeftover(x, { nowMs: now }).action).toBe('keep');
    }
  });
  it('indexes patches first, salvages stray clones first, deletes logs and scratch', () => {
    expect(classifyPoolLeftover(e({ name: 'port.patch' }), { nowMs: now }).action).toBe('index-then-delete');
    expect(classifyPoolLeftover(e({ name: 'verify-scratch-3383', isDir: true, isGit: true }), { nowMs: now }).action).toBe('salvage-then-delete');
    expect(classifyPoolLeftover(e({ name: 'cs-70.log' }), { nowMs: now }).action).toBe('delete');
    expect(classifyPoolLeftover(e({ name: 'lane-29-scratch', isDir: true }), { nowMs: now }).action).toBe('delete');
  });
});

describe('pool exhaustion', () => {
  const nowMs = Date.parse('2026-09-27T01:00:00Z');
  const fresh = new Date(nowMs - 60_000).toISOString();
  const lanes = [
    { lane: 1, path: '/p/lane-1', leased: true, lease: { acquiredAt: fresh, ownerSession: 'dead' } },
    { lane: 2, path: '/p/lane-2', leased: true, lease: { acquiredAt: fresh, ownerSession: 'alive' } },
    { lane: 3, path: '/p/lane-3', leased: false, clean: false },
    { lane: 4, path: '/p/lane-4', leased: false, clean: true },
  ];
  it('counts leases held by dead holders separately from dirty unleased lanes', () => {
    const s = summarizePoolExhaustion({ lanes, agents: [{ sessionId: 'alive', state: 'working' }], nowMs, ttlMs: 4 * 3600_000 });
    expect(s).toEqual({ total: 4, leased: 2, leasedStale: 0, leasedDeadHolder: 1, dirtyUnleased: 1, cleanUnleased: 1 });
    expect(formatPoolExhaustion('we', s, 5)).toMatch(/^pool exhausted: we — 0 acquirable of 4; 2 leased \(1 by dead holders, 0 TTL-stale\), 1 dirty unleased/);
  });
  it('logs once per episode and re-arms on recovery', () => {
    const lines = [];
    const logger = makePoolExhaustionLogger({ log: (l) => lines.push(l), readStatus: () => ({ lanes }), readAgents: () => null, nowMs: () => nowMs });
    expect(logger.exhausted({ repo: 'we', deferred: 3 })).toBe(true);
    expect(logger.exhausted({ repo: 'we', deferred: 3 })).toBe(false);
    logger.recovered('we');
    logger.exhausted({ repo: 'we', deferred: 1 });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/\? \(claude agents unreadable\) by dead holders/);
  });
});

describe('health-watch salvage cores', () => {
  const rows = [
    { lane: 1, exists: true, verdict: 'finished-needs-review', lease: null },
    { lane: 2, exists: true, verdict: 'unknown-work', lease: null, kept: true },
    { lane: 3, exists: true, verdict: 'unknown-work', lease: { x: 1 } },
    { lane: 4, exists: true, verdict: 'in-use', lease: null },
    { lane: 5, exists: true, verdict: 'unknown-work', lease: null, lastHolder: { liveOwner: true } },
    { lane: 6, exists: true, verdict: 'finished-reclaimable', lease: null },
  ];
  it('only unleased, not-live, not-kept needs-review/unknown-work lanes are salvage candidates', () => {
    expect(planSalvageCandidates(rows).map((r) => r.lane)).toEqual([1]);
  });
  it('reclaim sub-pass calls plain reclaim for reclaimable lanes and --salvage for candidates, capped', () => {
    const calls = [];
    const out = reclaimFinishedLanes({ whois: { lanes: rows }, dryRun: true, salvageEnabled: true, salvageMax: 5, reclaimLane: (o) => { calls.push(o); return { wouldReclaim: true }; } });
    expect(calls).toEqual([{ lane: 6, dryRun: true }, { lane: 1, dryRun: true, salvage: true }]);
    expect(out[1]).toMatchObject({ lane: 1, salvageCandidate: true });
    expect(reclaimFinishedLanes({ whois: { lanes: rows }, dryRun: true, reclaimLane: () => ({}) })).toHaveLength(1);
  });
  it('raises the low-pool alert below the low-water mark only', () => {
    expect(lowPoolAlert({ acquirable: 0, total: 90, leased: 16, dirtyUnleased: 74 })).toMatch(/^ALERT: lane pool low — 0 acquirable \(< 5\) of 90: 16 leased, 74 dirty unleased/);
    expect(lowPoolAlert({ acquirable: 5, total: 90, leased: 0, dirtyUnleased: 0 })).toBeNull();
  });
});
