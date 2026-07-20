/**
 * @file scripts/readiness/__tests__/scope-lease.test.mjs
 * @description Unit proof of the scope-lease + conflict-policy engine (WE epic #2560, slice 1). Pins the §3i
 *   model (predicted module/glob-level vs observed file-level; breach = their coverage difference) and the
 *   §3i-A4 ratified policies: overlap-at-launch ∈ {wait,ask,force}, breach-mid-build ∈ {pause,park,
 *   resolve-at-drain}, and the retry-once-then-escalate ladder keyed on a TOTAL attempt counter.
 */
import { describe, it, expect } from 'vitest';
import {
  normScope, coversFile, scopeEntriesOverlap, scopesOverlap,
  scopeLease, breachOf,
  overlapAtLaunch, OVERLAP_POLICIES,
  breachOutcome, BREACH_POLICIES, RETRY_BOUND, BREACH_ESCALATION_LADDER, ESCALATION_ROUTES,
  disjoint,
} from '../scope-lease.mjs';

describe('normScope — dedupe + stringify + drop empties', () => {
  it('dedupes and drops falsy', () => {
    expect(normScope(['we:a', 'we:a', '', null, 'we:b'])).toEqual(['we:a', 'we:b']);
  });
  it('non-array → []', () => {
    expect(normScope(undefined)).toEqual([]);
    expect(normScope('we:a')).toEqual([]);
  });
});

describe('coversFile — repo-qualified module/glob coverage', () => {
  it('module prefix covers files UNDER it, and the exact path', () => {
    expect(coversFile('we:src/backlog-view', 'we:src/backlog-view/list.ts')).toBe(true);
    expect(coversFile('we:src/backlog-view', 'we:src/backlog-view')).toBe(true);
    expect(coversFile('we:src/backlog-view/', 'we:src/backlog-view/list.ts')).toBe(true); // trailing slash ok
  });
  it('module prefix does NOT cover a sibling that merely shares a name prefix', () => {
    expect(coversFile('we:src/backlog', 'we:src/backlog-view/list.ts')).toBe(false); // segment boundary
  });
  it('repo must match — a we: lease never covers a frontierui: file', () => {
    expect(coversFile('we:src/x', 'frontierui:src/x/y.ts')).toBe(false);
  });
  it('* matches within a segment, ** crosses segments', () => {
    expect(coversFile('we:src/*.ts', 'we:src/a.ts')).toBe(true);
    expect(coversFile('we:src/*.ts', 'we:src/deep/a.ts')).toBe(false); // * stops at /
    expect(coversFile('we:src/**', 'we:src/deep/a.ts')).toBe(true);
    expect(coversFile('we:src/**/*.ts', 'we:src/a/b/c.ts')).toBe(true);
  });
  it('? matches exactly one non-slash char', () => {
    expect(coversFile('we:src/a?.ts', 'we:src/ab.ts')).toBe(true);
    expect(coversFile('we:src/a?.ts', 'we:src/a/.ts')).toBe(false);
  });
});

describe('scopeEntriesOverlap / scopesOverlap — module-pattern overlap (mirrors intersects)', () => {
  it('same module root or a prefix relation overlaps', () => {
    expect(scopeEntriesOverlap('we:src/foo', 'we:src/foo')).toBe(true);
    expect(scopeEntriesOverlap('we:src/foo', 'we:src/foo/bar.ts')).toBe(true);
    expect(scopeEntriesOverlap('we:src/foo/**', 'we:src/foo/bar/*.ts')).toBe(true); // literal roots overlap
  });
  it('disjoint module roots do NOT overlap; a shared name prefix at no boundary does not', () => {
    expect(scopeEntriesOverlap('we:src/foo', 'we:src/bar')).toBe(false);
    expect(scopeEntriesOverlap('we:src/foo', 'we:src/foobar')).toBe(false);
  });
  it('different repos never overlap', () => {
    expect(scopeEntriesOverlap('we:src/x', 'frontierui:src/x')).toBe(false);
  });
  it('scopesOverlap = any-pair overlap over two scope lists', () => {
    expect(scopesOverlap(['we:a', 'we:b'], ['we:c', 'we:b/x.ts'])).toBe(true);
    expect(scopesOverlap(['we:a', 'we:b'], ['we:c', 'we:d'])).toBe(false);
    expect(scopesOverlap([], ['we:a'])).toBe(false);
  });
});

