/**
 * @file sim-clock.test.mjs — epic #3383 part 5. Proves the clock preload against REAL, separately-spawned
 * `node` child processes — the same "exercise the real seam, don't stub it" reasoning `fake-claude.mjs` and
 * `fake-gh.mjs` already use for the CLIs they stand in for. A unit test of `parseDurationMs`/`createSimClock`
 * alone could never prove `NODE_OPTIONS=--import=…` actually reaches a child the way the simulator's daemon
 * hosts depend on it to.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import { createSimClock, parseDurationMs, PRELOAD_PATH } from './sim/clock.mjs';

let scratch = null;
afterEach(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); scratch = null; });

/** Spawn `node -e <code>` with the given env, real stdout captured. `code` must `console.log(JSON.stringify(...))`
 *  its answer so this can parse it back. */
function runNode(code, env) {
  const out = execFileSync(process.execPath, ['-e', code], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 10_000,
  });
  return out.trim();
}

describe('parseDurationMs', () => {
  it('parses the documented units and a bare number', () => {
    expect(parseDurationMs('31m')).toBe(31 * 60_000);
    expect(parseDurationMs('2h')).toBe(2 * 3_600_000);
    expect(parseDurationMs('500ms')).toBe(500);
    expect(parseDurationMs('1d')).toBe(86_400_000);
    expect(parseDurationMs(1234)).toBe(1234);
  });

  it('rejects garbage', () => {
    expect(() => parseDurationMs('soon')).toThrow(/cannot parse duration/);
  });
});

describe('the clock preload, against real spawned children', () => {
  it('a spawned child with the preload sees the offset in both Date.now() and new Date()', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sim-clock-test-'));
    const clock = createSimClock({ file: join(scratch, 'clock.json'), startOffsetMs: 60_000 });

    const out = runNode(
      'console.log(JSON.stringify({ now: Date.now(), iso: new Date().toISOString() }))',
      clock.env,
    );
    const { now, iso } = JSON.parse(out);
    const realNow = Date.now();
    // The child's Date.now() should read ~60s ahead of OUR real now (generous slack for spawn overhead).
    expect(now - realNow).toBeGreaterThan(55_000);
    expect(now - realNow).toBeLessThan(70_000);
    // new Date().toISOString() agrees with Date.now() to within a second.
    expect(Math.abs(new Date(iso).getTime() - now)).toBeLessThan(1_000);
  });

  it('advancing the clock then spawning again shows the jump', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sim-clock-test-'));
    const clock = createSimClock({ file: join(scratch, 'clock.json'), startOffsetMs: 0 });

    const before = Number(runNode('console.log(Date.now())', clock.env));
    clock.advance('2h');
    const after = Number(runNode('console.log(Date.now())', clock.env));

    expect(after - before).toBeGreaterThan(2 * 3_600_000 - 5_000);
    expect(after - before).toBeLessThan(2 * 3_600_000 + 10_000);
  });

  it('Date.parse and new Date(0) are unaffected by the offset', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sim-clock-test-'));
    const clock = createSimClock({ file: join(scratch, 'clock.json'), startOffsetMs: 999 * 24 * 3_600_000 });

    const out = runNode(
      // `NaN` does not survive JSON — report the `isNaN` check itself rather than the raw (NaN → null) value.
      'console.log(JSON.stringify({ parsed: Date.parse("2020-01-01T00:00:00.000Z"), zero: new Date(0).getTime(), undefIsInvalid: Number.isNaN(new Date(undefined).getTime()) }))',
      clock.env,
    );
    const { parsed, zero, undefIsInvalid } = JSON.parse(out);
    expect(parsed).toBe(Date.parse('2020-01-01T00:00:00.000Z'));
    expect(zero).toBe(0);
    expect(undefIsInvalid).toBe(true); // `new Date(undefined)` stays Invalid Date — explicitly NOT simulated
  });

  it('is a no-op when SIM_CLOCK_FILE is unset — the preload does nothing', () => {
    const before = Date.now();
    const out = runNode(
      'console.log(JSON.stringify({ now: Date.now(), hasSimClock: typeof globalThis.__simClock }))',
      { NODE_OPTIONS: `--import=${PRELOAD_PATH}` }, // no SIM_CLOCK_FILE
    );
    const { now, hasSimClock } = JSON.parse(out);
    expect(hasSimClock).toBe('undefined');
    expect(Math.abs(now - before)).toBeLessThan(5_000);
  });

  it('a while(Date.now() < deadline) loop in a child terminates — time keeps flowing under the offset', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sim-clock-test-'));
    const clock = createSimClock({ file: join(scratch, 'clock.json'), startOffsetMs: 3_600_000 });

    // A deadline set relative to the CHILD's own (offset) now, well in the past of the offset clock but a
    // real spin loop nonetheless — this proves the offset clock still advances in real time rather than
    // freezing at `realNow + offsetMs` forever.
    const out = runNode(
      'const deadline = Date.now() + 50; let n = 0; while (Date.now() < deadline) n++; console.log(JSON.stringify({ n, done: true }))',
      clock.env,
    );
    expect(JSON.parse(out).done).toBe(true);
  });
});
