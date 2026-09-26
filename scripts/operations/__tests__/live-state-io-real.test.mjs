/**
 * @file scripts/operations/__tests__/live-state-io-real.test.mjs
 * @description Card xvz55jf — the #2949 fidelity qualifier: real subprocess/disk/OS proof, separate from the
 *   filesystem-free injected-fakes suite in `live-state-io.test.mjs`. Every OTHER read this operation makes
 *   (daemon-status, heavy-queue, the health watch store, the GitHub App status file) already carries its own
 *   fidelity test in its owning module — this file exercises only the reads `live-state-io.mjs` itself adds:
 *   a real `lane-pool.mjs status --json` subprocess (against THIS actual checkout, no fixture needed — it
 *   already is a real WE clone), a real jsonl file on real disk for the drain-history tail, and real
 *   `os.loadavg`/`os.cpus`.
 */
import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readOneLanePool, readDrainLastPass, readMachineLoad } from '../live-state-io.mjs';

/**
 * `lane-pool.mjs` itself refuses to resolve the REAL shared lane-pool root from inside a vitest worker
 * (`guardedPoolRoot`, `../../lib/lane-pool-paths.mjs#guardedPoolRoot`, #3383 — closes a 2026-09-23
 * real-pool-hammering incident) unless `WE_ALLOW_REAL_LANE_POOL_IN_TESTS=1` is set — its own documented
 * escape hatch for "a genuinely-intended live integration test against the real pool". This IS that test:
 * `status` is read-only (no lane is acquired, reset, or removed), and the whole point is proving the real
 * subprocess parses real output — so the escape hatch is the correct call here, passed ONLY on this
 * subprocess's own env, never globally.
 */
const execAllowingRealPool = (program, args, opts = {}) => execFileSync(program, args, { ...opts, env: { ...process.env, WE_ALLOW_REAL_LANE_POOL_IN_TESTS: '1' } });

it('readOneLanePool runs a REAL lane-pool.mjs status --json subprocess against this real checkout', () => {
  const out = readOneLanePool('we', { execFn: execAllowingRealPool });
  expect(out.error).toBeUndefined();
  expect(out.repoKey).toBe('we');
  expect(out.total).toBeGreaterThan(0);
  // `free` (clean, unleased) and `leased` are mutually exclusive by definition and together account for every
  // NOT-dirty-and-unleased-or-leased lane; `dirty` is a THIRD, overlapping axis (a leased lane can also be
  // dirty — real, common, live-observed here: 90 vs 88 total the first time this test was written), so the
  // one invariant that must hold on real data is free + leased <= total, each individually <= total, and none
  // negative — never a strict partition sum, which a hand-fed fixture could get away with asserting but real
  // data does not honour.
  expect(out.free + out.leased).toBeLessThanOrEqual(out.total);
  for (const n of [out.free, out.leased, out.dirty]) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(out.total); }
});

it('readOneLanePool degrades to an error row on a REAL subprocess failure (unknown repo path)', () => {
  const out = readOneLanePool('nowhere', { execFn: execAllowingRealPool, repoPathArg: '/definitely/does/not/exist' });
  expect(out.error).toBeTruthy();
  expect(out.total).toBe(0);
});

it('readDrainLastPass tails a REAL jsonl file on REAL disk', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'live-state-drain-'));
  try {
    const path = join(tmp, 'history.jsonl');
    writeFileSync(path, `${JSON.stringify({ at: '2026-09-26T15:00:00.000Z', exit: 0, considered: 1, merged: 1 })}\n`
      + `${JSON.stringify({ at: '2026-09-26T15:01:00.000Z', exit: 0, considered: 2, merged: 0 })}\n`);
    const out = readDrainLastPass({ path });
    expect(out.lastPass).toEqual({ at: '2026-09-26T15:01:00.000Z', exit: 0, considered: 2, merged: 0 });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

it('readDrainLastPass reports {lastPass: null} for a REAL missing path, no fake fs involved', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'live-state-drain-missing-'));
  try {
    expect(readDrainLastPass({ path: join(tmp, 'no-such-file.jsonl') })).toEqual({ lastPass: null });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

it('readMachineLoad reads REAL os.loadavg()/os.cpus() — finite, positive numbers on this real host', () => {
  const out = readMachineLoad();
  expect(out.loadavg).toHaveLength(3);
  expect(out.loadavg.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
  expect(out.cores).toBeGreaterThan(0);
});
