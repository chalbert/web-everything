/**
 * @file scripts/readiness/__tests__/scope-lease-live.test.mjs
 * @description Unit proof of the LIVE scope picture observer (WE epic #2560, slice 3 — pure, read-only). Pins:
 *   the lease-input shape, per-lease breach + breachOutcome, pairwise overlap detection + policy classification,
 *   the effective-scope (predicted ∪ observed) design call, the candidateLaunch affordance, policy resolution
 *   (partial/null accepted), and that the observer is a faithful COMPOSITION of slices 1 & 2 (same results as
 *   calling breachOf / breachOutcome / overlapAtLaunch directly).
 */
import { describe, it, expect } from 'vitest';
import { liveScopePicture, candidateLaunch, effectiveScope } from '../scope-lease-live.mjs';
import { breachOf, breachOutcome, overlapAtLaunch } from '../scope-lease.mjs';
import { resolveScopePolicy, DEFAULT_SCOPE_POLICY } from '../scope-policy-config.mjs';

// A tiny lease factory for the fixtures.
const lease = (lane, predictedScope, observedScope, extra = {}) =>
  ({ lane, session: `sess-${lane}`, predictedScope, observedScope, ...extra });

describe('effectiveScope — predicted ∪ observed, normalized', () => {
  it('unions and dedupes predicted + observed', () => {
    expect(effectiveScope(lease('L1', ['we:src/a'], ['we:src/a/x.ts', 'we:src/b/y.ts'])).sort())
      .toEqual(['we:src/a', 'we:src/a/x.ts', 'we:src/b/y.ts'].sort());
  });
  it('tolerates missing / non-array fields', () => {
    expect(effectiveScope({ lane: 'L' })).toEqual([]);
    expect(effectiveScope(null)).toEqual([]);
    expect(effectiveScope(undefined)).toEqual([]);
  });
});

describe('liveScopePicture — per-lease breach + breachOutcome', () => {
  it('a clean lease (observed ⊆ predicted) has no breach and action continue', () => {
    const pic = liveScopePicture({ leases: [lease('L1', ['we:src/a'], ['we:src/a/x.ts'])] });
    const s = pic.leases[0];
    expect(s.clean).toBe(true);
    expect(s.breach).toEqual([]);
    expect(s.outcome.action).toBe('continue');
    expect(pic.breachedLanes).toEqual([]);
  });

  it('a breaching lease reports the out-of-scope files + the policy outcome', () => {
    // observed touches we:src/b/y.ts which no predicted entry covers → breach.
    const l = lease('L1', ['we:src/a'], ['we:src/a/x.ts', 'we:src/b/y.ts']);
    const pic = liveScopePicture({ leases: [l] });
    const s = pic.leases[0];
    expect(s.clean).toBe(false);
    expect(s.breach).toEqual(['we:src/b/y.ts']);
    expect(pic.breachedLanes).toEqual(['L1']);
    // default policy (pause, retryBound 1), default attempt 1 ⇒ retry-in-place (A4 default transition).
    expect(s.outcome.action).toBe('retry-in-place');
  });

  it('echoes lane + session through unchanged', () => {
    const pic = liveScopePicture({ leases: [lease('L7', ['we:src/a'], [])] });
    expect(pic.leases[0].lane).toBe('L7');
    expect(pic.leases[0].session).toBe('sess-L7');
  });

  it('breachAttempt is passed through to breachOutcome (escalation is observable)', () => {
    const l = lease('L1', ['we:src/a'], ['we:src/b/y.ts'], { breachAttempt: 3 });
    const pic = liveScopePicture({ leases: [l], policy: { breachMidBuild: 'park', retryBound: 1 } });
    const s = pic.leases[0];
    // attempt 3 > retryBound 1 ⇒ escalated; park ⇒ amber you-card with the route menu.
    expect(s.outcome.action).toBe('park');
    expect(s.outcome.escalated).toBe(true);
    expect(s.outcome.attempt).toBe(3);
    expect(s.outcome.routes.length).toBeGreaterThan(0);
  });

  it('default breachAttempt is 1 when absent or invalid', () => {
    const withBad = liveScopePicture({ leases: [lease('L1', ['we:src/a'], ['we:src/b/y.ts'], { breachAttempt: 0 })] });
    expect(withBad.leases[0].outcome.attempt).toBe(1);
    const withNone = liveScopePicture({ leases: [lease('L1', ['we:src/a'], ['we:src/b/y.ts'])] });
    expect(withNone.leases[0].outcome.attempt).toBe(1);
  });
});

