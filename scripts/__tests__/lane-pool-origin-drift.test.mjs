/**
 * @file scripts/__tests__/lane-pool-origin-drift.test.mjs
 * @description Proof of #4196 — `lane-pool.mjs` must DETECT a lane whose `origin` remote isn't the canonical
 *   one (live case: lane-11's origin was rewritten to a LOCAL FOLDER PATH instead of the real GitHub remote,
 *   which made every other lane-pool check that trusts `origin` lie) and REPAIR it only when that is
 *   genuinely safe. Real throwaway origin + reference checkout, private `LANE_POOL_ROOT` — same fixture shape
 *   as `lane-pool-reclaim.test.mjs`. The fixture simulates drift the same way the live incident happened: the
 *   lane's `origin` is pointed at some OTHER path after a normal provision, never inside `cloneLane` itself.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const POOL_SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

let base, originDir, driftedOriginDir, referenceDir, poolRoot, env;

function runPool(args) {
  const r = spawnSync('node', [POOL_SCRIPT, ...args], { encoding: 'utf8', cwd: referenceDir, env, timeout: 30_000, killSignal: 'SIGKILL' });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

const poolArgs = () => [`--origin=${originDir}`, `--reference=${referenceDir}`, '--name=driftpool', '--branch=main', '--no-install'];
const lanePath = (n) => join(poolRoot, 'driftpool', `lane-${n}`);

/** Simulates the live incident: rewrite a provisioned lane's origin to some OTHER path, exactly like an
 *  external `git remote set-url origin <local folder>` would — never through `cloneLane` itself. */
function driftLaneOrigin(n, url = driftedOriginDir) {
  git(['remote', 'set-url', 'origin', url], lanePath(n));
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-origin-drift-'));
  originDir = join(base, 'origin.git');
  driftedOriginDir = join(base, 'not-canonical'); // a local FOLDER path, not even a git repo — matches the live case
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');
  env = { ...process.env, LANE_POOL_ROOT: poolRoot, HOME: base };

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);

  expect(runPool(['provision', '--count=2', ...poolArgs()]).code).toBe(0);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('lane-pool origin drift — BEFORE (the gap, #4196)', () => {
  it('a lane whose origin is a local folder path — not the canonical remote — reads as healthy in status today', () => {
    // This is the live lane-11 shape: `status` reports it with no flag at all before the fix (no
    // `originCanonical` field existed) — asserting the RAW fact here (origin really did drift) rather than a
    // stale "before" behavior claim that would rot as soon as the fix lands.
    driftLaneOrigin(1);
    expect(git(['remote', 'get-url', 'origin'], lanePath(1))).toBe(driftedOriginDir);
  });
});

