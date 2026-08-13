/**
 * @file retry-health.test.mjs — the instrument that will choose #3083's default, and its refusal to choose
 *   before it can (#3087).
 *
 * THE LOAD-BEARING TESTS are the refusals and the population split. A distribution is easy; the hard part is
 * not answering when the evidence cannot carry it, and not letting the wrong population look like evidence.
 */

import { describe, it, expect } from 'vitest';

import {
  assessRetryBudget,
  attemptObservations,
  distributionFor,
  renderRetryHealth,
  requiredObservations,
  MIN_OBSERVATIONS,
} from '../retry-health.mjs';

/** A run holding one effect entry with the given attempt shape. */
const runWith = (entries, id = 'r') => ({
  id, op: 'deploy', effects: entries.map((e, i) => ({ key: `${id}#0#${i}`, type: 'start.build', ...e })),
});

/** `n` settled entries that each succeeded on attempt `attempts`. */
const settled = (n, attempts, by, status = 'applied') =>
  Array.from({ length: n }, () => ({ attempts, attemptedBy: by, status }));

describe('attemptObservations', () => {
  it('reads only entries that carry an attempt count', () => {
    const runs = [runWith([
      { attempts: 2, attemptedBy: 'auto', status: 'applied' },
      { status: 'declared' },                       // never attempted
      { attempts: 0, attemptedBy: 'auto', status: 'failed' },  // not a real attempt
    ])];
    expect(attemptObservations(runs)).toHaveLength(1);
  });

  // An in-flight entry has not succeeded or failed yet. Counting it as a failure at attempt N would read a
  // SLOW success as a permanent one — the same mistake the waker made three times with `overdue`.
  it('does not treat an unsettled entry as an outcome', () => {
    const runs = [runWith([{ attempts: 3, attemptedBy: 'auto', status: 'in-flight' }])];
    const [o] = attemptObservations(runs);
    expect(o.settled).toBe(false);
    expect(distributionFor(attemptObservations(runs), 'auto').settled).toBe(0);
  });

  it('defaults an unlabelled attempt to human, never to auto', () => {
    const runs = [runWith([{ attempts: 1, status: 'applied' }])];
    expect(attemptObservations(runs)[0].by).toBe('human');
  });
});

describe('the distribution answers a COVERAGE question', () => {
  it('reports what fraction of successes each budget would have reached', () => {
    const runs = [runWith([
      ...settled(6, 1, 'auto'),
      ...settled(3, 2, 'auto'),
      ...settled(1, 4, 'auto'),
    ])];
    const d = distributionFor(attemptObservations(runs), 'auto');
    expect(d.succeeded).toBe(10);
    expect(d.wouldCatch[1]).toBeCloseTo(0.6, 5);
    expect(d.wouldCatch[2]).toBeCloseTo(0.9, 5);
    expect(d.wouldCatch[4]).toBeCloseTo(1, 5);
  });

  // No mean, no median, anywhere. The distribution is heavily skewed and the question is "how many successes
  // would a budget of N reach", which a central tendency cannot answer.
  it('counts a settled FAILURE in the denominator but never as a success', () => {
    const runs = [runWith([...settled(4, 1, 'auto'), ...settled(4, 3, 'auto', 'failed')])];
    const d = distributionFor(attemptObservations(runs), 'auto');
    expect(d.settled).toBe(8);
    expect(d.succeeded).toBe(4);
    expect(d.wouldCatch[1]).toBeCloseTo(1, 5);
  });
});

/**
 * THE REFUSALS. This exists to stop #3083's default being guessed, so not-concluding is the behaviour under
 * test — not an edge case.
 */
describe('it refuses rather than guesses', () => {
  it('refuses on an empty corpus, which is exactly today', () => {
    const r = assessRetryBudget([]);
    expect(r.conclusive).toBe(false);
    expect(r.suggestedBudget).toBeNull();
    expect(r.blockers[0]).toMatch(/only 0 settled AUTOMATIC/);
  });

  // THE ASYMMETRY, and the whole reason `attemptedBy` is recorded. A human retry succeeding usually means
  // someone FIXED the cause; no budget would have helped. A large human corpus is not evidence.
  it('refuses on a thousand HUMAN observations and no automatic ones', () => {
    const runs = [runWith(settled(1000, 2, 'human'))];
    const r = assessRetryBudget(runs);
    expect(r.human.settled).toBe(1000);
    expect(r.conclusive).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/Human retries do not answer this/);
    expect(r.suggestedBudget).toBeNull();
  });

  it('refuses just under the floor and concludes just over it', () => {
    const under = assessRetryBudget([runWith(settled(MIN_OBSERVATIONS - 1, 1, 'auto'))]);
    expect(under.conclusive).toBe(false);
    const over = assessRetryBudget([runWith(settled(MIN_OBSERVATIONS, 1, 'auto'))]);
    expect(over.conclusive).toBe(true);
  });

  // Enough data, and what it says is "retrying never worked" — which is a conclusion the caller must not read
  // as a licence to raise the budget.
  it('refuses when no automatic retry has EVER succeeded, however much data there is', () => {
    const runs = [runWith(settled(50, 3, 'auto', 'failed'))];
    const r = assessRetryBudget(runs);
    expect(r.conclusive).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/no automatic retry has ever succeeded/);
  });

  it('suggests the SMALLEST budget reaching 95% of automatic successes', () => {
    const runs = [runWith([...settled(19, 1, 'auto'), ...settled(1, 5, 'auto')])];
    const r = assessRetryBudget(runs);
    expect(r.conclusive).toBe(true);
    expect(r.suggestedBudget).toBe(1); // 19/20 = 95%, so one attempt already clears the bar
  });

  it('agrees with gate-health on how much data is enough', () => {
    expect(requiredObservations(0.5, 0.1)).toBe(requiredObservations(0.5, 0.1));
    expect(requiredObservations(0.5, 0.05)).toBeGreaterThan(requiredObservations(0.5, 0.1));
  });
});

describe('the rendering says what is missing', () => {
  it('names the blockers rather than printing a number', () => {
    const text = renderRetryHealth(assessRetryBudget([])).join('\n');
    expect(text).toMatch(/NOT CONCLUSIVE — the default stays where it is/);
    expect(text).not.toMatch(/would reach 95%/);
  });

  it('prints the budget only when the evidence carries it', () => {
    const runs = [runWith(settled(MIN_OBSERVATIONS, 1, 'auto'))];
    expect(renderRetryHealth(assessRetryBudget(runs)).join('\n')).toMatch(/a budget of 1 would reach 95%/);
  });
});
