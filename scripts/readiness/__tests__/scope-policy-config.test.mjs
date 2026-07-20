/**
 * @file scripts/readiness/__tests__/scope-policy-config.test.mjs
 * @description Unit proof of the per-program scope-policy config layer (WE epic #2560, slice 2). Pins the §3i
 *   "both knobs configurable per program" defaults (overlap=wait, breach=pause, retryBound=RETRY_BOUND), the
 *   validate-vs-resolve split (build-queue `{ok,errors}` validation + scope-lease throw-on-illegal resolution),
 *   and the composition contract with slice 1 (enums imported, resolved shape feeds overlapAtLaunch/breachOutcome).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCOPE_POLICY,
  validateScopePolicy,
  resolveScopePolicy,
  describeScopePolicy,
  OVERLAP_POLICIES, BREACH_POLICIES, RETRY_BOUND,
} from '../scope-policy-config.mjs';
import {
  OVERLAP_POLICIES as LEASE_OVERLAP, BREACH_POLICIES as LEASE_BREACH, RETRY_BOUND as LEASE_RETRY,
  overlapAtLaunch, breachOutcome,
} from '../scope-lease.mjs';

describe('DEFAULT_SCOPE_POLICY — the §3i / §3i-A4 defaults', () => {
  it('is overlap=wait, breach=pause, retryBound=RETRY_BOUND', () => {
    expect(DEFAULT_SCOPE_POLICY).toEqual({ overlapAtLaunch: 'wait', breachMidBuild: 'pause', retryBound: RETRY_BOUND });
  });
  it('every default field is a member of the imported enums', () => {
    expect(OVERLAP_POLICIES).toContain(DEFAULT_SCOPE_POLICY.overlapAtLaunch);
    expect(BREACH_POLICIES).toContain(DEFAULT_SCOPE_POLICY.breachMidBuild);
  });
  it('is frozen (shared default cannot be mutated in place)', () => {
    expect(Object.isFrozen(DEFAULT_SCOPE_POLICY)).toBe(true);
  });
});

describe('composition with slice 1 — enums are the SAME objects, never re-listed', () => {
  it('re-exported enums are identical to scope-lease.mjs (not copies that could drift)', () => {
    expect(OVERLAP_POLICIES).toBe(LEASE_OVERLAP);
    expect(BREACH_POLICIES).toBe(LEASE_BREACH);
    expect(RETRY_BOUND).toBe(LEASE_RETRY);
  });
  it('a resolved policy feeds overlapAtLaunch / breachOutcome directly', () => {
    const p = resolveScopePolicy({ overlapAtLaunch: 'force', breachMidBuild: 'park', retryBound: 2 });
    // overlapAtLaunch accepts p.overlapAtLaunch as its policy token
    expect(overlapAtLaunch(['we:src/a/x.ts'], [{ id: 'L', scope: ['we:src/a'] }], p.overlapAtLaunch).outcome).toBe('force');
    // breachOutcome accepts p.breachMidBuild + p.retryBound
    const out = breachOutcome(['we:src/y.ts'], p.breachMidBuild, { attempt: 3, retryBound: p.retryBound });
    expect(out.action).toBe('park');
    expect(out.retryBound).toBe(2);
  });
  it('the DEFAULT policy also feeds the slice-1 functions cleanly', () => {
    const d = DEFAULT_SCOPE_POLICY;
    expect(overlapAtLaunch(['we:src/a/x.ts'], [{ id: 'L', scope: ['we:src/a'] }], d.overlapAtLaunch).outcome).toBe('wait');
    expect(breachOutcome(['we:src/y.ts'], d.breachMidBuild, { attempt: 2, retryBound: d.retryBound }).action).toBe('pause');
  });
});

describe('validateScopePolicy — { ok, errors }, never throws (build-queue convention)', () => {
  it('absent config (null / undefined) ⇒ ok (all-defaults)', () => {
    expect(validateScopePolicy(null)).toEqual({ ok: true, errors: [] });
    expect(validateScopePolicy(undefined)).toEqual({ ok: true, errors: [] });
  });
  it('empty object ⇒ ok (every field fills from default)', () => {
    expect(validateScopePolicy({})).toEqual({ ok: true, errors: [] });
  });
  it('a fully-valid config ⇒ ok', () => {
    expect(validateScopePolicy({ overlapAtLaunch: 'ask', breachMidBuild: 'resolve-at-drain', retryBound: 0 }).ok).toBe(true);
  });
  it('every legal overlap token validates', () => {
    for (const t of OVERLAP_POLICIES) expect(validateScopePolicy({ overlapAtLaunch: t }).ok).toBe(true);
  });
  it('every legal breach token validates', () => {
    for (const t of BREACH_POLICIES) expect(validateScopePolicy({ breachMidBuild: t }).ok).toBe(true);
  });
  it('non-object (array / primitive) ⇒ not ok', () => {
    expect(validateScopePolicy([]).ok).toBe(false);
    expect(validateScopePolicy('wait').ok).toBe(false);
    expect(validateScopePolicy(7).ok).toBe(false);
  });
  it('unknown overlap token ⇒ error naming the field + legal set', () => {
    const { ok, errors } = validateScopePolicy({ overlapAtLaunch: 'nope' });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/unknown overlapAtLaunch "nope"/);
    expect(errors.join()).toMatch(/wait\|ask\|force/);
  });
  it('unknown breach token ⇒ error', () => {
    expect(validateScopePolicy({ breachMidBuild: 'halt' }).errors.join()).toMatch(/unknown breachMidBuild "halt"/);
  });
  it('bad retryBound (negative / non-integer / non-number) ⇒ error', () => {
    expect(validateScopePolicy({ retryBound: -1 }).ok).toBe(false);
    expect(validateScopePolicy({ retryBound: 1.5 }).ok).toBe(false);
    expect(validateScopePolicy({ retryBound: '1' }).ok).toBe(false);
    expect(validateScopePolicy({ retryBound: 0 }).ok).toBe(true); // 0 is legal (never retry)
  });
  it('unknown extra key ⇒ error (typo guard)', () => {
    expect(validateScopePolicy({ overlapp: 'wait' }).errors.join()).toMatch(/unknown config key "overlapp"/);
  });
  it('reports MULTIPLE problems at once', () => {
    const { errors } = validateScopePolicy({ overlapAtLaunch: 'x', breachMidBuild: 'y', retryBound: -3 });
    expect(errors.length).toBe(3);
  });
});

describe('resolveScopePolicy — fills defaults; THROWS on illegal (scope-lease convention)', () => {
  it('null / undefined ⇒ a full copy of the default', () => {
    expect(resolveScopePolicy(null)).toEqual(DEFAULT_SCOPE_POLICY);
    expect(resolveScopePolicy(undefined)).toEqual(DEFAULT_SCOPE_POLICY);
  });
  it('empty object ⇒ the default values', () => {
    expect(resolveScopePolicy({})).toEqual({ overlapAtLaunch: 'wait', breachMidBuild: 'pause', retryBound: RETRY_BOUND });
  });
  it('partial config fills ONLY the missing fields', () => {
    expect(resolveScopePolicy({ overlapAtLaunch: 'force' }))
      .toEqual({ overlapAtLaunch: 'force', breachMidBuild: 'pause', retryBound: RETRY_BOUND });
    expect(resolveScopePolicy({ retryBound: 5 }))
      .toEqual({ overlapAtLaunch: 'wait', breachMidBuild: 'pause', retryBound: 5 });
  });
  it('full config passes through unchanged', () => {
    const cfg = { overlapAtLaunch: 'ask', breachMidBuild: 'resolve-at-drain', retryBound: 3 };
    expect(resolveScopePolicy(cfg)).toEqual(cfg);
  });
  it('retryBound 0 is honored (not treated as missing)', () => {
    expect(resolveScopePolicy({ retryBound: 0 }).retryBound).toBe(0);
  });
  it('returns a FRESH object each call (does not leak / mutate the frozen default)', () => {
    const a = resolveScopePolicy({});
    a.overlapAtLaunch = 'force';
    expect(DEFAULT_SCOPE_POLICY.overlapAtLaunch).toBe('wait'); // default untouched
    expect(resolveScopePolicy({}).overlapAtLaunch).toBe('wait'); // next resolve unaffected
    expect(Object.isFrozen(a)).toBe(false); // result is a plain, caller-mutable object
  });
  it('throws a clear message on an unknown overlap token', () => {
    expect(() => resolveScopePolicy({ overlapAtLaunch: 'nope' })).toThrow(/invalid scope policy config/);
    expect(() => resolveScopePolicy({ overlapAtLaunch: 'nope' })).toThrow(/unknown overlapAtLaunch "nope"/);
  });
  it('throws on an unknown breach token / bad retryBound / unknown key', () => {
    expect(() => resolveScopePolicy({ breachMidBuild: 'halt' })).toThrow(/unknown breachMidBuild/);
    expect(() => resolveScopePolicy({ retryBound: -1 })).toThrow(/retryBound must be an integer/);
    expect(() => resolveScopePolicy({ nope: 1 })).toThrow(/unknown config key "nope"/);
  });
  it('is deterministic — same input, same output', () => {
    const cfg = { overlapAtLaunch: 'force' };
    expect(resolveScopePolicy(cfg)).toEqual(resolveScopePolicy(cfg));
  });
});

describe('describeScopePolicy — one-line human summary', () => {
  it('summarizes the default policy', () => {
    expect(describeScopePolicy(null)).toBe('overlap-at-launch: wait · breach-mid-build: pause · retry bound: 1');
  });
  it('summarizes a resolved partial (fills defaults first)', () => {
    expect(describeScopePolicy({ overlapAtLaunch: 'force' }))
      .toBe('overlap-at-launch: force · breach-mid-build: pause · retry bound: 1');
  });
  it('throws on an illegal policy (same gate as resolve)', () => {
    expect(() => describeScopePolicy({ breachMidBuild: 'halt' })).toThrow(/unknown breachMidBuild/);
  });
});
