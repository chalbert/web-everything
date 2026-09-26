/**
 * @file scripts/conveyor/__tests__/verify-dispatch.test.mjs
 * @description Regression for #3105 — a delivery agent's gate legitimately outruns the agent tool's ~120s
 *   foreground window, so it gets auto-backgrounded and the agent stalls, silently. This pass is the fix: the
 *   runner (not the agent) runs the gate, picking up a `request`-stamped `.lane-verify` marker
 *   (`scripts/verify-lane.mjs request`) on its own tick — a plain long-lived process with no per-turn ceiling.
 *   {@link laneNeedsVerifyDispatch} is the pure decision (unit-tested against fixtures below); the CLI section
 *   spawns the real `verify-lane.mjs`/`verify-dispatch.mjs` against a throwaway git fixture, no network, and
 *   asserts the full request → dispatch → green round trip a delivery agent would actually rely on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, spawn as spawnProcess, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { laneNeedsVerifyDispatch, spawnGateBounded, GATE_STARTED_MARKER } from '../verify-dispatch.mjs';
import { heldSlots, admissionLockRoot } from '../../readiness/heavy-admission.mjs';

describe('laneNeedsVerifyDispatch — the pure dispatch decision', () => {
  it('dispatches a running marker for the lane\'s own current HEAD', () => {
    expect(laneNeedsVerifyDispatch({ status: 'running', sha: 'abc123' }, 'abc123')).toBe(true);
  });

  it('does NOT dispatch a running marker for a sha that is no longer HEAD (stale request)', () => {
    expect(laneNeedsVerifyDispatch({ status: 'running', sha: 'old111' }, 'new222')).toBe(false);
  });

  it('does NOT dispatch a terminal green/red marker — nothing was asked for the new HEAD', () => {
    expect(laneNeedsVerifyDispatch({ status: 'green', sha: 'abc123' }, 'abc123')).toBe(false);
    expect(laneNeedsVerifyDispatch({ status: 'red', sha: 'abc123' }, 'abc123')).toBe(false);
  });

  it('does NOT dispatch a corrupt marker or an absent one', () => {
    expect(laneNeedsVerifyDispatch({ corrupt: true }, 'abc123')).toBe(false);
    expect(laneNeedsVerifyDispatch(null, 'abc123')).toBe(false);
  });

  it('does NOT dispatch when HEAD is unresolvable', () => {
    expect(laneNeedsVerifyDispatch({ status: 'running', sha: 'abc123' }, null)).toBe(false);
  });
});

const SCRIPT = resolve(process.cwd(), 'scripts/conveyor/verify-dispatch.mjs');
const VERIFY_LANE = resolve(process.cwd(), 'scripts/verify-lane.mjs');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runDispatch(args, extraEnv = {}) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

function runVerifyLane(args, cwd) {
  const r = spawnSync('node', [VERIFY_LANE, ...args], { encoding: 'utf8', cwd });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

let base, poolRoot, laneDir;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'verify-dispatch-'));
  poolRoot = join(base, 'pool');
  const poolDir = join(poolRoot, 'flagtest');
  laneDir = join(poolDir, 'lane-1');
  mkdirSync(poolDir, { recursive: true });
  git(['init', '--quiet', '--initial-branch=main', laneDir]);
  writeFileSync(join(laneDir, 'f.txt'), 'a\n');
  git(['add', 'f.txt'], laneDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], laneDir);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('verify-dispatch CLI — the request → dispatch → green round trip (#3105)', () => {
  it('a fresh lane with no request has nothing to dispatch', () => {
    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).dispatched).toEqual([]);
  });

  it('picks up a `request`-stamped marker and runs the gate to a GREEN terminal record', () => {
    const req = runVerifyLane(['request', `--repo=${laneDir}`, '--gate=true', '--json'], laneDir);
    expect(req.code).toBe(0);
    expect(JSON.parse(req.out).status).toBe('requested');

    // Before dispatch: check reads it as an ordinary in-flight running marker — no new vocabulary.
    const before = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    expect(JSON.parse(before.out).status).toBe('running');

    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot });
    expect(r.code).toBe(0);
    const body = JSON.parse(r.out);
    expect(body.dispatched).toHaveLength(1);
    expect(body.dispatched[0]).toMatchObject({ pool: 'flagtest', lane: 1 });

    const after = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    const afterBody = JSON.parse(after.out);
    expect(afterBody.status).toBe('green');
    expect(afterBody.ok).toBe(true);
  });

  it('a request for a sha that is no longer HEAD is left alone (nobody asked to verify the new one)', () => {
    runVerifyLane(['request', `--repo=${laneDir}`, '--gate=true', '--json'], laneDir);
    // Advance HEAD past the requested sha without a new request.
    writeFileSync(join(laneDir, 'f.txt'), 'b\n');
    git(['add', 'f.txt'], laneDir);
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v2'], laneDir);

    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).dispatched).toEqual([]);
  });

  it('records a RED dispatch as success (the marker recorded the fact — not a pass failure)', () => {
    runVerifyLane(['request', `--repo=${laneDir}`, '--gate=false', '--json'], laneDir);
    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).dispatched[0]).toMatchObject({ red: true });

    const after = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    expect(JSON.parse(after.out).status).toBe('red');
  });
});

describe('verify-dispatch CLI — the hard wall-clock ceiling (epic #3383, live incident 2026-09-14)', () => {
  // A real hang, simulated: the gate sleeps far longer than the test-scoped ceiling, then touches a marker
  // file — the marker file existing later is proof the CHAIN kept running (an orphan), not just that the one
  // pid `execFileSync`'s own `timeout` option signals directly.
  it('kills a gate that outruns VERIFY_DISPATCH_TIMEOUT_MS — including the tree beneath it, not just the pid dispatch spawned', async () => {
    // #4075 follow-up (ci-heal-2721, 2026-09-26): this test's own fixture sleep (was 3s) and its "returns
    // promptly" bound (was 2500ms against a 300ms ceiling — under 10x headroom) both flaked TWICE under real
    // load (~3 runnable procs/core): killing the whole shell→sleep→touch tree and propagating the exit back
    // through `verify-dispatch.mjs`/`spawnSync` costs real OS scheduling time that grows with contention, not
    // with the ceiling being tested. The fixture sleep is widened to GATE_SLEEP_MS so a much larger, load-
    // tolerant return bound still lands comfortably before the sleep would finish on its own — preserving the
    // one thing this test actually proves (the process was PREEMPTED, not merely fast) — and the later proof
    // check polls instead of firing one fixed-delay `setTimeout`, so a delayed poll only means "checked later
    // and still absent", never a false failure.
    const GATE_SLEEP_MS = 15_000;
    const RETURN_CEILING_MS = 9_000; // generous vs. the 300ms ceiling under test; still « GATE_SLEEP_MS
    const proofFile = join(base, 'still-running.proof');
    const req = runVerifyLane(['request', `--repo=${laneDir}`, `--gate=sleep ${GATE_SLEEP_MS / 1000} && touch ${proofFile}`, '--json'], laneDir);
    expect(req.code).toBe(0);

    const started = Date.now();
    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot, VERIFY_DISPATCH_TIMEOUT_MS: '300' });
    const elapsedMs = Date.now() - started;

    // The dispatch call itself returns promptly (near the 300ms ceiling), never waiting out the whole
    // sleep — this is the actual driver-unblocking behavior: the tick moves on instead of hanging. The bound
    // is generous (load-tolerant) but still well under GATE_SLEEP_MS, so a pass still proves preemption.
    expect(elapsedMs).toBeLessThan(RETURN_CEILING_MS);

    const body = JSON.parse(r.out);
    expect(body.dispatched).toEqual([]);
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0]).toMatchObject({ pool: 'flagtest', lane: 1, timedOut: true });

    // The killed run never got to write a terminal record — this IS the existing stranded-marker recovery
    // shape (a prior runner process dying mid-run), reused deliberately rather than inventing something new.
    const after = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    expect(JSON.parse(after.out).status).toBe('running');

    // Proof the WHOLE tree died, not just the immediate `verify-lane.mjs` pid: poll until well past the
    // original sleep the gate was running, confirming the `touch` after it never runs at any check point. A
    // naive single-pid SIGTERM would leave the shell → sleep → touch chain orphaned and it WOULD still create
    // this file once the sleep naturally elapses; polling (rather than one delayed check) means a slow test
    // process only delays when we look, never causes us to look too early.
    const deadline = started + GATE_SLEEP_MS + 5_000; // generous margin past the natural sleep completion
    while (Date.now() < deadline) {
      expect(existsSync(proofFile)).toBe(false);
      // eslint-disable-next-line no-await-in-loop -- deliberate poll, not a fixed single sleep
      await new Promise((res) => setTimeout(res, 250));
    }
    expect(existsSync(proofFile)).toBe(false);
  }, 30_000);

  it('a run that finishes within the ceiling is never touched by it', () => {
    const req = runVerifyLane(['request', `--repo=${laneDir}`, '--gate=true', '--json'], laneDir);
    expect(req.code).toBe(0);

    // A generous ceiling relative to the fast `true` gate — this is the "must not kill a legitimately slow
    // but healthy run" guarantee, exercised at the opposite extreme (a near-instant one).
    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot, VERIFY_DISPATCH_TIMEOUT_MS: '5000' });
    const body = JSON.parse(r.out);
    expect(body.failures).toEqual([]);
    expect(body.dispatched[0]).toMatchObject({ pool: 'flagtest', lane: 1 });

    const after = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    expect(JSON.parse(after.out).status).toBe('green');
  });

  // Independent-review finding (2026-09-14, epic #3383, PR #2236): an EXTERNAL actor killing the spawned
  // verify-lane.mjs process (an operator's `kill -9`, an OS OOM-kill, a host restart) produces the exact same
  // exit shape (`status: null`, a signal present) as OUR OWN ceiling firing — a prior version of the outer
  // classifier re-derived "timed out" from that shape alone and would misattribute the external kill as
  // "exceeded the ceiling". The gate here sends itself SIGTERM via `$PPID` (verify-lane.mjs's own pid, its
  // direct parent) — simulating exactly that external-kill scenario — with both ceilings set far longer than
  // this test could ever run, so NEITHER of our own timers can legitimately fire.
  it('an EXTERNAL kill of the verify-lane child is reported as a plain failure, never mislabeled as a ceiling timeout', () => {
    const req = runVerifyLane(['request', `--repo=${laneDir}`, '--gate=kill -TERM $PPID', '--json'], laneDir);
    expect(req.code).toBe(0);

    const r = runDispatch(['--json'], {
      LANE_POOL_ROOT: poolRoot,
      VERIFY_DISPATCH_TIMEOUT_MS: '60000',
      VERIFY_DISPATCH_QUEUE_CEILING_MS: '60000',
    });
    const body = JSON.parse(r.out);
    expect(body.dispatched).toEqual([]);
    expect(body.failures).toHaveLength(1);
    // A real failure IS reported (the lane still needs a retry) — but NOT as a ceiling timeout, since neither
    // of our own timers fired.
    expect(body.failures[0]).toMatchObject({ pool: 'flagtest', lane: 1 });
    expect(body.failures[0].timedOut).toBeFalsy();
    expect(body.failures[0].timedOutPhase).toBeUndefined();
  });
});

// ── Skeptic-review fix (2026-09-14, epic #3383): GATE time only, not queue-plus-gate ───────────────────────
// The first cut of the ceiling above measured wall-clock from SPAWN, which silently includes whatever time
// `verify-lane.mjs` spends waiting on `heavy-admission.mjs`'s own capacity semaphore (up to its own 20-minute
// fail-open) BEFORE the real gate even starts. A healthy run that legitimately queues and then runs a normal
// (or contention-slowed) gate could total more than the 30-minute ceiling and get killed anyway — exactly the
// "hung vs merely-queued" distinction the ceiling exists to draw, defeated by its own design. These tests
// reproduce that incoherence directly against {@link spawnGateBounded} (deterministic, no real timing flake)
// and then prove it against the REAL `verify-lane.mjs` + `heavy-admission.mjs` integration (genuine slot
// contention, not a fixture) — confirming the marker line `verify-lane.mjs` now emits is the one
// `verify-dispatch.mjs` actually watches for.

function writeFixtureGate(dir, { queueDelayMs, gateDurationMs, exitCode = 0 }) {
  const p = join(dir, `fixture-gate-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(
    p,
    [
      `setTimeout(() => {`,
      `  process.stderr.write(${JSON.stringify(GATE_STARTED_MARKER)} + '\\n');`,
      `  setTimeout(() => process.exit(${exitCode}), ${gateDurationMs});`,
      `}, ${queueDelayMs});`,
    ].join('\n'),
    'utf8',
  );
  return p;
}

describe('spawnGateBounded — gate-only timing (Skeptic-review fix, epic #3383)', () => {
  it('does NOT kill a run whose QUEUE phase is long but whose GATE phase is short (the exact incoherence)', async () => {
    // Total wall-clock (queue 800ms + gate 100ms = 900ms) exceeds gateCeilingMs (500ms) — the OLD single
    // spawn-to-exit ceiling would have killed this. The gate ceiling here applies ONLY after the marker, and
    // the real gate-only time (100ms) is comfortably inside it, so this must resolve, not reject.
    const script = writeFixtureGate(base, { queueDelayMs: 800, gateDurationMs: 100 });
    await expect(spawnGateBounded([script], { queueCeilingMs: 5000, gateCeilingMs: 500 })).resolves.toBeTruthy();
  });

  it('still kills a run whose GATE phase itself hangs past gateCeilingMs (the original protection, preserved)', async () => {
    const script = writeFixtureGate(base, { queueDelayMs: 50, gateDurationMs: 5000 });
    await expect(spawnGateBounded([script], { queueCeilingMs: 5000, gateCeilingMs: 300 })).rejects.toMatchObject({ timedOutPhase: 'gate' });
  });

  it('kills a run that never reaches the gate at all — a hang BEFORE the marker ever appears', async () => {
    const script = writeFixtureGate(base, { queueDelayMs: 5000, gateDurationMs: 100 });
    await expect(spawnGateBounded([script], { queueCeilingMs: 300, gateCeilingMs: 5000 })).rejects.toMatchObject({ timedOutPhase: 'queue' });
  });
});

describe('verify-dispatch CLI — real admission-queue contention does not trip the gate ceiling (integration)', () => {
  // A REAL holder occupies the (capped-to-1) heavy-admission slot for `HOLD_MS` using the actual production
  // `heavy-admission.mjs run` CLI — not a bespoke fixture — so `verify-lane.mjs`'s own `acquireSlotBlocking`
  // call genuinely queues behind it, exactly as it would in production contention.
  const HOLD_MS = 2000;

  it('a lane queued behind real admission contention, then a fast gate, is NOT killed by the gate-only ceiling', async () => {
    const cli = resolve(process.cwd(), 'scripts/readiness/heavy-admission.mjs');
    const admissionEnv = { ...process.env, LANE_POOL_ROOT: poolRoot, WE_HEAVY_ADMISSION_CAP: '1' };
    // xaipsbs — the `run` wrapper is a pass-through under CI, the off switch, or an outer wrapper's held flag
    // (this suite itself runs inside `npm run test:unit`, which sets it). The holder must really hold a slot.
    delete admissionEnv.CI; delete admissionEnv.WE_HEAVY_ADMISSION; delete admissionEnv.WE_HEAVY_ADMISSION_HELD;
    const holder = spawnProcess('node', [cli, 'run', '--owner=test-holder', `--repo=${poolRoot}`, '--', 'sleep', '2'], {
      env: admissionEnv,
      stdio: 'ignore',
    });
    // #4075 follow-up (ci-heal-2721, 2026-09-26): a fixed "give the holder a moment" 200ms sleep flaked under
    // real load — spawning + scheduling the holder process itself can take longer than 200ms when the host is
    // busy, so `started` below could begin BEFORE the holder actually won its slot, or well after part of its
    // hold was already spent; either way the fixed `elapsedMs >= HOLD_MS - 300` bound below no longer means
    // what it says. Fix: poll the REAL slot-lock state (`heldSlots`, the same primitive `heavy-admission.mjs
    // status` reads) until the holder provably has the slot, and read the lock's own real acquisition instant
    // off it — never guess from our own polling latency — so the "how much hold is left" math stays correct
    // regardless of how long detection itself took under load.
    const lockRoot = admissionLockRoot(poolRoot, admissionEnv);
    const pollDeadline = Date.now() + 10_000;
    let holderEntry;
    while (Date.now() < pollDeadline) {
      holderEntry = heldSlots({ lockRoot, cap: 1 }).find((s) => s.owner === 'test-holder');
      if (holderEntry) break;
      // eslint-disable-next-line no-await-in-loop -- deliberate poll, not a fixed single sleep
      await new Promise((res) => setTimeout(res, 25));
    }
    expect(holderEntry, 'the holder never showed up as holding slot-0 within 10s').toBeTruthy();
    const holderAcquiredAt = Date.parse(holderEntry.meta?.acquiredAt || holderEntry.heartbeatAt);
    expect(Number.isFinite(holderAcquiredAt)).toBe(true);

    const req = runVerifyLane(['request', `--repo=${laneDir}`, '--gate=true', '--json'], laneDir);
    expect(req.code).toBe(0);

    const started = Date.now();
    const r = runDispatch(['--json'], {
      LANE_POOL_ROOT: poolRoot,
      WE_HEAVY_ADMISSION_CAP: '1',
      WE_HEAVY_ADMISSION_TIMEOUT_MS: '10000', // must actually WAIT for the holder, never fail open, in this test
      // The gate-only ceiling is smaller than (queue wait + gate), which is exactly what would have tripped
      // the OLD single spawn-to-exit ceiling — proving THIS run survives because only gate time counts.
      VERIFY_DISPATCH_TIMEOUT_MS: '1500',
    });
    const elapsedMs = Date.now() - started;

    const body = JSON.parse(r.out);
    expect(body.failures).toEqual([]);
    expect(body.dispatched[0]).toMatchObject({ pool: 'flagtest', lane: 1 });
    // Proof real queuing happened, not a lucky fast path: total elapsed must have actually included whatever
    // of the holder's real HOLD_MS was still remaining at the moment WE started measuring — computed from the
    // holder's own real acquisition timestamp, never assumed to equal the nominal HOLD_MS.
    const remainingHoldMsAtStart = Math.max(0, HOLD_MS - (started - holderAcquiredAt));
    expect(elapsedMs).toBeGreaterThanOrEqual(Math.max(0, remainingHoldMsAtStart - 300));

    const after = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    expect(JSON.parse(after.out).status).toBe('green');

    await new Promise((res) => holder.on('exit', res));
  }, 30_000);
});