describe('(1) scopeLease — predicted vs observed → breach', () => {
  it('all observed inside predicted ⇒ clean, no breach', () => {
    const lease = scopeLease(['we:src/backlog-view', 'we:src/lib/*.ts'], ['we:src/backlog-view/list.ts', 'we:src/lib/x.ts']);
    expect(lease.clean).toBe(true);
    expect(lease.breach).toEqual([]);
    expect(lease.inScope).toEqual(['we:src/backlog-view/list.ts', 'we:src/lib/x.ts']);
  });
  it('observed outside predicted ⇒ breach = the difference (coverage-generalized)', () => {
    const lease = scopeLease(['we:src/backlog-view'], ['we:src/backlog-view/list.ts', 'we:src/router.ts']);
    expect(lease.clean).toBe(false);
    expect(lease.breach).toEqual(['we:src/router.ts']);
    expect(lease.inScope).toEqual(['we:src/backlog-view/list.ts']);
  });
  it('cross-repo spill is a breach when predicted did not include that repo', () => {
    const lease = scopeLease(['we:src/x'], ['we:src/x/a.ts', 'frontierui:src/impl.ts']);
    expect(lease.breach).toEqual(['frontierui:src/impl.ts']);
  });
  it('empty predicted ⇒ every observed file breaches', () => {
    expect(scopeLease([], ['we:a', 'we:b']).breach).toEqual(['we:a', 'we:b']);
  });
  it('breachOf convenience returns just the breach set', () => {
    expect(breachOf(['we:src/x'], ['we:src/x/a.ts', 'we:src/y.ts'])).toEqual(['we:src/y.ts']);
  });
});

describe('(2) overlapAtLaunch — the {wait,ask,force} knob', () => {
  const leases = [
    { id: 'lane-2', scope: ['we:src/backlog-view'] },
    { id: 'lane-5', scope: ['we:src/router.ts'] },
  ];
  it('no overlap ⇒ launch, for every policy', () => {
    for (const policy of OVERLAP_POLICIES) {
      const r = overlapAtLaunch(['we:src/unrelated'], leases, policy);
      expect(r.outcome).toBe('launch');
      expect(r.overlaps).toEqual([]);
    }
  });
  it('wait (default) ⇒ block on every overlapping lease', () => {
    const r = overlapAtLaunch(['we:src/backlog-view/detail.ts'], leases);
    expect(r.policy).toBe('wait');
    expect(r.outcome).toBe('wait');
    expect(r.waitOn).toEqual(['lane-2']);
    expect(r.resolveAtDrain).toBe(false);
  });
  it('ask ⇒ park for the human (no auto-launch)', () => {
    const r = overlapAtLaunch(['we:src/backlog-view/detail.ts'], leases, 'ask');
    expect(r.outcome).toBe('ask');
    expect(r.overlaps.map((o) => o.leaseId)).toEqual(['lane-2']);
  });
  it('force ⇒ launch now + schedule resolve-at-drain', () => {
    const r = overlapAtLaunch(['we:src/backlog-view/detail.ts'], leases, 'force');
    expect(r.outcome).toBe('force');
    expect(r.resolveAtDrain).toBe(true);
    expect(r.waitOn).toEqual(['lane-2']);
  });
  it('overlaps MANY leases ⇒ waits on all of them', () => {
    const r = overlapAtLaunch(['we:src/backlog-view/x.ts', 'we:src/router.ts'], leases, 'wait');
    expect(r.waitOn).toEqual(['lane-2', 'lane-5']);
  });
  it('laneId is used when id is absent; missing both ⇒ null', () => {
    expect(overlapAtLaunch(['we:src/a/x.ts'], [{ laneId: 'L', scope: ['we:src/a'] }]).waitOn).toEqual(['L']);
    expect(overlapAtLaunch(['we:src/a/x.ts'], [{ scope: ['we:src/a'] }]).waitOn).toEqual([null]);
  });
  it('empty / missing lease list ⇒ launch', () => {
    expect(overlapAtLaunch(['we:src/a'], []).outcome).toBe('launch');
    expect(overlapAtLaunch(['we:src/a'], undefined).outcome).toBe('launch');
  });
  it('unknown policy throws', () => {
    expect(() => overlapAtLaunch(['we:a'], leases, 'nope')).toThrow(/unknown policy/);
  });
});

