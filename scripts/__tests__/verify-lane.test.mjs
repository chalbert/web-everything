/**
 * @file scripts/__tests__/verify-lane.test.mjs
 * @description Behavioral proof of the #2833 verification WRITER (`scripts/verify-lane.mjs`) — the IO half the
 *   pure core (`lane-verify.mjs`) cannot cover. It reproduces the overlapping-runs RACE that finding 1 caught:
 *   two `verify-lane` runs share one clone's marker, and the finish write must never stamp a result for a sha it
 *   did not verify. A slow GREEN run at X must NOT stamp green over a RED record for Y — the exact false-green
 *   this guard exists to kill, reintroduced in the guard's own writer.
 *
 *   Substrate: an ephemeral throwaway `git init` repo under `mkdtemp` (never the shared lane pool; decision
 *   #2274). The "overlapping run" is simulated by a GATE command that overwrites the marker with a red record
 *   for a DIFFERENT sha mid-run — i.e. between this run's start-write and its finish-write, exactly when a real
 *   sibling run B would claim the marker.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LEASE_FILENAME } from '../lib/lane-lease.mjs';

const VERIFY_LANE = resolve(process.cwd(), 'scripts/verify-lane.mjs');
const OTHER_SHA = 'b'.repeat(40); // "Y" — the sha the overlapping run's marker belongs to (never this HEAD)

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'verify-lane-race-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--allow-empty', '-qm', 'x'], { cwd: dir });
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const marker = () => join(dir, '.git', '.lane-verify');
const headSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

/** Run verify-lane in the temp repo with a custom gate; return { code, json }. Never throws on non-zero exit. */
function runVerify(gate) {
  try {
    const out = execFileSync('node', [VERIFY_LANE, `--gate=${gate}`, '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, json: JSON.parse(out.trim().split('\n').pop()) };
  } catch (e) {
    return { code: e.status ?? null, json: (() => { try { return JSON.parse(String(e.stdout).trim().split('\n').pop()); } catch { return null; } })() };
  }
}

describe('verify-lane writer — overlapping-runs race (#2833 finding 1)', () => {
  it('a slow GREEN run at X refuses to stamp green over a RED record for Y (no false-green)', () => {
    // Gate = a mid-run "overlapping run B" that claims the marker with red-Y, then exits 0 (this run's suites pass).
    const redY = JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: '2026-08-02T00:01:00.000Z', suites: 'gate', exitCode: 2 });
    const gateScript = join(dir, 'gate.mjs');
    writeFileSync(gateScript, `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker())}, ${JSON.stringify(redY + '\n')});\nprocess.exit(0);\n`);

    const { code, json } = runVerify(`node ${gateScript}`);

    // The finish write is REFUSED (compare-and-set failed: on-disk sha Y ≠ this run's sha X).
    expect(code).toBe(3);
    expect(json?.status).toBe('superseded');

    // The marker on disk is STILL the red record for Y — never overwritten with a green.
    const onDisk = JSON.parse(readFileSync(marker(), 'utf8'));
    expect(onDisk.sha).toBe(OTHER_SHA);
    expect(onDisk.status).toBe('red');
  });

  it('with no overlap, a green run writes a green marker keyed to THIS head (the writer still works)', () => {
    const { code, json } = runVerify('true');
    expect(code).toBe(0);
    expect(json.status).toBe('green');
    expect(existsSync(marker())).toBe(true);
    const onDisk = JSON.parse(readFileSync(marker(), 'utf8'));
    expect(onDisk.sha).toBe(headSha()); // stamped the sha it actually verified
    expect(onDisk.status).toBe('green');
  });

  it('the START write never destroys a terminal GREEN for a FOREIGN sha: it archives it and runs (#2833 finding 4, #3751)', () => {
    // Before this run begins, the marker holds a terminal GREEN for a DIFFERENT sha Y. Finding 4 forbids destroying
    // that result; #3751 keeps it in `.lane-verify.previous` instead of refusing, so this head's verify still runs.
    const greenY = JSON.stringify({ sha: OTHER_SHA, status: 'green', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: '2026-08-02T00:01:00.000Z', suites: 'gate', exitCode: 0 });
    writeFileSync(marker(), greenY + '\n');

    const { code, json } = runVerify('true');

    expect(code).toBe(0);
    expect(json?.status).toBe('green');
    expect(JSON.parse(readFileSync(marker(), 'utf8')).sha).toBe(headSha());
    const kept = JSON.parse(readFileSync(join(dir, '.git', '.lane-verify.previous'), 'utf8'));
    expect(kept.sha).toBe(OTHER_SHA);
    expect(kept.status).toBe('green');
  });
});