describe('liveScopePicture — matches slice-1 primitives exactly (faithful composition)', () => {
  it('per-lease breach == breachOf(predicted, observed)', () => {
    const l = lease('L1', ['we:src/a'], ['we:src/a/x.ts', 'we:src/b/y.ts']);
    const pic = liveScopePicture({ leases: [l] });
    expect(pic.leases[0].breach).toEqual(breachOf(l.predictedScope, l.observedScope));
  });
  it('per-lease outcome == breachOutcome(breach, policy, {attempt, retryBound})', () => {
    const l = lease('L1', ['we:src/a'], ['we:src/b/y.ts'], { breachAttempt: 2 });
    const policy = resolveScopePolicy({ breachMidBuild: 'pause', retryBound: 1 });
    const pic = liveScopePicture({ leases: [l], policy });
    const direct = breachOutcome(breachOf(l.predictedScope, l.observedScope), 'pause', { attempt: 2, retryBound: 1 });
    expect(pic.leases[0].outcome).toEqual(direct);
  });
});

describe('liveScopePicture — pairwise overlaps classified by the overlap policy', () => {
  it('no overlap ⇒ empty overlaps, board clean', () => {
    const pic = liveScopePicture({
      leases: [lease('L1', ['we:src/a'], ['we:src/a/x.ts']), lease('L2', ['we:src/b'], ['we:src/b/y.ts'])],
    });
    expect(pic.overlaps).toEqual([]);
    expect(pic.clean).toBe(true);
  });

  it('overlapping predicted scopes ⇒ one pair, classified by the default (wait) policy', () => {
    const pic = liveScopePicture({
      leases: [lease('L1', ['we:src/a'], []), lease('L2', ['we:src/a/sub'], [])],
    });
    expect(pic.overlaps).toHaveLength(1);
    const o = pic.overlaps[0];
    expect([o.a, o.b].sort()).toEqual(['L1', 'L2']);
    expect(o.outcome).toBe('wait'); // default overlap-at-launch policy
    expect(pic.clean).toBe(false);
  });

  it('the overlap policy is applied — force ⇒ outcome force', () => {
    const pic = liveScopePicture({
      leases: [lease('L1', ['we:src/a'], []), lease('L2', ['we:src/a'], [])],
      policy: { overlapAtLaunch: 'force' },
    });
    expect(pic.overlaps[0].outcome).toBe('force');
  });

  it('ask ⇒ outcome ask', () => {
    const pic = liveScopePicture({
      leases: [lease('L1', ['we:src/a'], []), lease('L2', ['we:src/a'], [])],
      policy: { overlapAtLaunch: 'ask' },
    });
    expect(pic.overlaps[0].outcome).toBe('ask');
  });

  it('EFFECTIVE scope surfaces breach-driven overlap the declarations hide (design call)', () => {
    // Declared scopes are disjoint (src/a vs src/b), but L1 has BREACHED onto src/b/y.ts — which L2 declares.
    // The observer must see this live contention via predicted ∪ observed.
    const pic = liveScopePicture({
      leases: [
        lease('L1', ['we:src/a'], ['we:src/a/x.ts', 'we:src/b/y.ts']), // breaches into src/b
        lease('L2', ['we:src/b'], ['we:src/b/z.ts']),
      ],
    });
    expect(pic.overlaps).toHaveLength(1);
    expect([pic.overlaps[0].a, pic.overlaps[0].b].sort()).toEqual(['L1', 'L2']);
  });

  it('three mutually-overlapping leases ⇒ 3 unordered pairs, each reported once', () => {
    const pic = liveScopePicture({
      leases: [lease('L1', ['we:src/a'], []), lease('L2', ['we:src/a'], []), lease('L3', ['we:src/a'], [])],
    });
    expect(pic.overlaps).toHaveLength(3);
  });

  it('a pair overlap outcome matches overlapAtLaunch called directly', () => {
    const a = lease('L1', ['we:src/a'], ['we:src/a/x.ts']);
    const b = lease('L2', ['we:src/a/sub'], ['we:src/a/sub/y.ts']);
    const pic = liveScopePicture({ leases: [a, b], policy: { overlapAtLaunch: 'wait' } });
    const direct = overlapAtLaunch(effectiveScope(a), [{ id: 'L2', scope: effectiveScope(b) }], 'wait');
    expect(pic.overlaps[0].outcome).toBe(direct.outcome);
  });
});