describe('lane-pool origin drift — AFTER: detect', () => {
  it('`status --json` flags the drifted lane and leaves the clean one alone', () => {
    driftLaneOrigin(1);
    const r = runPool(['status', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const { lanes } = JSON.parse(r.out);
    const lane1 = lanes.find((l) => l.lane === 1);
    const lane2 = lanes.find((l) => l.lane === 2);
    expect(lane1.originCanonical).toBe(false);
    expect(lane1.originUrl).toBe(driftedOriginDir);
    expect(lane2.originCanonical).toBe(true);
    expect(lane2.originUrl).toBe(originDir);
  });

  it('the human-readable `status` output prints a loud warning naming the drifted lane', () => {
    driftLaneOrigin(1);
    const r = runPool(['status', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/lane-1:[\s\S]*#4196[\s\S]*NOT the canonical remote/);
    expect(r.err).not.toMatch(/lane-2:[\s\S]*NOT the canonical remote/);
  });
});

describe('lane-pool origin drift — AFTER: refuse (never operate against the wrong remote)', () => {
  it('`refresh` SKIPS the drifted lane — never fetches/resets through it — even with an uncommitted edit it would otherwise wipe', () => {
    driftLaneOrigin(1);
    writeFileSync(join(lanePath(1), 'file.txt'), 'v1\nedit that refresh must never touch\n');
    const r = runPool(['refresh', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/lane-1: SKIPPED[\s\S]*NOT the canonical remote/);
    expect(readFileSync(join(lanePath(1), 'file.txt'), 'utf8')).toContain('must never touch');
  });

  it('`acquire --lane=N` on a drifted lane refuses outright and leaves no lease behind', () => {
    driftLaneOrigin(1);
    const r = runPool(['acquire', '--lane=1', '--session=s', ...poolArgs()]);
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/NOT the canonical remote/);
    expect(existsSync(join(lanePath(1), '.git', '.lane-lease'))).toBe(false);
  });

  it('auto-pick `acquire` (no --lane) skips the drifted lane and takes the clean one instead', () => {
    driftLaneOrigin(1);
    const r = runPool(['acquire', '--session=s', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe(lanePath(2));
  });
});

describe('lane-pool origin drift — AFTER: repair (only when genuinely safe)', () => {
  it('dry-run reports it would repair a clean, unleased, fully-pushed drifted lane — and touches nothing', () => {
    driftLaneOrigin(1);
    const r = runPool(['repair-origin', '--lane=1', '--dry-run', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.results[0].wouldRepair).toBe(true);
    expect(report.results[0].repaired).toBe(false);
    expect(git(['remote', 'get-url', 'origin'], lanePath(1))).toBe(driftedOriginDir); // untouched
  });

  it('applies the repair: origin URL flips to canonical, HEAD and commit count are UNCHANGED', () => {
    driftLaneOrigin(1);
    const headBefore = git(['rev-parse', 'HEAD'], lanePath(1));
    const countBefore = git(['rev-list', '--count', 'HEAD'], lanePath(1));

    const r = runPool(['repair-origin', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.results[0].repaired).toBe(true);

    expect(git(['remote', 'get-url', 'origin'], lanePath(1))).toBe(originDir);
    expect(git(['rev-parse', 'HEAD'], lanePath(1))).toBe(headBefore);
    expect(git(['rev-list', '--count', 'HEAD'], lanePath(1))).toBe(countBefore);
  });

  it('a clean pool reports nothing to repair', () => {
    const r = runPool(['repair-origin', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.results).toEqual([]);
  });

  it('refuses to repair under a LIVE lease, even though the git-config write itself would be harmless', () => {
    driftLaneOrigin(1);
    // Claim the lane directly via the marker (bypassing `acquire`, which itself now refuses a drifted lane —
    // simulating a lease that existed BEFORE this lane drifted, or was granted by an older binary).
    const lease = {
      session: 's', purpose: 'test', acquiredAt: new Date().toISOString(), ttlMinutes: 240,
      host: 'test-host', pid: 1, ownerSession: null, holder: 'test-holder',
    };
    writeFileSync(join(lanePath(1), '.git', '.lane-lease'), JSON.stringify(lease, null, 2));

    const r = runPool(['repair-origin', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0); // a refusal is a normal report, never a crash
    const report = JSON.parse(r.out);
    expect(report.results[0].repaired).toBe(false);
    expect(report.results[0].reason).toMatch(/live lease/i);
    expect(git(['remote', 'get-url', 'origin'], lanePath(1))).toBe(driftedOriginDir); // untouched
  });

  it('refuses to repair a lane carrying a commit NOT provably on the canonical remote — the lane-11 shape', () => {
    driftLaneOrigin(1);
    // A real, never-pushed-anywhere commit — mirrors lane-11's 324-commit unmerged branch (any size > 0 proves
    // the same gate).
    writeFileSync(join(lanePath(1), 'orphan.txt'), 'never pushed anywhere\n');
    git(['add', 'orphan.txt'], lanePath(1));
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'unpreserved work'], lanePath(1));
    const headBefore = git(['rev-parse', 'HEAD'], lanePath(1));

    const r = runPool(['repair-origin', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.results[0].repaired).toBe(false);
    expect(report.results[0].reason).toMatch(/not provably on the canonical remote/);
    // Never touched — neither the origin URL nor (obviously, since this is config-only) the commit itself.
    expect(git(['remote', 'get-url', 'origin'], lanePath(1))).toBe(driftedOriginDir);
    expect(git(['rev-parse', 'HEAD'], lanePath(1))).toBe(headBefore);
  });

  it('a commit pushed under its own lane/* ref on the canonical remote IS provably preserved — repaired', () => {
    driftLaneOrigin(1);
    writeFileSync(join(lanePath(1), 'work.txt'), 'landed via PR\n');
    git(['add', 'work.txt'], lanePath(1));
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'landed work'], lanePath(1));
    // Push to the CANONICAL remote directly (not through the drifted `origin`) — mirrors how this content
    // would really have gotten there (a normal `pr-land`, before the origin ever drifted).
    git(['push', '--quiet', originDir, 'HEAD:refs/heads/lane/9000-test'], lanePath(1));

    const r = runPool(['repair-origin', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.results[0].repaired).toBe(true);
    expect(git(['remote', 'get-url', 'origin'], lanePath(1))).toBe(originDir);
  });
});
