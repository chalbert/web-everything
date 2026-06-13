/**
 * Access-control member (#178/#338) on the Guard seam. Pins the ratified design (Forks A–D): two
 * surfaces / one provider, the `hide | redirect | forbid | cloak` deny family with surface validity,
 * provider-owned 403-vs-404 existence disclosure, and the authority taxonomy default.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAccess,
  resolveDenyOutcome,
  isOutcomeForSurface,
  AccessControlConfigError,
  OUTCOMES_BY_SURFACE,
  type AccessControlPolicy,
} from '../accessControl';
import type { CustomGuardProvider, GuardDecision, GuardRegion } from '../provider';

/** A provider that answers with a fixed decision — the swappable seam (CASL/OPA/a flag SDK in real life). */
const fixedProvider = (decision: GuardDecision): CustomGuardProvider => ({
  key: 'test',
  evaluate: async () => decision,
});

const route: GuardRegion = { kind: 'route', id: '/admin' };
const element: GuardRegion = { kind: 'element', id: 'salary-cell' };

describe('deny-outcome × surface validity (Fork A/B)', () => {
  it('route expresses redirect/forbid/cloak; render expresses hide/forbid/cloak', () => {
    expect(OUTCOMES_BY_SURFACE.route).toEqual(['redirect', 'forbid', 'cloak']);
    expect(OUTCOMES_BY_SURFACE.render).toEqual(['hide', 'forbid', 'cloak']);
    expect(isOutcomeForSurface('route', 'redirect')).toBe(true);
    expect(isOutcomeForSurface('render', 'redirect')).toBe(false); // redirect is route-only
    expect(isOutcomeForSurface('route', 'hide')).toBe(false); // hide is render-only
  });

  it('a surface/outcome mismatch is a config error', async () => {
    const policy: AccessControlPolicy = { surface: 'render', denyOutcome: 'redirect' };
    await expect(evaluateAccess(fixedProvider({ allow: false }), element, policy)).rejects.toBeInstanceOf(AccessControlConfigError);
  });
});

describe('resolveDenyOutcome — provider-owned 403-vs-404 (Fork B)', () => {
  it('conceal (default) downgrades forbid → cloak to hide existence; reveal keeps forbid', () => {
    expect(resolveDenyOutcome('forbid')).toBe('cloak'); // secure default
    expect(resolveDenyOutcome('forbid', 'conceal')).toBe('cloak');
    expect(resolveDenyOutcome('forbid', 'reveal')).toBe('forbid');
  });
  it('leaves the other outcomes untouched', () => {
    for (const o of ['hide', 'redirect', 'cloak'] as const) expect(resolveDenyOutcome(o, 'reveal')).toBe(o);
  });
});

describe('evaluateAccess — two surfaces, one provider (Fork A) + trust boundary', () => {
  it('allows when the provider allows (both surfaces, same provider)', async () => {
    const provider = fixedProvider({ allow: true });
    expect(await evaluateAccess(provider, route, { surface: 'route', denyOutcome: 'redirect' })).toEqual({ allow: true });
    expect(await evaluateAccess(provider, element, { surface: 'render', denyOutcome: 'hide' })).toEqual({ allow: true });
  });

  it('on deny, the route guard yields the navigation outcome + reason', async () => {
    const r = await evaluateAccess(fixedProvider({ allow: false, reason: 'not an admin' }), route, { surface: 'route', denyOutcome: 'redirect', authority: 'authorization' });
    expect(r).toEqual({ allow: false, outcome: 'redirect', authority: 'authorization', reason: 'not an admin' });
  });

  it('on deny, the render gate hides the subtree', async () => {
    const r = await evaluateAccess(fixedProvider({ allow: false }), element, { surface: 'render', denyOutcome: 'hide' });
    expect(r).toMatchObject({ allow: false, outcome: 'hide', authority: 'authorization' });
  });

  it('a requested forbid is concealed to cloak by default (existence hiding)', async () => {
    const r = await evaluateAccess(fixedProvider({ allow: false }), route, { surface: 'route', denyOutcome: 'forbid' });
    expect(r).toMatchObject({ allow: false, outcome: 'cloak' });
  });

  it('a reveal disclosure keeps forbid as a 403', async () => {
    const r = await evaluateAccess(fixedProvider({ allow: false }), route, { surface: 'route', denyOutcome: 'forbid' }, { disclosure: 'reveal' });
    expect(r).toMatchObject({ allow: false, outcome: 'forbid' });
  });

  it('feature-flag is a first-class authority kind through the same provider (Fork C)', async () => {
    const r = await evaluateAccess(fixedProvider({ allow: false }), element, { surface: 'render', denyOutcome: 'hide', authority: 'feature-flag' });
    expect(r).toMatchObject({ allow: false, authority: 'feature-flag' });
  });

  it('catches a hostile provider at the trust boundary (non-conformant decision)', async () => {
    const hostile: CustomGuardProvider = { key: 'evil', evaluate: async () => ({ allow: 'yes' } as unknown as GuardDecision) };
    await expect(evaluateAccess(hostile, route, { surface: 'route', denyOutcome: 'redirect' })).rejects.toThrow(/GuardDecision contract/);
  });
});
