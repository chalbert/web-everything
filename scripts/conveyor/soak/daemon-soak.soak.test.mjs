/**
 * @file daemon-soak.soak.test.mjs — #4075 (card x0zg44l). THE LONG SOAK: 25 rounds × {review, fix-dispatch} = 50
 * real daemon ticks, origin/main moving every 4 rounds, the default PR fleet, sessions that post verdicts, write
 * state, push fixes, crash, hang and leave junk. Every invariant in `invariants.mjs` is checked after every tick
 * and printed as one report line; any violation fails the test with the full list.
 */

import { expect, it } from 'vitest';
import { runLongSoak } from './run.mjs';

it('50 real daemon ticks: every invariant holds after every tick', async () => {
  const report = await runLongSoak({ rounds: 25, seed: 1, mainEvery: 4 });
  expect(report.ticks.length).toBeGreaterThanOrEqual(50);
  expect(report.violations.map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`)).toEqual([]);
});
