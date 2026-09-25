/**
 * @file scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs
 * @description Proof of the xj2k2pp fix (epic #3383/#4075, backlog #4173, soak break `lane-acquire-under-load`).
 *   `acquirableListCached`'s "wait for someone ELSE's in-flight shared scan" loop (`we:scripts/lane-pool.mjs`)
 *   used to be bounded ONLY by `scanTimeoutMs + LIST_LOCK_ORPHAN_GRACE_MS` — the SCAN's own generous budget —
 *   never by THIS caller's own, usually much smaller, `--wait-ms`. So a caller with a small `--wait-ms` who
 *   loses the race for the single-flight scan lock to a slower, longer-lived caller sat there until either (a)
 *   the lock owner's scan actually finished (fresh cache appears), or (b) the lock was judged stale (the OTHER
 *   caller's scan-timeout + grace elapsed) — whichever came first — REGARDLESS of its own wait-ms having long
 *   since elapsed. At 14-lane/5-caller soak scale this produced the "serialized staircase": waiters returning
 *   33s/34s/45s/56s/68s for a `--wait-ms=20000` bound of ~40s (`SOAK_LOAD_LANES=14 SOAK_LOAD_CALLERS=5 node
 *   we:scripts/conveyor/soak/run.mjs break lane-acquire-under-load`).
 *
 *   THE FIX: `acquirableListCached` now takes a `callerDeadlineMs` (this acquire call's own `wait-ms` deadline)
 *   and checks it EVERY time it is about to sit out someone else's lock — never widening the shared scan's own
 *   budget (a genuinely different, longer-lived caller sharing that same lock still gets the full scan), only
 *   bounding how long THIS caller may wait on it. On its own deadline, it throws a distinguishable
 *   `{ lockContention: true }` error, which `cmdAcquire` reports as its own clear reason ("lock contention"),
 *   distinct from "N all held/dirty" (a completed scan found nothing) and "the acquirability scan itself did
 *   not finish" (the scan itself hung) — mirroring the existing `sawScanTimeout` handling exactly, including
 *   refusing to let growth-on-empty fire on it (an unanswered lock is not proof the pool is starved).
 *
 *   Same throwaway origin+pool+slow-git-shim harness shape as the sibling `lane-pool-acquire-scan-wait-decouple.
 *   test.mjs` this file is modeled on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');
const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

let base, originDir, referenceDir, poolRoot, shimDir;

const REPO = () => [`--origin=${originDir}`, `--reference=${referenceDir}`, '--name=lockwait', '--branch=main', '--no-install', '--no-reap'];
const env = (extra = {}) => ({ ...process.env, LANE_POOL_ROOT: poolRoot, PATH: `${shimDir}:${process.env.PATH}`, ...extra });

function runPool(args, extraEnv = {}) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: env(extraEnv), timeout: 30_000 });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
function runPoolAsync(args, extraEnv = {}) {
  const startedAt = Date.now();
  return new Promise((res) => {
    const c = spawn('node', [SCRIPT, ...args], { env: env(extraEnv) });
    let out = '';
    let err = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (err += d));
    c.on('close', (code) => res({ code, out, err, ms: Date.now() - startedAt }));
  });
}
function sleep(ms) {
  return new Promise((r) => { setTimeout(r, ms); });
}
function provision(count) {
  expect(runPool(['provision', `--count=${count}`, ...REPO()]).code).toBe(0);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-lockwait-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');
  shimDir = join(base, 'shim');
  mkdirSync(shimDir);
  // Same slow-`git`-shim technique as `lane-pool-acquire-scan-wait-decouple.test.mjs`: real git, but every
  // invocation sleeps `GIT_SHIM_SLEEP` seconds first — stands in for a slow/loaded host so a full-pool scan
  // takes real, measurable wall-clock time instead of near-zero on modern hardware.
  writeFileSync(
    join(shimDir, 'git'),
    `#!/bin/sh\nif [ -n "$GIT_SHIM_SLEEP" ]; then sleep "$GIT_SHIM_SLEEP"; fi\nexec "${REAL_GIT}" "$@"\n`,
  );
  chmodSync(join(shimDir, 'git'), 0o755);

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('lane-pool acquire (xj2k2pp) — the shared-scan LOCK WAIT is bounded by the caller\'s own --wait-ms', () => {
  it('a caller stuck behind someone ELSE\'s slow scan gives up at its OWN --wait-ms, not the scan\'s budget', async () => {
    provision(3);
    // Every git call sleeps 1s; a 3-lane scan needs several git calls per lane (status/rev-list/etc), so the
    // FULL scan `holder` runs takes several real seconds — long enough to clearly outlast `waiter`'s own
    // --wait-ms below, but well inside the generous --scan-timeout-ms so it is a genuine, completing scan,
    // never a `sawScanTimeout` artifact (that is the SEPARATE, already-covered case in
    // lane-pool-acquire-scan-wait-decouple.test.mjs).
    const GIT_SHIM_SLEEP = '1';
    const SCAN_TIMEOUT_MS = 30_000; // generous — the scan must actually finish, not time out
    const WAIT_MS = 500; // waiter's own budget — far smaller than the holder's real scan cost
    const BOUND_MS = WAIT_MS + 4_000; // generous margin for process/git spawn overhead, never the scan's own cost

    // `holder` starts first and (being alone) wins the single-flight scan lock; a short delay before starting
    // `waiter` makes which process wins the lock race deterministic instead of flaky.
    const holderPromise = runPoolAsync(
      ['acquire', ...REPO(), '--session=holder', '--wait-ms=0', `--scan-timeout-ms=${SCAN_TIMEOUT_MS}`, '--hard-max=3'],
      { GIT_SHIM_SLEEP },
    );
    await sleep(150);
    const waiterPromise = runPoolAsync(
      ['acquire', ...REPO(), '--session=waiter', `--wait-ms=${WAIT_MS}`, `--scan-timeout-ms=${SCAN_TIMEOUT_MS}`, '--hard-max=3'],
      { GIT_SHIM_SLEEP },
    );

    const waiter = await waiterPromise;
    // THE FIX, proven directly: `waiter` returns close to its OWN wait-ms, not anywhere near the holder's full
    // scan cost (which the shim guarantees is several seconds — well past BOUND_MS).
    expect(waiter.ms).toBeLessThanOrEqual(BOUND_MS);
    expect(waiter.code).not.toBe(0);
    expect(waiter.err).toMatch(/lock contention/i);
    expect(waiter.err).toMatch(/no lane within \d+ms/);
    // Never misreported as either of the two PRE-EXISTING, already-covered reasons — this is neither of those.
    expect(waiter.err).not.toMatch(/all held\/dirty/);
    expect(waiter.err).not.toMatch(/scan itself did not finish/);

    await holderPromise; // let the holder's own (slow, real) scan/acquire finish before the harness tears down
  }, 30_000);
});
