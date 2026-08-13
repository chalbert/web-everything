/**
 * @file scripts/operations/retry-health.mjs
 * @description WHAT SHOULD THE RETRY BUDGET BE — answered from observations, or refused (#3083).
 *
 * #3083 has to choose how many times a failed effect may be re-attempted automatically. There is no basis for
 * that number today: nothing dispatches yet, so the corpus holds ZERO retry observations. Guessing it and
 * calling it a default would be the same defect this repo keeps paying for — a claim wider than its evidence.
 *
 * So this does not choose. It reads what the executor records and answers one question: **of effects that
 * eventually succeeded, which attempt did they succeed on?** When there are too few observations it says so
 * and stops, the same discipline `we:scripts/lib/gate-health.mjs` applies to its own question.
 *
 * TWO POPULATIONS, NEVER AVERAGED. `attemptedBy` splits them, and conflating them is the trap this exists to
 * avoid:
 *   - AUTO — a timer re-attempted an unchanged situation. Succeeding on attempt 2 means the failure was
 *     flaky, and a budget of 2 would have caught it. This is the population a default is FOR.
 *   - HUMAN — an operator re-ran after fixing the cause. Succeeding on attempt 2 usually means the world
 *     changed, and no budget would ever have helped. Counting these inflates the answer.
 *
 * ONE ENTRY CAN BELONG TO BOTH, and the first cut got this wrong: it filed a mixed entry wholly under
 * whichever population attempted LAST, carrying the other's attempts in its count. Each population now has
 * its own count, and the SUCCESS belongs only to whoever made the final attempt — the other's attempts all
 * failed, which is itself evidence.
 * A default derived from the pooled distribution is too high, and too high is the expensive direction: the
 * measured failure mode was eleven dispatches over ten ticks at exit 0.
 *
 * PURE. Takes run records, returns a report. The caller reads the store.
 */

/**
 * Fewer observations than this and no distribution is worth reading. Deliberately blunt: the precise number
 * comes from {@link requiredObservations} once a base rate exists, and until then a floor is more honest than
 * a formula applied to nothing.
 */
export const MIN_OBSERVATIONS = 20;

/**
 * And a floor on the SUCCESSES, because `wouldCatch`'s denominator is the success count, not the settled
 * count (PR #1195 review, blocking 2). Without it 10,000 automatic failures and exactly ONE success at
 * attempt 7 cleared every guard and suggested a budget of 7 — a recommendation resting on a single
 * observation, offered with no hedge.
 *
 * A coverage fraction over n successes cannot distinguish 95% from 100% until n is at least 20, so this is
 * the same number for the same reason, applied to the denominator that is actually used.
 */
export const MIN_SUCCESSES = 20;

/** Every effect entry across the given runs that carries an attempt count. */
export function attemptObservations(runs = []) {
  const out = [];
  for (const run of runs) {
    for (const e of (run?.effects ?? [])) {
      const attempts = Number(e?.attempts);
      if (!Number.isInteger(attempts) || attempts < 1) continue;
      // Only a SETTLED entry answers the question. One still in flight has not succeeded or failed yet, and
      // counting it as a failure at attempt N would read a slow success as a permanent one.
      const settled = e.status === 'applied' || e.status === 'failed';
      const lastBy = e.lastAttemptBy === 'auto' ? 'auto' : 'human';
      // ONE ENTRY, UP TO TWO OBSERVATIONS — one per population that touched it. A mixed entry contributes
      // honestly to both instead of being filed wholly into whichever attempted last.
      //
      // `succeeded` belongs ONLY to the population that made the final attempt, because that is the attempt
      // whose outcome settled. The other population's attempts are real and all of them failed, which is
      // exactly the evidence a budget needs.
      for (const by of ['auto', 'human']) {
        const n = Number(by === 'auto' ? e.autoAttempts : e.humanAttempts);
        if (!Number.isInteger(n) || n < 1) continue;
        out.push({
          runId: run.id,
          op: run.op,
          key: e.key,
          type: e.type,
          attempts: n,
          by,
          settled,
          succeeded: settled && e.status === 'applied' && lastBy === by,
        });
      }
    }
  }
  return out;
}

/**
 * How many observations before a difference of `mdd` is real. Thin wrapper over the same arithmetic
 * `gate-health` uses, so the two questions cannot drift on what counts as enough.
 */
