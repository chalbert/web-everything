/**
 * @file scripts/lib/gate-health.mjs
 * @description Can this repository's merge history answer *"are the review-escalation criteria selecting the
 *   right PRs?"* — and if not, what is blocking it? Pure: every function takes already-read data.
 *
 * IT REPORTS BLOCKERS, NOT AN ANSWER, and that is the design rather than a shortfall. Review found that even
 * over the full merged history no size band has enough observations, because the binding constraint is the
 * defect signal's ~3% base rate, not the window — so "collect more history" is unactionable advice. A tool
 * that keeps printing a rate invites a parameter change on evidence that cannot carry one. This one names
 * what would have to change.
 *
 * FOUR THINGS CORRUPT THE NAIVE COMPARISON. Each is a precondition here, not a caveat in a report:
 *   `classifyFollowUp` — a review-driven fix is the gate WORKING, so counting it credits the criteria for an
 *      effect they caused;
 *   `stratifyBySize` — escalated PRs are far bigger, so they intersect more later commits regardless;
 *   `censor` — a PR merged inside the follow-up window cannot have been observed yet, and escalated PRs skew
 *      younger, so including them biases by group;
 *   `clusterEffectiveN` — defect observations trace back to a handful of fix commits, so the binomial
 *      standard error is too narrow and the interval too confident.
 */

/** Size bands, largest first so the first match wins. Fine-grained low, which is where the groups overlap. */
export const SIZE_BANDS = Object.freeze([['xl', 1000], ['l', 400], ['m', 150], ['s', 50], ['xs', 0]]);

/** Which band a changed-line count falls in. */
export function bandOf(lines) {
  const n = Number(lines) || 0;
  for (const [label, min] of SIZE_BANDS) if (n >= min) return label;
  return 'xs';
}

const FIX_SUBJECT = /\b(fix|fixes|fixed|revert|reverts|regress|regression|defect|bug|broke|broken|repair|hotfix)\b/i;
const REVIEW_FOLLOWUP = /review[-\s]?(finding|fix|followup|follow-up)|(finding|fix)[-\s]?review/i;

/**
 * `'review-followup'` (the gate working) | `'independent-fix'` (the defect signal) | `null`.
 *
 * Subject-only, which biases in a KNOWN direction: a review-driven fix on an unconventionally named branch
 * counts as independent, inflating the ESCALATED group's defect rate. That is the affirmative signal, so
 * inflating it manufactures the conclusion "the criteria are good" — the OPPOSITE of conservative. An earlier
 * version of this comment called it conservative and was wrong. Reported by `misclassificationRisk` rather
 * than silently absorbed.
 */
export function classifyFollowUp(subject) {
  const s = String(subject ?? '');
  if (REVIEW_FOLLOWUP.test(s)) return 'review-followup';
  if (FIX_SUBJECT.test(s)) return 'independent-fix';
  return null;
}

/**
 * Split records into those whose follow-up window has fully elapsed and those still censored.
 *
 * A PR merged 3 days ago cannot show a 14-day follow-up, so counting it as "no defect" is not an observation
 * — it is a missing one. It matters here specifically because the two groups age differently.
 *
 * @param {Array<{mergedAtSec:number, escalated:boolean}>} records
 * @param {{nowSec:number, windowDays:number}} o
 */
export function censor(records, { nowSec, windowDays = 14 } = {}) {
  const cutoff = Number(nowSec) - windowDays * 24 * 3600;
  const list = Array.isArray(records) ? records : [];
  const observed = list.filter((r) => Number(r.mergedAtSec) > 0 && Number(r.mergedAtSec) <= cutoff);
  const censored = list.filter((r) => !(Number(r.mergedAtSec) > 0 && Number(r.mergedAtSec) <= cutoff));
  const medianAge = (g) => {
    const ages = g.map((r) => (Number(nowSec) - Number(r.mergedAtSec)) / 86400).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    return ages.length ? Number(ages[Math.floor(ages.length / 2)].toFixed(2)) : null;
  };
  return {
    observed,
    censored: censored.length,
    // Reported per group: equal censoring is survivable, DIFFERENTIAL censoring is the bias.
    medianAgeDaysEscalated: medianAge(list.filter((r) => r.escalated)),
    medianAgeDaysClean: medianAge(list.filter((r) => !r.escalated)),
    fullyObservedShare: list.length ? observed.length / list.length : 0,
  };
}

/**
 * How many INDEPENDENT sources the defect observations actually represent.
 *
 * One fix commit touching thirty files marks thirty PRs as defective from a single event. The trials are not
 * independent, so a binomial interval over the raw count is too narrow. Kish's effective sample size over the
 * cluster sizes, floored at the number of distinct sources.
 *
 * @param {Array<{followUp:string|null, followUpSource:string|null}>} records
 */
