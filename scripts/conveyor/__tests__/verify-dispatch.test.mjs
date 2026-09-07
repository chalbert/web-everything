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
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
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
