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
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

  it('the START write refuses to overwrite a terminal GREEN for a FOREIGN sha (#2833 finding 4)', () => {
    // Before this run even begins, the marker on disk holds a terminal GREEN for a DIFFERENT sha Y (a sibling
    // run's finished result). Starting a fresh verification for THIS head must NOT stamp a `running` marker over
    // it — that would destroy the sibling's recorded green before any finish-write CAS could protect it. The
    // start write applies the same sha compare-and-set: it refuses, writes nothing, and leaves green-Y intact.
    const greenY = JSON.stringify({ sha: OTHER_SHA, status: 'green', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: '2026-08-02T00:01:00.000Z', suites: 'gate', exitCode: 0 });
    writeFileSync(marker(), greenY + '\n');

    const { code, json } = runVerify('true'); // the suites would pass, but the run must never reach them

    expect(code).toBe(3);
    expect(json?.status).toBe('superseded');
    // The marker on disk is STILL the terminal green for Y — never clobbered by a running marker for THIS head.
    const onDisk = JSON.parse(readFileSync(marker(), 'utf8'));
    expect(onDisk.sha).toBe(OTHER_SHA);
    expect(onDisk.status).toBe('green');
  });
});

describe('verify-lane reset (x4jcqm4) — clearing a stale marker without a lease to protect', () => {
  const leaseFile = () => join(dir, '.git', '.lane-lease');
  function runReset() {
    try {
      const out = execFileSync('node', [VERIFY_LANE, 'reset', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

  it('clears the marker when the lane holds only a STALE (expired) lease', () => {
    writeFileSync(marker(), JSON.stringify({ sha: OTHER_SHA, status: 'red', startedAt: 'x', finishedAt: 'y', suites: 'gate', exitCode: 1 }) + '\n');
    writeFileSync(leaseFile(), JSON.stringify({ session: 'someone', acquiredAt: '2000-01-01T00:00:00.000Z', ttlMinutes: 240 }) + '\n');

    const { code, json } = runReset();

    expect(code).toBe(0);
    expect(json.status).toBe('reset');
    expect(existsSync(marker())).toBe(false);
  });
});
