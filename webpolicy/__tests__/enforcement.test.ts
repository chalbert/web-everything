/**
 * Web Policy enforcement seam (backlog #408). Proves the PDP hit policies (UNIQUE/FIRST/PRIORITY/COLLECT
 * + default), the swappable rule-evaluator seam, and the PEP: permit→allow / deny→block, the runtime
 * venue emitting a #407 proof record anchored to a trace span (and verifying on the chain), the
 * build/gate venue deciding without proof, and the `guard` ergonomic.
 */
import { describe, it, expect } from 'vitest';
import {
  PolicyDecisionPoint,
  PolicyEnforcementPoint,
  comparatorEvaluator,
  HitPolicyViolation,
  type PolicyRuleSet,
  type RuleEvaluator,
} from '../enforcement';
import { ProofChain } from '../proof';

// A trivial deterministic hash for the proof chain (the #407 tests use the same injection pattern).
const hash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(64, '0');
};

const orderApproval: PolicyRuleSet = {
  id: 'order-approval',
  version: '1',
  hitPolicy: 'FIRST',
  inputs: ['amount', 'role'],
  default: 'deny',
  rules: [
    { when: [{ input: 'amount', op: 'gt', value: 10000 }], then: [{ name: 'verdict', value: 'deny' }] },
    { when: [{ input: 'role', op: 'eq', value: 'manager' }], then: [{ name: 'verdict', value: 'permit' }] },
  ],
};

describe('PolicyDecisionPoint hit policies', () => {
  const pdp = new PolicyDecisionPoint();

  it('FIRST takes the first matching rule in document order', () => {
    // amount>10000 fires before the manager rule even though both match.
    const v = pdp.decide(orderApproval, { amount: 50000, role: 'manager' });
    expect(v.verdict).toBe('deny');
    expect(v.matched).toHaveLength(1);
  });

  it('returns the default verdict when no rule matches', () => {
    const v = pdp.decide(orderApproval, { amount: 100, role: 'clerk' });
    expect(v.verdict).toBe('deny');
    expect(v.reason).toBe('no rule matched');
  });

  it('UNIQUE throws when more than one rule matches', () => {
    const rs: PolicyRuleSet = {
      id: 'u', version: '1', hitPolicy: 'UNIQUE', inputs: ['x'],
      rules: [
        { when: [{ input: 'x', op: 'gt', value: 0 }], then: [{ name: 'verdict', value: 'a' }] },
        { when: [{ input: 'x', op: 'lt', value: 10 }], then: [{ name: 'verdict', value: 'b' }] },
      ],
    };
    expect(() => pdp.decide(rs, { x: 5 })).toThrow(HitPolicyViolation);
  });

  it('PRIORITY picks the highest-priority matching rule', () => {
    const rs: PolicyRuleSet = {
      id: 'p', version: '1', hitPolicy: 'PRIORITY', inputs: ['x'],
      rules: [
        { when: [{ input: 'x', op: 'gt', value: 0 }], then: [{ name: 'verdict', value: 'low' }], priority: 1 },
        { when: [{ input: 'x', op: 'gt', value: 0 }], then: [{ name: 'verdict', value: 'high' }], priority: 9 },
      ],
    };
    expect(pdp.decide(rs, { x: 1 }).verdict).toBe('high');
  });

  it('COLLECT merges outputs across all matches', () => {
    const rs: PolicyRuleSet = {
      id: 'c', version: '1', hitPolicy: 'COLLECT', inputs: ['x'],
      rules: [
        { when: [{ input: 'x', op: 'gte', value: 0 }], then: [{ name: 'a', value: 1 }] },
        { when: [{ input: 'x', op: 'lte', value: 10 }], then: [{ name: 'b', value: 2 }] },
      ],
    };
    const v = pdp.decide(rs, { x: 5 });
    expect(v.matched).toHaveLength(2);
    expect(v.outputs).toEqual({ a: 1, b: 2 });
  });

  it('an unknown op never silently matches', () => {
    expect(comparatorEvaluator.matches({ when: [{ input: 'x', op: 'weird', value: 1 }], then: [] }, { x: 1 })).toBe(false);
  });
});

describe('swappable rule evaluator (policy language = build choice)', () => {
  it('the PDP delegates matching to an injected evaluator', () => {
    const alwaysMatch: RuleEvaluator = { id: 'always', matches: () => true };
    const pdp = new PolicyDecisionPoint(alwaysMatch);
    const v = pdp.decide(orderApproval, { amount: 1, role: 'clerk' });
    expect(v.verdict).toBe('deny'); // FIRST rule's then, since the custom evaluator matches it
    expect(v.matched).toHaveLength(1);
  });
});

describe('PolicyEnforcementPoint', () => {
  it('permits → allows, denies → blocks', () => {
    const pep = new PolicyEnforcementPoint();
    expect(pep.enforce(orderApproval, { amount: 1, role: 'manager' }).allowed).toBe(true);
    expect(pep.enforce(orderApproval, { amount: 99999, role: 'manager' }).allowed).toBe(false);
  });

  it('runtime venue: emits a tamper-evident proof record anchored to the trace span, and it verifies', () => {
    const chain = new ProofChain({ hash });
    const pep = new PolicyEnforcementPoint({ chain, now: () => '2026-06-13T00:00:00Z' });
    const result = pep.enforce(orderApproval, { amount: 1, role: 'manager' }, { actor: 'svc-orders', traceSpan: 'span-7' });
    expect(result.allowed).toBe(true);
    expect(result.proof).toBeDefined();
    expect(result.proof!.traceSpan).toBe('span-7');
    expect(result.proof!.verdict).toBe('permit');
    expect(chain.records).toHaveLength(1);
    expect(chain.verify().ok).toBe(true);
  });

  it('build/gate venue: decides + enforces but emits no proof when no chain is wired', () => {
    const pep = new PolicyEnforcementPoint(); // no chain
    const result = pep.enforce(orderApproval, { amount: 99999, role: 'manager' }, { actor: 'ci' });
    expect(result.allowed).toBe(false);
    expect(result.proof).toBeUndefined();
  });

  it('proof chain accumulates one record per enforced decision', () => {
    const chain = new ProofChain({ hash });
    const pep = new PolicyEnforcementPoint({ chain, now: () => '2026-06-13T00:00:00Z' });
    pep.enforce(orderApproval, { amount: 1, role: 'manager' }, { actor: 'a' });
    pep.enforce(orderApproval, { amount: 99999, role: 'manager' }, { actor: 'a' });
    expect(chain.records.map((r) => r.verdict)).toEqual(['permit', 'deny']);
    expect(chain.verify().ok).toBe(true);
  });

  it('guard runs the action on permit and the onDeny branch on deny', () => {
    const pep = new PolicyEnforcementPoint();
    const allowed = pep.guard(orderApproval, { amount: 1, role: 'manager' }, () => 'ran', { actor: 'u' });
    expect(allowed).toBe('ran');
    const denied = pep.guard(orderApproval, { amount: 99999, role: 'manager' }, () => 'ran', { actor: 'u' }, () => 'blocked');
    expect(denied).toBe('blocked');
  });

  it('guard throws when denied and no onDeny is supplied', () => {
    const pep = new PolicyEnforcementPoint();
    expect(() => pep.guard(orderApproval, { amount: 99999, role: 'manager' }, () => 'ran', { actor: 'u' })).toThrow(/denied/);
  });
});
