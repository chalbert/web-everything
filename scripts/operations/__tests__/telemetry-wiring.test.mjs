/**
 * @file scripts/operations/__tests__/telemetry-wiring.test.mjs
 * @description INTEGRATION — proves the telemetry is actually WIRED, not merely well-designed (#3383).
 *
 * `telemetry.test.mjs` tests the recorder against itself. These tests drive the REAL shared helpers and the
 * REAL `dispatchReviewMechanical` entry point with a stubbed `run`, and assert on the spans that come out the
 * other end. The distinction matters: a schema nobody calls records nothing, and the survey that motivated
 * this work found exactly that failure already in-tree — `readiness/conveyor-instrument.mjs` has had a
 * perfectly good `mark-dispatch` capture verb since #2680 with no call site anywhere, so its dispatch sidecar
 * has never existed on disk. These tests are what stops this module going the same way.
 *
 * The second thing they pin is the NEVER-BREAK-A-DELIVERY contract at the integration level: with telemetry
 * hard-disabled, and with a store that throws on every write, the wrapped functions must return byte-identical
 * results and raise nothing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { acquireLane, runVerifyOperation } from '../minimal-context-provider.mjs';
import { dispatchReviewMechanical, BLOCKED_ON_INFRA } from '../review-dispatch-wrapper.mjs';
import { classifyPrepareResult as classifyScopeResult } from '../prepare-scope-wrapper.mjs';
import { classifyPrepareResult as classifyDecisionResult } from '../prepare-decision-wrapper.mjs';
import {
  createMemoryTelemetryStore, createTelemetryRecorder, setActiveRecorder, activeRecorder,
} from '../telemetry-store.mjs';

function clock(startIso = '2026-09-12T10:00:00.000Z', stepMs = 1000) {
  let t = Date.parse(startIso);
  return () => { const d = new Date(t); t += stepMs; return d; };
}

function installed(opts = {}) {
  const store = createMemoryTelemetryStore();
  const rec = createTelemetryRecorder({ store, enabled: true, now: clock(), resource: {}, ...opts });
  setActiveRecorder(rec);
  return { store, rec, spans: () => store.readAll().events.filter((e) => e.event === 'span.end') };
}

let restore = null;
beforeEach(() => { restore = setActiveRecorder(null); });
afterEach(() => { if (restore) restore(); setActiveRecorder(null); });

// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe('acquireLane — the 6/6 seam: one edit, `lane.acquire` for every dispatch kind', () => {
  it('emits a lane.acquire span on the UNNUMBERED (take-any-free-lane) shape', () => {
    const { spans } = installed({ kind: 'review' });
    const path = acquireLane(
      { sessionSlug: 'review-2131', claudeSessionId: 'sid', purpose: 'review-loop', waitMs: 30000 },
      { run: () => '/lanes/lane-19\n' },
    );
    expect(path).toBe('/lanes/lane-19');
    const s = spans().find((e) => e.name === 'lane.acquire');
    expect(s.status).toBe('ok');
    expect(s.attributes).toMatchObject({ purpose: 'review-loop', shape: 'unnumbered', waitMs: 30000, outcome: 'acquired', lane: 'lane-19' });
    expect(s.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits a lane.acquire span on the NUMBERED (tick-planned) shape, tagged as such', () => {
    const { spans } = installed({ kind: 'build' });
    acquireLane(
      { lane: 7, sessionSlug: 'conveyor-3441', scope: 'we:x', item: 3441, claudeSessionId: 'sid' },
      { run: () => '' },
    );
    const s = spans().find((e) => e.name === 'lane.acquire');
    expect(s.attributes).toMatchObject({ shape: 'numbered', lane: '7', item: '3441', purpose: 'conveyor-delivery', outcome: 'acquired' });
  });

  it('THE SATURATION SIGNAL: an empty acquire is recorded as `no-free-lane`, not silently discarded', () => {
    // This is the fact the wrappers throw away today — the pool was full, the bounded wait expired, and all
    // that survives downstream is the string 'blocked-on-infra (no free lane)'. Now it is a classified,
    // countable error span with a reason, so the denial shows up in the error breakdown as CAPACITY rather
    // than as an unexplained failure.
    const { spans } = installed({ kind: 'review' });
    const path = acquireLane(
      { sessionSlug: 'review-2131', claudeSessionId: 'sid', purpose: 'review-loop', waitMs: 30000 },
      { run: () => '   \n' },
    );
    expect(path).toBe(''); // behaviour unchanged
    const s = spans().find((e) => e.name === 'lane.acquire');
    expect(s.status).toBe('error');
    expect(s.attributes.outcome).toBe('no-free-lane');
  });

  it('a THROWN acquire is recorded as an error span AND the original error still propagates', () => {
    const { spans } = installed({ kind: 'fix' });
    const boom = new Error('lane-pool refused');
    expect(() => acquireLane(
      { sessionSlug: 'fix-2131', claudeSessionId: 'sid' },
      { run: () => { throw boom; } },
    )).toThrow(boom);
    const s = spans().find((e) => e.name === 'lane.acquire');
    expect(s.status).toBe('error');
    expect(s.attributes.outcome).toBe('acquire-threw');
    expect(s.statusMessage).toBe('lane-pool refused');
  });

  it('with NO recorder installed, behaviour is exactly what it was before instrumentation', () => {
    setActiveRecorder(null);
    expect(acquireLane({ sessionSlug: 's', claudeSessionId: 'sid' }, { run: () => '/lanes/lane-3\n' })).toBe('/lanes/lane-3');
    expect(() => acquireLane({ sessionSlug: 's', claudeSessionId: 'sid' }, { run: () => { throw new Error('x'); } })).toThrow('x');
  });

  it('a store that THROWS on every write cannot break the acquire', () => {
    const exploding = { append() { throw new Error('disk on fire'); }, days: () => [], readDay: () => ({ events: [], corrupt: 0 }), readAll: () => ({ events: [], corrupt: 0 }) };
    setActiveRecorder(createTelemetryRecorder({ store: exploding, enabled: true, now: clock() }));
    expect(acquireLane({ sessionSlug: 's', claudeSessionId: 'sid' }, { run: () => '/lanes/lane-3\n' })).toBe('/lanes/lane-3');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe('runVerifyOperation — `verify.gate`, and the three-valued verdict preserved end to end', () => {
  const runReturning = (verdict) => () => JSON.stringify({ verdict });

  it('a green gate is an `ok` span, and the return value is unchanged', () => {
    const { spans } = installed({ kind: 'build' });
    const out = runVerifyOperation('/lanes/lane-19', { run: runReturning({ ok: true }) });
    expect(out).toEqual({ outcome: 'pass', detail: null, verdict: { ok: true } });
    const s = spans().find((e) => e.name === 'verify.gate');
    expect(s.status).toBe('ok');
    expect(s.attributes).toMatchObject({ outcome: 'pass', lane: 'lane-19' });
  });

  it('a RED gate is an `error` span carrying the failing count', () => {
    const { spans } = installed({ kind: 'build' });
    const out = runVerifyOperation('/lanes/lane-19', { run: runReturning({ ok: false, failed: 3 }) });
    expect(out.outcome).toBe('fail');
    const s = spans().find((e) => e.name === 'verify.gate');
    expect(s.status).toBe('error');
    expect(s.attributes).toMatchObject({ outcome: 'gate-red', failed: 3 });
  });

  it('an UNRUN gate closes `unset`, NOT `error` — a stale marker is an environment fact, not a red diff', () => {
    // The three-valued discipline `runVerifyOperation` already had, carried faithfully into the span: folding
    // `unrun` into the error rate would make the gate look unreliable every time a lane was recycled.
    const { spans } = installed({ kind: 'build' });
    const out = runVerifyOperation('/lanes/lane-19', { run: runReturning({ ok: false, failed: 0, unrun: 2 }) });
    expect(out.outcome).toBe('unrun');
    expect(spans().find((e) => e.name === 'verify.gate').status).toBe('unset');
  });

  it('a CRASHED gate (the CLI itself threw) stays `unrun`, span and return value alike', () => {
    const { spans } = installed({ kind: 'build' });
    const out = runVerifyOperation('/lanes/lane-19', { run: () => { const e = new Error('boom'); e.stdout = 'partial'; throw e; } });
    expect(out.outcome).toBe('unrun');
    expect(out.detail).toBe('partial');
    expect(spans().find((e) => e.name === 'verify.gate').status).toBe('unset');
  });

  it('unparseable JSON stays `unrun` rather than being guessed at', () => {
    installed({ kind: 'build' });
    expect(runVerifyOperation('/l', { run: () => 'not json' }).outcome).toBe('unrun');
  });

  it('carries the attempt, so a RETRIED gate is distinguishable from a first pass', () => {
    const { spans } = installed({ kind: 'build' });
    runVerifyOperation('/lanes/lane-19', { run: runReturning({ ok: false, failed: 1 }), attempt: 1 });
    runVerifyOperation('/lanes/lane-19', { run: runReturning({ ok: true }), attempt: 2 });
    expect(spans().filter((e) => e.name === 'verify.gate').map((e) => e.attempt)).toEqual([1, 2]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe('dispatchReviewMechanical — a REAL wrapper end to end, spans and behaviour together', () => {
  /** A stubbed `run` that answers each shelled CLI by inspecting its argv — the same technique the wrapper's
   *  own test file uses, so these tests exercise the identical code path production does. */
  function stubRun({ acquire = '/lanes/lane-19\n', loop = null, loopThrows = null } = {}) {
    return (cmd, args) => {
      const argv = args.join(' ');
      if (argv.includes('lane-pool.mjs')) return acquire;
      if (argv.includes('review-loop-cli.mjs')) {
        if (loopThrows) throw loopThrows;
        return JSON.stringify(loop);
      }
      return '';
    };
  }

  it('emits a root `dispatch` span plus nested `lane.acquire` and `review.loop`, all in ONE trace', () => {
    const { store, spans } = installed({ kind: 'review', pr: 2131 });
    const out = dispatchReviewMechanical(
      { pr: 2131, repo: 'chalbert/web-everything' },
      { run: stubRun({ loop: { stopped: 'complete', verdict: { verdict: 'accept', loop: { outcome: 'clean' } }, runId: 'r1' } }), newActorId: () => 'actor-1' },
    );
    expect(out.classified.outcome).toBe('auto-cleared');

    const byName = Object.fromEntries(spans().map((s) => [s.name, s]));
    expect(Object.keys(byName).sort()).toEqual(['dispatch', 'lane.acquire', 'review.loop']);

    // ONE trace, keyed on the PR — the whole point of a correlation id.
    const traces = new Set(store.readAll().events.map((e) => e.traceId));
    expect(traces.size).toBe(1);
    expect([...traces][0]).toBe('p2131');

    // A real tree: both phases parent to the root.
    expect(byName['lane.acquire'].parentSpanId).toBe(byName.dispatch.spanId);
    expect(byName['review.loop'].parentSpanId).toBe(byName.dispatch.spanId);

    expect(byName.dispatch.status).toBe('ok');
    expect(byName.dispatch.attributes.outcome).toBe('auto-cleared');
    expect(byName['review.loop'].attributes).toMatchObject({ outcome: 'auto-cleared', verdict: 'accept', runId: 'r1' });
  });

  it('a BOUNCED review closes `ok` — a real verdict, not a failure of the system', () => {
    const { spans } = installed({ kind: 'review', pr: 2131 });
    const out = dispatchReviewMechanical(
      { pr: 2131, repo: 'a/b' },
      { run: stubRun({ loop: { stopped: 'complete', verdict: { verdict: 'changes', loop: { outcome: 'bounced' } } } }), newActorId: () => 'a' },
    );
    expect(out.classified.outcome).toBe('bounced');
    const root = spans().find((s) => s.name === 'dispatch');
    expect(root.status).toBe('ok');
    expect(root.attributes.outcome).toBe('bounced');
  });

  it('`blocked-on-infra` — the one outcome meaning no review happened — is the one that closes `error`', () => {
    const { spans } = installed({ kind: 'review', pr: 2131 });
    const out = dispatchReviewMechanical(
      { pr: 2131, repo: 'a/b' },
      { run: stubRun({ acquire: '  \n' }), newActorId: () => 'a' }, // pool full
    );
    expect(out.classified.outcome).toBe(BLOCKED_ON_INFRA);
    const root = spans().find((s) => s.name === 'dispatch');
    expect(root.status).toBe('error');
    // And the CAUSE is visible one level down, on the acquire span — a count plus a diagnosis.
    expect(spans().find((s) => s.name === 'lane.acquire').attributes.outcome).toBe('no-free-lane');
  });

  it('a review-loop crash closes both the loop span and the root as errors', () => {
    const { spans } = installed({ kind: 'review', pr: 2131 });
    const out = dispatchReviewMechanical(
      { pr: 2131, repo: 'a/b' },
      { run: stubRun({ loopThrows: new Error('review-loop-cli exploded') }), newActorId: () => 'a' },
    );
    expect(out.classified.outcome).toBe(BLOCKED_ON_INFRA);
    expect(spans().find((s) => s.name === 'review.loop').status).toBe('error');
    expect(spans().find((s) => s.name === 'dispatch').status).toBe('error');
  });

  it('a thrown acquire closes the root and STILL rethrows — the release contract is untouched', () => {
    const { spans } = installed({ kind: 'review', pr: 2131 });
    expect(() => dispatchReviewMechanical(
      { pr: 2131, repo: 'a/b' },
      {
        run: (cmd, args) => { if (args.join(' ').includes('lane-pool.mjs acquire')) throw new Error('pool crashed'); return ''; },
        newActorId: () => 'a',
      },
    )).toThrow('pool crashed');
    expect(spans().find((s) => s.name === 'dispatch').status).toBe('error');
  });

  it('the root span SELF-UNINSTALLS the ambient recorder, so the next dispatch cannot inherit this trace', () => {
    const { rec } = installed({ kind: 'review', pr: 2131 });
    dispatchReviewMechanical(
      { pr: 2131, repo: 'a/b' },
      { run: stubRun({ loop: { stopped: 'complete', verdict: { verdict: 'accept' } } }), newActorId: () => 'a' },
    );
    expect(activeRecorder()).not.toBe(rec);
    expect(activeRecorder().enabled).toBe(false);
  });

  it('WITH TELEMETRY DISABLED the wrapper returns a byte-identical result', () => {
    const io = { run: stubRun({ loop: { stopped: 'complete', verdict: { verdict: 'accept', loop: { outcome: 'clean' } }, runId: 'r1' } }), newActorId: () => 'a' };
    installed({ kind: 'review', pr: 2131 });
    const withTel = dispatchReviewMechanical({ pr: 2131, repo: 'a/b' }, io);
    setActiveRecorder(null);
    const prior = process.env.WE_TELEMETRY;
    process.env.WE_TELEMETRY = '0';
    try {
      const without = dispatchReviewMechanical({ pr: 2131, repo: 'a/b' }, io);
      expect(without).toEqual(withTel);
    } finally {
      if (prior === undefined) delete process.env.WE_TELEMETRY; else process.env.WE_TELEMETRY = prior;
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe('the prepare wrappers` result→outcome mapping', () => {
  // These two have no completion record, so their telemetry envelope reads the outcome off the `result`
  // string. That coupling is pinned here rather than left to be discovered from a recorded span.
  it('maps prepare-scope`s four result shapes', () => {
    expect(classifyScopeResult('could-not-predict (no scope)')).toBe('could-not-predict');
    expect(classifyScopeResult('gate-red')).toBe('gate-red');
    expect(classifyScopeResult('gate-blocked (agent says blocked)')).toBe('gate-blocked');
    expect(classifyScopeResult('scope → PR #2131 (ready-to-merge)')).toBe('pr-opened');
  });

  it('maps prepare-decision`s four result shapes', () => {
    expect(classifyDecisionResult('could-not-prepare (no forks)')).toBe('could-not-prepare');
    expect(classifyDecisionResult('gate-red')).toBe('gate-red');
    expect(classifyDecisionResult('gate-blocked (x)')).toBe('gate-blocked');
    expect(classifyDecisionResult('PR #2131 (review:pending)')).toBe('pr-opened');
  });

  it('returns null on an unrecognised result, so it closes `unset` rather than inflating the success rate', () => {
    expect(classifyScopeResult('something nobody anticipated')).toBeNull();
    expect(classifyDecisionResult(undefined)).toBeNull();
    expect(classifyDecisionResult(null)).toBeNull();
  });
});
