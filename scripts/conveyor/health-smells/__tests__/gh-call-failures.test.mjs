/**
 * @file scripts/conveyor/health-smells/__tests__/gh-call-failures.test.mjs
 * @description The PURE `evaluate()` of the `gh-call-failures` smell over real-shaped gh-throttle `calls.jsonl`
 *   entries, reproducing the 2026-09-27 ~04:00-04:20Z landing freeze (a rate-limit storm: most `pr list` calls
 *   failing, `retry_exhausted` lines piling up) and the throttle's own fail-open record.
 */
import { describe, it, expect } from 'vitest';
import ghCallFailures, { summarizeGhCalls } from '../gh-call-failures.mjs';

const NOW = Date.parse('2026-09-27T04:18:00Z');
const at = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString();

function healthy() {
  const out = [];
  for (let i = 0; i < 60; i += 1) out.push({ ts: at(i % 14), op: 'pr view', attempt: 1, points: 1, outcome: 'call', ok: i % 12 !== 0 });
  return out;
}

function incident() {
  const out = [];
  for (let i = 0; i < 120; i += 1) out.push({ ts: at(i % 14), op: 'pr list', attempt: 1 + (i % 5), points: 1, outcome: 'call', ok: false });
  for (let i = 0; i < 60; i += 1) out.push({ ts: at(i % 14), op: 'pr view', attempt: 1, points: 1, outcome: 'call', ok: true });
  for (let i = 0; i < 20; i += 1) out.push({ ts: at(i % 14), op: 'pr list', attempt: 5, points: 1, outcome: 'retry_exhausted' });
  return out;
}

describe('gh-call-failures', () => {
  it('stays quiet on normal traffic (a few ordinary failures)', () => {
    const [r] = ghCallFailures.evaluate({ ghCalls: healthy() }, { now: NOW });
    expect(r.breach).toBe(false);
  });

  it('breaches on the incident shape and names the failing op', () => {
    const [r] = ghCallFailures.evaluate({ ghCalls: incident() }, { now: NOW });
    expect(r.breach).toBe(true);
    expect(r.measure.rateLimitExhausted).toBe(20);
    expect(r.summary).toMatch(/pr list×120/);
    expect(r.recommendation).toMatch(/rate-limiting/);
  });

  it('breaches on a single throttle fail-open (the throttle itself broke)', () => {
    const ghCalls = [...healthy(), { ts: at(1), op: 'pr list', outcome: 'fail_open', stage: 'lock-root setup', reason: 'EACCES' }];
    const [r] = ghCallFailures.evaluate({ ghCalls }, { now: NOW });
    expect(r.breach).toBe(true);
    expect(r.recommendation).toMatch(/lock-root setup/);
  });

  it('ignores entries outside the 15-minute window', () => {
    const old = incident().map((e) => ({ ...e, ts: new Date(Date.parse(e.ts) - 60 * 60_000).toISOString() }));
    expect(summarizeGhCalls(old, { now: NOW })).toMatchObject({ calls: 0, exhausted: 0 });
    expect(ghCallFailures.evaluate({ ghCalls: old }, { now: NOW })[0].breach).toBe(false);
  });
});
