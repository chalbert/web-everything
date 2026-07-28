/**
 * @file scripts/__tests__/lane-pool-reap-on-acquire.test.mjs
 * @description Proof of the #2748 ACQUIRE-NATIVE REAPER BACKSTOP in `scripts/lane-pool.mjs`: before allocating,
 *   `acquire` reclaims a PROVABLY-DEAD ghost lease — one whose item card reads `status: resolved` on origin/main
 *   (the OFFLINE item-resolved axis; the gh PR axis degrades OFF against a non-GitHub throwaway origin, so this
 *   exercises the offline path deterministically) — while NEVER reaping a lease whose item is still open (the
 *   #2267 positive-death-signal-only safety) and NEVER a reserved lane. Spawns the real script against a
 *   throwaway origin + reference under a private POOL_ROOT (no network, no shared pool root).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');
const LEASE_FILE = (lane) => join(lane, '.git', '.lane-lease');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

let base, originDir, referenceDir, poolRoot;

function runPool(args) {
  const r = spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: referenceDir,
    env: { ...process.env, LANE_POOL_ROOT: poolRoot },
  });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

const poolArgs = () => [`--origin=${originDir}`, `--reference=${referenceDir}`, `--name=reappool`, '--branch=main', '--no-install'];
const lanePath = (n) => join(poolRoot, 'reappool', `lane-${n}`);

// Write a backlog card at a given status into the reference, commit + push (so origin/main carries it).
function pushCard(num, status) {
  const dir = join(referenceDir, 'backlog');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${num}-item.md`), `---\nstatus: ${status}\n---\n\n# item ${num}\n`);
  git(['add', 'backlog'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', `card ${num} ${status}`], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-reap-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);

  expect(runPool(['provision', '--count=3', ...poolArgs()]).code).toBe(0);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

function acquire(lane, session, extra = []) {
  const r = runPool(['acquire', `--lane=${lane}`, `--session=${session}`, '--no-reset', '--no-reap', ...extra, ...poolArgs()]);
  expect(r.code).toBe(0);
  return lanePath(lane);
}

describe('lane-pool #2748 — acquire reaps a provably-dead (item-resolved) ghost before allocating', () => {
  it('reaps a lease whose item is RESOLVED on origin/main when a fresh acquire runs', () => {
    pushCard('9999', 'resolved');
    const ghost = acquire(1, 'conveyor-9999'); // a lingering lease for an already-resolved item
    expect(existsSync(LEASE_FILE(ghost))).toBe(true);

    // A fresh acquire (reaper ON) on a DIFFERENT lane must first reclaim the dead lease on lane-1.
    const r = runPool(['acquire', '--lane=2', '--session=fresh', '--no-reset', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(existsSync(LEASE_FILE(ghost))).toBe(false); // ghost reaped
    expect(r.err).toMatch(/reaped lane-1 before acquire/);
  });

  it('does NOT reap a lease whose item is still OPEN (positive-death-signal only, #2267)', () => {
    pushCard('8888', 'open');
    const live = acquire(1, 'conveyor-8888');
    const r = runPool(['acquire', '--lane=2', '--session=fresh', '--no-reset', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(existsSync(LEASE_FILE(live))).toBe(true); // NOT reaped — no death signal
  });

  it('does NOT reap when there is no card for the item at all (unknown → keep)', () => {
    const live = acquire(1, 'conveyor-5555'); // no backlog/5555-*.md on main
    const r = runPool(['acquire', '--lane=2', '--session=fresh', '--no-reset', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(existsSync(LEASE_FILE(live))).toBe(true);
  });

  it('NEVER reaps a reserved lane even when its item is resolved', () => {
    pushCard('9999', 'resolved');
    const resv = runPool(['acquire', '--reserve', '--lane=1', '--session=conveyor-9999', '--purpose=memory', ...poolArgs()]);
    expect(resv.code).toBe(0);
    const r = runPool(['acquire', '--lane=2', '--session=fresh', '--no-reset', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(existsSync(LEASE_FILE(lanePath(1)))).toBe(true); // reserved memory lane survives
  });

  it('--no-reap opts out — a dead lease is left in place', () => {
    pushCard('9999', 'resolved');
    const ghost = acquire(1, 'conveyor-9999');
    const r = runPool(['acquire', '--lane=2', '--session=fresh', '--no-reset', '--no-reap', ...poolArgs()]);
    expect(r.code).toBe(0);
    expect(existsSync(LEASE_FILE(ghost))).toBe(true); // not reaped
  });
});