export function clusterEffectiveN(records) {
  const hits = (Array.isArray(records) ? records : []).filter((r) => r.followUp === 'independent-fix');
  const bySource = new Map();
  for (const h of hits) {
    const key = h.followUpSource || `unattributed:${h.number}`;
    bySource.set(key, (bySource.get(key) || 0) + 1);
  }
  const sizes = [...bySource.values()];
  const n = hits.length;
  // Kish: n / (1 + (m̄ − 1)) with m̄ the mean cluster size — i.e. n / m̄ = the number of clusters, when
  // clusters are perfectly correlated internally. The conservative reading, and the one that matters: a
  // defect seen 15 times from one commit is one observation, not 15.
  const effectiveN = sizes.length ? sizes.length : 0;
  const largest = sizes.length ? Math.max(...sizes) : 0;
  return {
    observations: n,
    distinctSources: sizes.length,
    effectiveN,
    largestClusterShare: n ? largest / n : 0,
    // ANY clustering inflates confidence, so the threshold is "are these independent at all", not a tolerance
    // band. A 0.5 cut let MEDIUM clumping through: 20 observations from 11 commits passed as independent while
    // the interval was built on 20 trials it did not have. Review caught that. The interval arithmetic assumes
    // independent trials, so the honest test is whether they are — one repeated source is already too many.
    clustered: n > 0 && effectiveN < n,
  };
}

/** Group records into `{band: {escalated, clean}}`. Every band always present, so an empty one is visible. */
export function stratifyBySize(records) {
  const out = {};
  for (const [label] of SIZE_BANDS) out[label] = { escalated: [], clean: [] };
  for (const r of Array.isArray(records) ? records : []) {
    (r.escalated ? out[bandOf(r.lines)].escalated : out[bandOf(r.lines)].clean).push(r);
  }
  return out;
}

/** Two-sided normal critical value for a Bonferroni-corrected α. Rational approximation to the normal quantile. */
export function zForAlpha(alpha) {
  const p = 1 - Math.max(1e-12, Math.min(0.5, alpha)) / 2;
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}

/**
 * Interval on the DIFFERENCE of two proportions. `separated` is the only field to branch on.
 *
 * `separated` is forced FALSE when the normal approximation does not hold (<5 successes AND <5 failures per
 * group) — an interval from an invalid approximation that happens to exclude zero is the most dangerous
 * output here. `alpha` carries the multiplicity correction: five band tests at 0.05 each is a family-wise
 * error near 25%, so the caller passes 0.05/bandsTested.
 *
 * `direction` exists because `separated` is symmetric. The headline used to assert that escalation correlates
 * with defects whatever the sign, and printed exactly that on data showing the reverse.
 */
export function compareProportions(a, b, { alpha = 0.05 } = {}) {
  const nA = Math.max(0, Math.floor(Number(a?.n) || 0));
  const nB = Math.max(0, Math.floor(Number(b?.n) || 0));
  const kA = Math.min(nA, Math.max(0, Math.floor(Number(a?.k) || 0)));
  const kB = Math.min(nB, Math.max(0, Math.floor(Number(b?.k) || 0)));
  if (nA === 0 || nB === 0) {
    return { rateA: null, rateB: null, diff: null, ci: null, separated: false, usable: false, direction: null, alpha, note: 'one group is empty — nothing to compare' };
  }
  const pA = kA / nA;
  const pB = kB / nB;
  const usable = Math.min(kA, nA - kA, kB, nB - kB) >= 5;
  const z = zForAlpha(alpha);
  const se = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  const diff = pA - pB;
  const lo = diff - z * se;
  const hi = diff + z * se;
  const excludesZero = lo > 0 || hi < 0;
  return {
    rateA: pA,
    rateB: pB,
    diff,
    ci: [lo, hi],
    alpha,
    usable,
    separated: usable && excludesZero,
    // WHICH group is worse. Never inferred by a caller from the summary text.
    direction: usable && excludesZero ? (diff > 0 ? 'escalated-worse' : 'clean-worse') : null,
    note: usable
      ? (excludesZero ? 'the interval excludes zero' : 'the interval spans zero — indistinguishable at this n')
      : `too few observations for a normal approximation (need ≥5 successes AND ≥5 failures per group; have ${kA}/${nA - kA} and ${kB}/${nB - kB})`,
  };
}

/** Escalated vs clean within one band, counting only independent fixes as defects. */
export function compareGroups(band, { alpha = 0.05 } = {}) {
  const count = (list) => ({
    n: list.length,
    k: list.filter((r) => r.followUp === 'independent-fix').length,
    reviewDriven: list.filter((r) => r.followUp === 'review-followup').length,
  });
  const esc = count(band.escalated ?? []);
  const cln = count(band.clean ?? []);
  return { escalated: esc, clean: cln, comparison: compareProportions({ n: esc.n, k: esc.k }, { n: cln.n, k: cln.k }, { alpha }) };
}