describe('verify-lane — a terminal record for an EARLIER commit of this lane is archived, not a blocker (#3751, #3383)', () => {
  it('a second verify after a new commit starts, runs, and keeps the old record in .lane-verify.previous', () => {
    const first = runVerify('true');
    expect(first.json.status).toBe('green');
    const firstSha = headSha();
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--allow-empty', '-qm', 'next'], { cwd: dir });
    const second = runVerify('true');
    expect(second.code).toBe(0);
    expect(second.json.status).toBe('green');
    expect(JSON.parse(readFileSync(marker(), 'utf8')).sha).toBe(headSha());
    const prev = JSON.parse(readFileSync(join(dir, '.git', '.lane-verify.previous'), 'utf8'));
    expect(prev).toMatchObject({ sha: firstSha, status: 'green' });
  });
});

describe('verify-lane request (#3105) — stamp the marker, run nothing, return immediately', () => {
  function runRequest(gate) {
    try {
      const out = execFileSync('node', [VERIFY_LANE, 'request', `--gate=${gate}`, '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, json: JSON.parse(out.trim().split('\n').pop()) };
    } catch (e) {
      return { code: e.status ?? null, json: (() => { try { return JSON.parse(String(e.stdout).trim().split('\n').pop()); } catch { return null; } })() };
    }
  }

  it('stamps a running marker for HEAD and exits 0 without running the gate', () => {
    // A gate that would fail loudly if ever executed — proves `request` never runs it.
    const { code, json } = runRequest('exit 7');
    expect(code).toBe(0);
    expect(json.status).toBe('requested');
    expect(json.sha).toBe(headSha());

    const onDisk = JSON.parse(readFileSync(marker(), 'utf8'));
    expect(onDisk.status).toBe('running');
    expect(onDisk.sha).toBe(headSha());
    expect(onDisk.finishedAt).toBeNull();
  });

  it('`check` reads a requested marker exactly like an ordinary in-flight running one — no new vocabulary', () => {
    runRequest('true');
    let out;
    try {
      out = execFileSync('node', [VERIFY_LANE, 'check', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = String(e.stdout);
    }
    const { status, ok, reason } = JSON.parse(out.trim());
    expect(status).toBe('running');
    expect(ok).toBe(false);
    expect(reason).toBe('verify-unfinished');
  });

  it('a plain `verify` run picks up the requested marker and carries it to a terminal green result', () => {
    runRequest('true');
    const after = runVerify('true');
    expect(after.code).toBe(0);
    expect(after.json.status).toBe('green');
  });

  it('archives a foreign TERMINAL marker rather than clobbering it — the same start-write rule `verify` applies', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'green', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 0 }) + '\n');
    const { code, json } = runRequest('true');
    expect(code).toBe(0);
    expect(json.status).toBe('requested');
    // The foreign terminal record survives, in the archive.
    const kept = JSON.parse(readFileSync(join(dir, '.git', '.lane-verify.previous'), 'utf8'));
    expect(kept.sha).toBe(OTHER_SHA);
    expect(kept.status).toBe('green');
  });
});

