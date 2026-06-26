/**
 * #1789 — the clock-free synchronous binding variant. Proves a facts→verdict standard (a DMN-style policy
 * engine, the #1784 motivating case) can be exercised by the #899 conformance contract with **no**
 * {@link ConformanceClock}: a synchronous vector (every step's `atMs` omitted) validates, and a
 * {@link SynchronousConformanceBinding} fake round-trips dispatch→observe with no clock anywhere in sight.
 * WE-side contract test only — the runnable driver lives in the neutral runner home (#1597), not here.
 */
import { describe, it, expect } from 'vitest';
import { assertConformanceSuite, type ConformanceVectorSuite } from '../schema';
import type { SynchronousConformanceBinding, ConformanceBindingFactory } from '../binding';

/** A synchronous facts→verdict suite — order-only steps (no `atMs`), the verdict read via `observe('verdict')`. */
const loanPolicySuite: ConformanceVectorSuite = {
  standard: 'demo-loan-policy',
  contract: '@webeverything/demo-loan-policy',
  vectors: [
    {
      id: 'demo-loan-policy/tier/approve-high-score',
      contract: '@webeverything/demo-loan-policy',
      steps: [{ do: 'setFacts', score: 720, amount: 1000 }],
      expect: { finalState: 'approve' },
      observeVia: ['verdict'],
    },
    {
      id: 'demo-loan-policy/tier/deny-low-score',
      contract: '@webeverything/demo-loan-policy',
      steps: [{ do: 'setFacts', score: 540, amount: 1000 }],
      expect: { finalState: 'deny' },
      observeVia: ['verdict'],
    },
  ],
};

/** A clock-free binding for the synchronous standard — implements the base, has NO `clock`. */
class LoanPolicyBinding implements SynchronousConformanceBinding {
  #verdict = 'pending';
  dispatch(step: ConformanceVectorSuite['vectors'][number]['steps'][number]): void {
    if (step.do === 'setFacts') {
      this.#verdict = (step.score as number) >= 700 ? 'approve' : 'deny';
    }
  }
  observe(surface: string): unknown {
    return surface === 'verdict' ? this.#verdict : undefined;
  }
}

describe('#1789 — synchronous (clock-free) conformance binding', () => {
  it('validates a synchronous vector suite (no atMs, no temporal guard)', () => {
    expect(() => assertConformanceSuite(loanPolicySuite)).not.toThrow();
    // synchronous ⇒ every step omits `atMs`
    for (const v of loanPolicySuite.vectors) {
      for (const s of v.steps) expect(s.atMs).toBeUndefined();
    }
  });

  it('round-trips dispatch→observe with no clock — a facts→verdict binding needs no ConformanceClock', () => {
    for (const vector of loanPolicySuite.vectors) {
      const binding = new LoanPolicyBinding();
      for (const step of vector.steps) binding.dispatch(step);
      expect(binding.observe('verdict')).toBe(vector.expect.finalState);
    }
    // the binding object has no `clock` member at all
    expect('clock' in new LoanPolicyBinding()).toBe(false);
  });

  it('types as a ConformanceBindingFactory<SynchronousConformanceBinding> (clock-free factory)', () => {
    const factory: ConformanceBindingFactory<SynchronousConformanceBinding> = {
      create: () => new LoanPolicyBinding(),
    };
    const binding = factory.create(loanPolicySuite.vectors[0]);
    expect(binding).toBeInstanceOf(LoanPolicyBinding);
  });
});