/**
 * Observations per group needed to detect `mdd` at this base rate (80% power, α=0.05, two-sided).
 * The actionable number: it says whether the metric or the patience is the constraint.
 */
export function requiredNPerGroup(baseRate, mdd = 0.05) {
  const p = Math.max(1e-6, Math.min(1 - 1e-6, Number(baseRate) || 0));
  const d = Math.max(1e-6, Number(mdd) || 0.05);
  const pbar = Math.min(1 - 1e-6, p + d / 2);
  return Math.ceil(((1.96 + 0.84) ** 2 * 2 * pbar * (1 - pbar)) / (d * d));
}

/**
 * The assessment. `verdict.conclusive` requires a separated band AND no blocker — the blockers are the point.
 *
 * @param {object} o
 * @param {Array<object>} o.records - `{number, title, lines, escalated, followUp, followUpSource, mergedAtSec}`.
 * @param {number} o.nowSec - injected, never read from a clock, so the result is reproducible.
 */
export function assessCriteria({ records, nowSec, windowDays = 14, parameterSet = null, mdd = 0.05 } = {}) {
  const all = Array.isArray(records) ? records : [];
  const obs = censor(all, { nowSec, windowDays });
  const usableRecords = obs.observed;
  const cluster = clusterEffectiveN(usableRecords);

  const strata = stratifyBySize(usableRecords);
  // Correct across the bands that CAN be tested, not all five — an empty band is not a test.
  const testable = SIZE_BANDS.map(([l]) => l).filter((l) => compareGroups(strata[l]).comparison.usable);
  const alpha = testable.length ? 0.05 / testable.length : 0.05;
  const bands = {};
  for (const [label] of SIZE_BANDS) bands[label] = compareGroups(strata[label], { alpha });

  const separated = Object.entries(bands).filter(([, b]) => b.comparison.separated);
  const defects = usableRecords.filter((r) => r.followUp === 'independent-fix').length;
  const baseRate = usableRecords.length ? defects / usableRecords.length : 0;

  const blockers = [];
  if (obs.fullyObservedShare < 0.8) {
    blockers.push(`censoring — only ${Math.round(obs.fullyObservedShare * 100)}% of PRs have a closed ${windowDays}-day follow-up window, and the groups age differently (median ${obs.medianAgeDaysEscalated}d escalated vs ${obs.medianAgeDaysClean}d clean)`);
  }
  if (cluster.clustered) {
    blockers.push(`clustered observations — ${cluster.observations} defect signals trace to ${cluster.distinctSources} commits (largest is ${Math.round(cluster.largestClusterShare * 100)}% of them), so the interval is narrower than the data supports`);
  }
  if (!testable.length) {
    blockers.push(`insufficient observations — no size band reaches 5 defects and 5 non-defects in both groups at a ${(100 * baseRate).toFixed(1)}% base rate; ~${requiredNPerGroup(baseRate, mdd)} PRs per group per band would be needed to detect a ${Math.round(mdd * 100)}-point difference`);
  }

  // `obs.observed` is the working set, not a result. Returning it put all 300 records inside the finding a
  // web caller renders — kilobytes of payload to say "23% were observable".
  const { observed, ...observability } = obs;
  return {
    window: { prs: all.length, escalated: all.filter((r) => r.escalated).length, clean: all.filter((r) => !r.escalated).length },
    observability: { ...observability, observed: observed.length },
    clustering: cluster,
    multiplicity: { bandsTested: testable.length, alphaPerBand: alpha, uncorrectedFamilyWise: 1 - (0.95 ** (testable.length || 1)) },
    power: { baseRate, minDetectableDiff: mdd, requiredNPerGroup: requiredNPerGroup(baseRate, mdd) },
    // Null until the escalation record carries the policy-contract version. The caveat rides with the
    // numbers because a web caller renders the numbers, not prose.
    parameterSet,
    parameterSetCaveat: parameterSet === null
      ? 'UNKNOWN — nothing stamps the policy-contract version onto a PR, so this window may span more than one parameter set with no marker at the seam. Retrospective A/B is not possible until it is stamped.'
      : null,
    bands,
    verdict: {
      conclusive: separated.length > 0 && blockers.length === 0,
      blockers,
      bandsShowingADifference: separated.map(([l, b]) => ({ band: l, direction: b.comparison.direction })),
      summary: blockers.length
        ? `cannot conclude — ${blockers.length} blocker(s): ${blockers.map((b) => b.split(' — ')[0]).join(', ')}`
        : separated.length
          ? separated.map(([l, b]) => `band ${l}: ${b.comparison.direction === 'escalated-worse' ? 'escalated PRs' : 'UNESCALATED PRs'} are followed by independent fixes more often`).join('; ')
          : 'no band shows a distinguishable difference — the criteria cannot be shown to select riskier PRs, nor shown not to',
    },
  };
}