describe('liveScopePicture — policy resolution + edge inputs', () => {
  it('null policy ⇒ the ratified defaults are applied and echoed', () => {
    const pic = liveScopePicture({ leases: [] });
    expect(pic.policy).toEqual(DEFAULT_SCOPE_POLICY);
  });
  it('partial policy fills defaults', () => {
    const pic = liveScopePicture({ leases: [], policy: { overlapAtLaunch: 'force' } });
    expect(pic.policy).toEqual({ overlapAtLaunch: 'force', breachMidBuild: 'pause', retryBound: DEFAULT_SCOPE_POLICY.retryBound });
  });
  it('an illegal policy throws (same gate as resolveScopePolicy)', () => {
    expect(() => liveScopePicture({ leases: [], policy: { overlapAtLaunch: 'nope' } })).toThrow(/invalid scope policy config/);
  });
  it('no args / empty leases ⇒ empty clean picture', () => {
    expect(liveScopePicture()).toMatchObject({ leases: [], overlaps: [], breachedLanes: [], clean: true });
    expect(liveScopePicture({})).toMatchObject({ leases: [], overlaps: [], clean: true });
  });
  it('skips null / non-object lease entries', () => {
    const pic = liveScopePicture({ leases: [null, lease('L1', ['we:src/a'], []), 7] });
    expect(pic.leases).toHaveLength(1);
    expect(pic.leases[0].lane).toBe('L1');
  });
  it('is pure — same input, same output', () => {
    const leases = [lease('L1', ['we:src/a'], ['we:src/b/y.ts']), lease('L2', ['we:src/b'], [])];
    expect(liveScopePicture({ leases })).toEqual(liveScopePicture({ leases }));
  });
});

describe('candidateLaunch — the "can this start now?" launch affordance', () => {
  it('disjoint from every live lease ⇒ launch', () => {
    const res = candidateLaunch({
      candidateScope: ['we:src/new'],
      leases: [lease('L1', ['we:src/a'], []), lease('L2', ['we:src/b'], [])],
    });
    expect(res.outcome).toBe('launch');
  });

  it('overlaps a live lease under the default (wait) policy ⇒ wait, naming the lane', () => {
    const res = candidateLaunch({
      candidateScope: ['we:src/a/x.ts'],
      leases: [lease('L1', ['we:src/a'], [])],
    });
    expect(res.outcome).toBe('wait');
    expect(res.waitOn).toEqual(['L1']);
  });

  it('force policy ⇒ force + resolveAtDrain', () => {
    const res = candidateLaunch({
      candidateScope: ['we:src/a/x.ts'],
      leases: [lease('L1', ['we:src/a'], [])],
      policy: { overlapAtLaunch: 'force' },
    });
    expect(res.outcome).toBe('force');
    expect(res.resolveAtDrain).toBe(true);
  });

  it('ask policy ⇒ ask', () => {
    const res = candidateLaunch({
      candidateScope: ['we:src/a/x.ts'],
      leases: [lease('L1', ['we:src/a'], [])],
      policy: { overlapAtLaunch: 'ask' },
    });
    expect(res.outcome).toBe('ask');
  });

  it('blocked by a lane\'s BREACH footprint, not only its declaration (effective scope)', () => {
    // Candidate wants src/b; L1 DECLARES src/a but has breached onto src/b/y.ts — the candidate must wait on it.
    const res = candidateLaunch({
      candidateScope: ['we:src/b/y.ts'],
      leases: [lease('L1', ['we:src/a'], ['we:src/b/y.ts'])],
    });
    expect(res.outcome).toBe('wait');
    expect(res.waitOn).toEqual(['L1']);
  });

  it('matches overlapAtLaunch called directly on effective scopes', () => {
    const l = lease('L1', ['we:src/a'], ['we:src/a/x.ts']);
    const direct = overlapAtLaunch(['we:src/a/x.ts'], [{ id: 'L1', scope: effectiveScope(l) }], 'wait');
    const res = candidateLaunch({ candidateScope: ['we:src/a/x.ts'], leases: [l] });
    expect(res).toEqual(direct);
  });

  it('empty / missing leases ⇒ launch', () => {
    expect(candidateLaunch({ candidateScope: ['we:src/a'] }).outcome).toBe('launch');
    expect(candidateLaunch({ candidateScope: ['we:src/a'], leases: [] }).outcome).toBe('launch');
  });

  it('an illegal policy throws', () => {
    expect(() => candidateLaunch({ candidateScope: ['we:src/a'], leases: [], policy: { overlapAtLaunch: 'x' } }))
      .toThrow(/invalid scope policy config/);
  });
});
