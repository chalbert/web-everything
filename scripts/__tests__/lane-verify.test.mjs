/**
 * @file scripts/__tests__/lane-verify.test.mjs
 * @description Unit proof of the #2833 verification finish-guard core (`scripts/lib/lane-verify.mjs`). The
 *   observed stall: a build subagent backgrounded its suite run, then yielded/terminated mid-run — the lane sat
 *   half-verified but LOOKED complete, so nothing reclaimed it. The gate here makes an unfinished verification
 *   NOT look complete: a HEAD with no recorded green result (or a stranded `running` marker) is REFUSED; a HEAD
 *   whose synchronous run finished green PASSES. The suite runner + marker IO are the impure boundary
 *   (`scripts/verify-lane.mjs`) and pr-land's finish-guard calls `verifyGateDecision` here.
 */
import { describe, it, expect } from 'vitest';
import {
  VERIFY_FILENAME,
  DEFAULT_VERIFY_TTL_MINUTES,
  verifyStartBody,
  verifyFinishBody,
  isVerifyAbandoned,
  verifyGateDecision,
} from '../lib/lane-verify.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const T0 = Date.parse('2026-08-02T00:00:00.000Z');
const min = (n) => n * 60_000;

describe('marker lifecycle bodies (running → green/red)', () => {
  it('verifyStartBody stamps a running marker keyed to the sha, finish fields null', () => {
    const r = verifyStartBody({ sha: SHA, suites: 'npm run test:unit', startedAt: '2026-08-02T00:00:00.000Z' });
    expect(r).toMatchObject({ sha: SHA, status: 'running', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: null, suites: 'npm run test:unit', exitCode: null });
  });
  it('verifyFinishBody(exit 0) → green, preserving sha/startedAt/suites', () => {
    const start = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: '2026-08-02T00:00:00.000Z' });
    const done = verifyFinishBody(start, { finishedAt: '2026-08-02T00:05:00.000Z', exitCode: 0 });
    expect(done).toMatchObject({ sha: SHA, status: 'green', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: '2026-08-02T00:05:00.000Z', suites: 'gate', exitCode: 0 });
  });
  it('verifyFinishBody(non-zero) → red, recording the exit code', () => {
    const done = verifyFinishBody(verifyStartBody({ sha: SHA, suites: 'gate', startedAt: 't' }), { finishedAt: 'u', exitCode: 2 });
    expect(done.status).toBe('red');
    expect(done.exitCode).toBe(2);
  });
});

describe('isVerifyAbandoned — a running marker that outlived its TTL is abandoned', () => {
  const running = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: new Date(T0).toISOString() });
  it('a fresh running marker is NOT (yet) abandoned', () => {
    expect(isVerifyAbandoned(running, T0 + min(5))).toBe(false);
  });
  it('a running marker past the TTL IS abandoned', () => {
    expect(isVerifyAbandoned(running, T0 + min(DEFAULT_VERIFY_TTL_MINUTES + 1))).toBe(true);
  });
  it('a green/red marker never abandons by time (sha-identity is its freshness, not the clock)', () => {
    const green = verifyFinishBody(running, { finishedAt: new Date(T0).toISOString(), exitCode: 0 });
    expect(isVerifyAbandoned(green, T0 + min(9999))).toBe(false);
  });
  it('a malformed / dateless running marker reads as abandoned (fail toward "not fresh")', () => {
    expect(isVerifyAbandoned({ status: 'running', startedAt: 'not-a-date' }, T0)).toBe(true);
    expect(isVerifyAbandoned(null, T0)).toBe(true);
  });
});

describe('verifyGateDecision — the finish-guard the delivery path applies (#2833)', () => {
  const green = verifyFinishBody(verifyStartBody({ sha: SHA, suites: 'gate', startedAt: new Date(T0).toISOString() }), { finishedAt: new Date(T0).toISOString(), exitCode: 0 });
  const running = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: new Date(T0).toISOString() });
  const red = verifyFinishBody(running, { finishedAt: new Date(T0).toISOString(), exitCode: 2 });

  it('a completed green run for THIS head → ok (delivery proceeds)', () => {
    const v = verifyGateDecision({ record: green, headSha: SHA, nowMs: T0 + min(10) });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('verified');
  });

  it('THE STALL: a running (unfinished) marker for THIS head → REFUSED, even without --require-verified', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0 + min(1), requireVerified: false });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-unfinished');
    expect(v.detail).toMatch(/in-flight/);
  });

  it('an ABANDONED running marker (past TTL) → refused, message says abandoned', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0 + min(DEFAULT_VERIFY_TTL_MINUTES + 5) });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-unfinished');
    expect(v.detail).toMatch(/abandoned/);
  });

  it('a recorded RED result for THIS head → refused (fix + re-verify)', () => {
    const v = verifyGateDecision({ record: red, headSha: SHA, nowMs: T0 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-red');
  });

  it('NO marker + --require-verified → refused as unverified (the solo/conveyor build gate)', () => {
    const v = verifyGateDecision({ record: null, headSha: SHA, requireVerified: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('unverified');
  });

  it('NO marker without --require-verified → ok (CI-gated drain / workflow paths untouched)', () => {
    const v = verifyGateDecision({ record: null, headSha: SHA, requireVerified: false });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('untracked');
  });

  it('a green marker for a DIFFERENT commit does NOT satisfy the gate for this HEAD (stale sha)', () => {
    const stale = { ...green, sha: OTHER };
    expect(verifyGateDecision({ record: stale, headSha: SHA, requireVerified: true }).ok).toBe(false);
    // ...and without require-verified it reads as untracked-for-this-head (allow), not a false green
    const v = verifyGateDecision({ record: stale, headSha: SHA, requireVerified: false });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('untracked');
  });

  it('WE_LAND_UNVERIFIED break-glass overrides every refusal (even an unfinished run)', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0, breakGlass: true });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('break-glass');
  });
});

describe('the marker filename is the never-tracked in-.git convention', () => {
  it('VERIFY_FILENAME matches the .lane-lease sibling convention', () => {
    expect(VERIFY_FILENAME).toBe('.lane-verify');
  });
});