export function requiredObservations(baseRate, mdd = 0.1) {
  const p = Math.max(1e-6, Math.min(1 - 1e-6, Number(baseRate) || 0));
  const d = Math.max(1e-6, Number(mdd) || 0.1);
  const pbar = Math.min(1 - 1e-6, p + d / 2);
  return Math.ceil(((1.96 + 0.84) ** 2 * 2 * pbar * (1 - pbar)) / (d * d));
}

/**
 * The distribution for ONE population: of the settled entries, how many succeeded at each attempt number.
 *
 * `wouldCatch[n]` is the fraction of eventual successes a budget of `n` would have reached — which is the
 * number #3083 actually wants, rather than a mean or a median. A mean over attempt counts is meaningless
 * here: the distribution is heavily skewed and the question is a coverage one.
 */
export function distributionFor(observations, by) {
  const rows = observations.filter((o) => o.by === by && o.settled);
  const successes = rows.filter((o) => o.succeeded);
  const atAttempt = new Map();
  for (const s of successes) atAttempt.set(s.attempts, (atAttempt.get(s.attempts) ?? 0) + 1);
  const maxSeen = successes.reduce((m, s) => Math.max(m, s.attempts), 0);
  const wouldCatch = {};
  let cumulative = 0;
  for (let n = 1; n <= Math.max(1, maxSeen); n += 1) {
    cumulative += atAttempt.get(n) ?? 0;
    wouldCatch[n] = successes.length ? cumulative / successes.length : 0;
  }
  return {
    by,
    settled: rows.length,
    succeeded: successes.length,
    successAtAttempt: Object.fromEntries([...atAttempt.entries()].sort((a, b) => a[0] - b[0])),
    wouldCatch,
  };
}

/**
 * THE REPORT, and it refuses rather than guesses.
 *
 * `conclusive` is false whenever the AUTO population is under {@link MIN_OBSERVATIONS} — regardless of how
 * much human data there is, because the human population cannot answer this question. That asymmetry is the
 * whole design: a large, useless corpus must not read as evidence.
 */
export function assessRetryBudget(runs = [], { min = MIN_OBSERVATIONS, minSuccesses = MIN_SUCCESSES } = {}) {
  const observations = attemptObservations(runs);
  const auto = distributionFor(observations, 'auto');
  const human = distributionFor(observations, 'human');
  const blockers = [];

  if (auto.settled < min) {
    blockers.push(
      `only ${auto.settled} settled AUTOMATIC attempt(s) — need at least ${min}. Human retries do not answer `
      + 'this: one succeeding usually means someone fixed the cause, not that the failure was flaky.',
    );
  }
  if (auto.succeeded === 0 && auto.settled >= min) {
    blockers.push('no automatic retry has ever succeeded — a budget above 1 would have bought nothing so far.');
  } else if (auto.succeeded > 0 && auto.succeeded < minSuccesses) {
    blockers.push(
      `only ${auto.succeeded} automatic retry/retries have ever SUCCEEDED — need at least ${minSuccesses}. `
      + 'The suggestion is a coverage fraction over the successes, so a large settled count does not help: '
      + `${auto.settled} settled with ${auto.succeeded} success(es) still rests the answer on ${auto.succeeded}.`,
    );
  }

  // Only offered when the evidence carries it. The smallest budget reaching 95% of eventual successes is a
  // coverage answer to a coverage question; there is deliberately no mean or median anywhere in this file.
  let suggested = null;
  if (!blockers.length) {
    suggested = Number(Object.entries(auto.wouldCatch).find(([, frac]) => frac >= 0.95)?.[0] ?? null);
  }

  return {
    observations: observations.length,
    auto,
    human,
    blockers,
    conclusive: blockers.length === 0,
    suggestedBudget: suggested,
  };
}

/** The report as operator-facing lines. PURE. Says what is missing when it cannot conclude. */
export function renderRetryHealth(report) {
  const lines = [
    `retry-health: ${report.observations} attempt observation(s) — `
    + `${report.auto.settled} automatic settled, ${report.human.settled} human settled.`,
  ];
  for (const [label, d] of [['auto', report.auto], ['human', report.human]]) {
    if (!d.settled) continue;
    const at = Object.entries(d.successAtAttempt).map(([n, c]) => `${n}→${c}`).join(', ');
    lines.push(`  ${label}: ${d.succeeded}/${d.settled} eventually succeeded${at ? ` (at attempt ${at})` : ''}`);
  }
  if (report.conclusive) {
    lines.push(`  a budget of ${report.suggestedBudget} would reach 95% of automatic successes.`);
  } else {
    lines.push('  NOT CONCLUSIVE — the default stays where it is:');
    for (const b of report.blockers) lines.push(`    · ${b}`);
  }
  return lines;
}