describe('(3) breachOutcome — the {pause,park,resolve-at-drain} knob + retry ladder', () => {
  it('no breach ⇒ continue, for every policy', () => {
    for (const policy of BREACH_POLICIES) {
      const r = breachOutcome([], policy);
      expect(r.breached).toBe(false);
      expect(r.action).toBe('continue');
      expect(r.escalated).toBe(false);
    }
  });
  it('accepts a scopeLease() result OR a raw file array as the breach', () => {
    const lease = scopeLease(['we:src/x'], ['we:src/y.ts']);
    expect(breachOutcome(lease, 'pause').breached).toBe(true);
    expect(breachOutcome(['we:src/y.ts'], 'pause').breached).toBe(true);
  });
  it('within the retry bound ⇒ retry-in-place (A4 default) for ANY policy', () => {
    for (const policy of BREACH_POLICIES) {
      const r = breachOutcome(['we:src/y.ts'], policy, { attempt: 1 });
      expect(r.action).toBe('retry-in-place');
      expect(r.rung).toBe('retry-in-place');
      expect(r.escalated).toBe(false);
    }
  });
  it('TOTAL attempt counter drives escalation (not same-scope-twice): a DIFFERENT breach file still escalates', () => {
    // attempt 2 > RETRY_BOUND(1) — even though the breached file differs from attempt 1, it escalates.
    const r = breachOutcome(['we:src/DIFFERENT.ts'], 'park', { attempt: 2 });
    expect(r.escalated).toBe(true);
    expect(r.action).toBe('park');
  });
  it('resolve-at-drain ⇒ continue building, resolve scheduled at drain', () => {
    const r = breachOutcome(['we:src/y.ts'], 'resolve-at-drain', { attempt: 2 });
    expect(r.action).toBe('resolve-at-drain');
    expect(r.resolveAtDrain).toBe(true);
    expect(r.escalated).toBe(true);
    expect(r.holdSource).toBe(null);
  });
  it('pause ⇒ hold with sibling-lane source (wait for the owning lease)', () => {
    const r = breachOutcome(['we:src/y.ts'], 'pause', { attempt: 2 });
    expect(r.action).toBe('pause');
    expect(r.holdSource).toBe('sibling-lane');
    expect(r.rung).toBe('handoff-cross-lane');
  });
  it('park ⇒ amber you-card (policy hold) offering the escalation route menu', () => {
    const r = breachOutcome(['we:src/y.ts'], 'park', { attempt: 2 });
    expect(r.action).toBe('park');
    expect(r.holdSource).toBe('policy');
    expect(r.routes).toBe(ESCALATION_ROUTES);
    expect(r.routes.map((x) => x.rung)).toEqual(['widen-lease', 'handoff-cross-lane', 'bounce-quarantine']);
  });
  it('a custom retryBound extends how long retry-in-place holds before escalating', () => {
    expect(breachOutcome(['we:src/y.ts'], 'park', { attempt: 3, retryBound: 3 }).action).toBe('retry-in-place');
    expect(breachOutcome(['we:src/y.ts'], 'park', { attempt: 4, retryBound: 3 }).escalated).toBe(true);
  });
  it('unknown policy throws', () => {
    expect(() => breachOutcome(['we:a'], 'nope')).toThrow(/unknown policy/);
  });
});

describe('escalation ladder + constants (§3i-A4 Fork 2, as data)', () => {
  it('RETRY_BOUND is 1 (retry-once-then-escalate)', () => {
    expect(RETRY_BOUND).toBe(1);
  });
  it('ladder is ordered retry → widen → handoff → bounce', () => {
    expect(BREACH_ESCALATION_LADDER.map((r) => r.rung))
      .toEqual(['retry-in-place', 'widen-lease', 'handoff-cross-lane', 'bounce-quarantine']);
    expect(BREACH_ESCALATION_LADDER.map((r) => r.order)).toEqual([0, 1, 2, 3]);
  });
  it('ESCALATION_ROUTES = the rungs past the retry-in-place default', () => {
    expect(ESCALATION_ROUTES.every((r) => r.order >= 1)).toBe(true);
    expect(ESCALATION_ROUTES.length).toBe(3);
  });
  it('policy token sets are the ratified §3i values', () => {
    expect(OVERLAP_POLICIES).toEqual(['wait', 'ask', 'force']);
    expect(BREACH_POLICIES).toEqual(['pause', 'park', 'resolve-at-drain']);
  });
});

describe('composition — the reused lane-partition primitive', () => {
  it('re-exports disjoint (the exact-set primitive reused, not re-implemented)', () => {
    expect(disjoint(new Set(['we:a']), new Set(['we:b']))).toBe(true);
    expect(disjoint(new Set(['we:a']), new Set(['we:a']))).toBe(false);
  });
});
