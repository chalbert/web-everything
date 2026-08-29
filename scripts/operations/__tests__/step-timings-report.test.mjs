/**
 * @file step-timings-report.test.mjs — the reader `stepTimings` needed to count as done (#3368, citing #19).
 */

import { describe, it, expect } from 'vitest';

import { aggregateStepTimings, renderStepTimingsReport } from '../step-timings-report.mjs';

function runWith(stepTimings) {
  return { id: 'r', op: 'x', stepTimings };
}

describe('aggregateStepTimings', () => {
  it('sums durationMs across runs, grouped by step name', () => {
    const runs = [
      runWith([{ step: 'diff', stepIndex: 0, startedAt: 'a', finishedAt: 'b', durationMs: 1000 }]),
      runWith([{ step: 'diff', stepIndex: 0, startedAt: 'a', finishedAt: 'b', durationMs: 3000 }]),
      runWith([{ step: 'verify', stepIndex: 1, startedAt: 'a', finishedAt: 'b', durationMs: 500 }]),
    ];
    expect(aggregateStepTimings(runs)).toEqual([
      { step: 'diff', count: 2, totalMs: 4000 },
      { step: 'verify', count: 1, totalMs: 500 },
    ]);
  });

  it('sorts by totalMs descending — the dominant step first', () => {
    const runs = [
      runWith([{ step: 'small', stepIndex: 0, startedAt: 'a', finishedAt: 'b', durationMs: 100 }]),
      runWith([{ step: 'big', stepIndex: 0, startedAt: 'a', finishedAt: 'b', durationMs: 9000 }]),
    ];
    expect(aggregateStepTimings(runs).map((r) => r.step)).toEqual(['big', 'small']);
  });

  // AN UNFINISHED ROW ADDS NOTHING — the wall-clock it will eventually cost is not yet known, so counting it
  // as zero would misreport a slow step as fast because it happened to still be open when this ran.
  it('ignores a row with no durationMs — an unfinished (halted or in-flight) step', () => {
    const runs = [runWith([{ step: 'humanOk', stepIndex: 2, startedAt: 'a' }])];
    expect(aggregateStepTimings(runs)).toEqual([]);
  });

  it('tolerates a run with no stepTimings at all — absent, not malformed', () => {
    expect(aggregateStepTimings([{ id: 'r', op: 'x' }])).toEqual([]);
  });

  it('tolerates an empty or missing run list', () => {
    expect(aggregateStepTimings([])).toEqual([]);
    expect(aggregateStepTimings(undefined)).toEqual([]);
  });
});

describe('renderStepTimingsReport', () => {
  it('says plainly when nothing has finished a step yet', () => {
    expect(renderStepTimingsReport([])).toEqual([expect.stringMatching(/no finished step yet/)]);
  });

  it('prints the grand total, then one line per step with count and average', () => {
    const lines = renderStepTimingsReport([
      { step: 'verify-lane', count: 5, totalMs: 3_600_000 },
      { step: 'agent', count: 25, totalMs: 900_000 },
    ]);
    expect(lines[0]).toMatch(/4500\.0s wall-clock over 2 distinct step name/);
    expect(lines[1]).toMatch(/verify-lane: 3600\.0s over 5 run\(s\) — avg 720\.0s/);
    expect(lines[2]).toMatch(/agent: 900\.0s over 25 run\(s\) — avg 36\.0s/);
  });
});