describe('verify-lane check --wait= (#4358) — a bounded internal wait, one CLI call per settle', () => {
  /** Run `check --wait=…` (plus any extra args) in the temp repo; returns {code, json, stderr}. Uses `spawnSync`
   *  (not `execFileSync`) specifically so stderr is captured on the SUCCESS path too (a clamp warning prints on
   *  stderr even when the call itself exits 0) — `execFileSync` only surfaces stderr via the thrown error on a
   *  non-zero exit, which would silently drop it here. */
  function runCheckWait(waitArg, extraArgs = []) {
    const r = spawnSync('node', [VERIFY_LANE, 'check', ...(waitArg != null ? [`--wait=${waitArg}`] : []), '--json', ...extraArgs], { cwd: dir, encoding: 'utf8' });
    return {
      code: r.status,
      json: (() => { try { return JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch { return null; } })(),
      stderr: String(r.stderr || ''),
    };
  }

  it('an already-GREEN marker settles on the very first poll — no waiting out the ceiling', () => {
    runVerify('true'); // records a green marker for HEAD
    const { code, json } = runCheckWait(60_000);
    expect(code).toBe(0);
    expect(json).toMatchObject({ status: 'green', ok: true, settled: true });
    expect(json.sha).toBe(headSha());
    expect(json.waited.polls).toBe(1);
  });

  it('a marker that never settles times out at the ceiling — a bounded "still pending", not a hang', () => {
    runRequestOnly(); // stamps `running` and returns — nothing ever finishes it
    const { code, json } = runCheckWait(200); // short real ceiling keeps this test fast
    expect(code).toBe(2);
    expect(json).toMatchObject({ status: 'timeout', reason: 'wait-timeout', ok: false, settled: false });
    expect(json.lastStatus).toBe('running');
    expect(json.waited.ms).toBeGreaterThanOrEqual(200);
  });

  it('rejects a non-positive/non-numeric --wait as a usage error (exit 3), never a silent 0ms wait', () => {
    for (const bad of ['0', '-5', 'nope']) {
      const { code, json } = runCheckWait(bad);
      expect(code, bad).toBe(3);
      expect(json?.reason, bad).toBe('bad-wait');
    }
  });

  it('rejects a BARE --wait (no =<ms>) as a usage error too — never the silent ~1ms wait Number(true) would give', () => {
    // #4358 — the arg parser turns a bare `--wait` into the boolean `true`, and `Number(true) === 1` would
    // otherwise sail past the finite/positive check and run a real (near-instant) wait instead of flagging the
    // likely typo.
    const r = spawnSync('node', [VERIFY_LANE, 'check', '--wait', '--json'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(3);
    const json = JSON.parse(String(r.stdout).trim().split('\n').pop());
    expect(json.reason).toBe('bad-wait');
  });

  it('clamps an outsized --wait to the safe ceiling (warns on stderr) rather than blocking for the full ask', () => {
    runVerify('true'); // already green — settles on poll 1, so this proves the CLAMP fires, not a long wait
    const { code, json, stderr } = runCheckWait(10_000_000);
    expect(code).toBe(0);
    expect(json.status).toBe('green');
    expect(stderr).toMatch(/clamped/);
  });

  it('the CLI passes the CLAMPED ceiling to waitForVerifySettle, not the raw --wait= it was given', () => {
    // #4358 — the stderr-warning test above proves a warning PRINTS, not that the value actually handed to the
    // wait core is the clamped one. `resolveWaitCeilingMs` is unit-tested in isolation (lane-verify.test.mjs);
    // this pins the WIRING at the one call site that matters, by source inspection — a live 90s-vs-10,000,000ms
    // timing race would prove the same thing far more slowly.
    const src = readFileSync(VERIFY_LANE, 'utf8');
    const waitCallBlock = src.slice(src.indexOf('await waitForVerifySettle({'), src.indexOf('await waitForVerifySettle({') + 300);
    expect(waitCallBlock).toMatch(/\bceilingMs\b/);
    expect(waitCallBlock).not.toMatch(/\brequestedMs\b/);
    // and ceilingMs itself is assigned from the clamp helper, not a bare `Math.min` re-derived at the call site.
    expect(src).toMatch(/const ceilingMs = resolveWaitCeilingMs\(requestedMs\);/);
  });

  it('the DEFAULT posture (no --require-verified flag at all, exactly the brief\'s own example) already requires verification', () => {
    // #4358 — #3321 flipped the bare default to requireVerified:true, so the brief's plain `check --wait=…`
    // example (no flag) needs no `--require-verified` to get a fast, honest `absent` for a forgotten `request` —
    // it is NOT the permissive `untracked`/ok:true path, which needs an EXPLICIT opt-out this example never gives.
    const { code, json } = runCheckWait(500); // no --require-verified, no WE_REQUIRE_VERIFIED env — the bare default
    expect(code).toBe(2);
    expect(json).toMatchObject({ status: 'absent', reason: 'unverified', ok: false, settled: false });
  });

  it('bare `check` (no --wait) is completely unchanged — one fast, non-blocking read', () => {
    runRequestOnly();
    const { code, json } = runCheckWait(null);
    expect(code).toBe(2);
    expect(json.status).toBe('running');
    expect(json.waited).toBeUndefined(); // the non-wait path never adds wait bookkeeping
  });

  /** `request` with a gate that would never actually run (a plain no-op if it did) — a plain in-flight
   *  `running` marker for HEAD that nothing here ever finishes. */
  function runRequestOnly() {
    execFileSync('node', [VERIFY_LANE, 'request', '--gate=true', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
});

describe('verify-lane reset (x4jcqm4) — clearing a stale marker without a lease to protect', () => {
  const leaseFile = () => join(dir, '.git', '.lane-lease');
  function runReset(env = {}) {
    try {
      const out = execFileSync('node', [VERIFY_LANE, 'reset', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
      return { code: 0, json: JSON.parse(out.trim().split('\n').pop()) };
    } catch (e) {
      return { code: e.status ?? null, json: (() => { try { return JSON.parse(String(e.stdout).trim().split('\n').pop()); } catch { return null; } })() };
    }
  }

  it('clears a terminal marker for a foreign sha when the lane holds no lease', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');

    const { code, json } = runReset();

    expect(code).toBe(0);
    expect(json.status).toBe('reset');
    expect(existsSync(marker())).toBe(false);
    // and a fresh verify now starts cleanly instead of refusing as superseded
    const after = runVerify('true');
    expect(after.code).toBe(0);
    expect(after.json.status).toBe('green');
  });

  it('is a no-op, not an error, when there is no marker to clear', () => {
    const { code, json } = runReset();
    expect(code).toBe(0);
    expect(json.status).toBe('noop');
  });

  it('refuses when the lane holds a LIVE lease, leaving the marker intact', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'someone', acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

    const { code, json } = runReset();

    expect(code).toBe(3);
    expect(json?.status).toBe('refused');
    expect(existsSync(marker())).toBe(true);
  });

  it('refuses when the lane holds a LIVE FOREIGN lease (ownerSession set, does not match caller)', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'someone', ownerSession: 'sess-OTHER', acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

    const { code, json } = runReset({ CLAUDE_CODE_SESSION_ID: 'sess-ME' });

    expect(code).toBe(3);
    expect(json?.status).toBe('refused');
    expect(existsSync(marker())).toBe(true);
  });

  it('clears the marker when the lane holds a LIVE lease CONFIRMED as the caller\'s own (#3378)', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'me', ownerSession: 'sess-ME', acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

    const { code, json } = runReset({ CLAUDE_CODE_SESSION_ID: 'sess-ME' });

    expect(code).toBe(0);
    expect(json.status).toBe('reset');
    expect(existsSync(marker())).toBe(false);
    // the lease itself is untouched — reset only clears the verify marker, never the lease
    expect(existsSync(leaseFile())).toBe(true);
  });

  it('clears the marker when the lane holds only a STALE (expired) lease', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'someone', acquiredAt: '2000-01-01T00:00:00.000Z', ttlMinutes: 240 }) + '\n');

    const { code, json } = runReset();

    expect(code).toBe(0);
    expect(json.status).toBe('reset');
    expect(existsSync(marker())).toBe(false);
  });

  // #3378 review rounds 2-4 — a bare ownerSession match is not proof of "mine" in two documented topologies:
  // a dispatcher/worker split (`workerSession`), and sibling lanes that share one `ownerSession` by
  // construction (`workflowLane` / conveyor dispatch). Both must still refuse.
  it('refuses when ownerSession matches the caller but a DIFFERENT session has ADOPTED the lane (dispatcher vs. worker)', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'dispatcher', ownerSession: 'sess-DISPATCHER', workerSession: 'sess-WORKER', acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

    // The DISPATCHER's own session id matches ownerSession, but a different session has declared occupancy.
    const { code, json } = runReset({ CLAUDE_CODE_SESSION_ID: 'sess-DISPATCHER' });

    expect(code).toBe(3);
    expect(json?.status).toBe('refused');
    expect(existsSync(marker())).toBe(true);
  });

  it('clears the marker for the ADOPTING WORKER even though ownerSession belongs to the dispatcher', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'dispatcher', ownerSession: 'sess-DISPATCHER', workerSession: 'sess-WORKER', acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

    const { code, json } = runReset({ CLAUDE_CODE_SESSION_ID: 'sess-WORKER' });

    expect(code).toBe(0);
    expect(json.status).toBe('reset');
    expect(existsSync(marker())).toBe(false);
  });

  it('refuses when ownerSession matches the caller but a SIBLING lane (elsewhere in the pool) shares that ownerSession (CONTESTED)', () => {
    const poolRoot = mkdtempSync(join(tmpdir(), 'verify-lane-pool-'));
    try {
      const siblingLeaseFile = join(poolRoot, 'some-pool', 'lane-9', '.git', LEASE_FILENAME);
      mkdirSync(join(poolRoot, 'some-pool', 'lane-9', '.git'), { recursive: true });
      writeFileSync(siblingLeaseFile, JSON.stringify({ session: 'sibling', ownerSession: 'sess-SHARED', workflowLane: true, acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

      writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
      writeFileSync(leaseFile(), JSON.stringify({ session: 'me', ownerSession: 'sess-SHARED', workflowLane: true, acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

      const { code, json } = runReset({ CLAUDE_CODE_SESSION_ID: 'sess-SHARED', LANE_POOL_ROOT: poolRoot });

      expect(code).toBe(3);
      expect(json?.status).toBe('refused');
      expect(existsSync(marker())).toBe(true);
    } finally {
      rmSync(poolRoot, { recursive: true, force: true });
    }
  });

  it('clears the marker when ownerSession matches and NO sibling lane shares it (uncontested, the ordinary case is unchanged)', () => {
    const poolRoot = mkdtempSync(join(tmpdir(), 'verify-lane-pool-'));
    try {
      writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
      writeFileSync(leaseFile(), JSON.stringify({ session: 'me', ownerSession: 'sess-SOLO', acquiredAt: new Date().toISOString(), ttlMinutes: 240 }) + '\n');

      const { code, json } = runReset({ CLAUDE_CODE_SESSION_ID: 'sess-SOLO', LANE_POOL_ROOT: poolRoot });

      expect(code).toBe(0);
      expect(json.status).toBe('reset');
      expect(existsSync(marker())).toBe(false);
    } finally {
      rmSync(poolRoot, { recursive: true, force: true });
    }
  });
});
