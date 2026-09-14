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
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { laneNeedsVerifyDispatch } from '../verify-dispatch.mjs';

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
  it('kills a gate that outruns VERIFY_DISPATCH_TIMEOUT_MS — including the tree beneath it, not just the pid dispatch spawned', () => {
    const proofFile = join(base, 'still-running.proof');
    const req = runVerifyLane(['request', `--repo=${laneDir}`, `--gate=sleep 3 && touch ${proofFile}`, '--json'], laneDir);
    expect(req.code).toBe(0);

    const started = Date.now();
    const r = runDispatch(['--json'], { LANE_POOL_ROOT: poolRoot, VERIFY_DISPATCH_TIMEOUT_MS: '300' });
    const elapsedMs = Date.now() - started;

    // The dispatch call itself returns promptly (near the 300ms ceiling), never waiting out the 3s sleep —
    // this is the actual driver-unblocking behavior: the tick moves on instead of hanging.
    expect(elapsedMs).toBeLessThan(2500);

    const body = JSON.parse(r.out);
    expect(body.dispatched).toEqual([]);
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0]).toMatchObject({ pool: 'flagtest', lane: 1, timedOut: true });

    // The killed run never got to write a terminal record — this IS the existing stranded-marker recovery
    // shape (a prior runner process dying mid-run), reused deliberately rather than inventing something new.
    const after = runVerifyLane(['check', `--repo=${laneDir}`, '--json'], laneDir);
    expect(JSON.parse(after.out).status).toBe('running');

    // Proof the WHOLE tree died, not just the immediate `verify-lane.mjs` pid: wait past the original 3s
    // sleep the gate was running and confirm the `touch` after it never ran. A naive single-pid SIGTERM would
    // leave the shell → sleep → touch chain orphaned and it WOULD still create this file around the 3s mark.
    return new Promise((res) => {
      setTimeout(() => {
        expect(existsSync(proofFile)).toBe(false);
        res();
      }, 3500 - elapsedMs > 0 ? 3500 - elapsedMs : 100);
    });
  });

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
});
