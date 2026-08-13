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
 *
 * RETURNS NULL IN EXACTLY THREE CASES, and the list is the whole claim — an earlier draft opened with
 * "returns null when no answer exists", which is wider than any guard here and is corrected below:
 *
 *   1. `baseRate + mdd >= 1`. The formula sizes the comparison arm at `baseRate + mdd`, so past 1 there
 *      is no such arm and any number describes an impossible effect. It used to return one — `pbar` hit
 *      its clamp, `pbar * (1 - pbar)` collapsed and the numerator with it, so a 98% base rate answered
 *      `1`. The comparison is `>=`, NOT `>`: at exactly 1 the arm is a point mass at 1.0, its variance
 *      `q(1 - q)` is exactly zero, and "80% power, two-sided" is not defined against a point mass. The
 *      formula still emitted 153 there only because `pbar` averages the degenerate arm with the live one
 *      — the same averaging that produced the `1`. Such an arm also yields zero failures at every n, so
 *      `compareProportions` below would refuse it forever; the estimator must not name an n at which
 *      this module's own validity rule can never be met.
 *   2. either argument is not finite.
 *   3. `mdd <= 0`, or `baseRate` outside `[0, 1]`. A zero effect needs infinite n — that is a refusal,
 *      not a default. `Number(mdd) || 0.05` silently turned an explicit `mdd = 0` into a sample size for
 *      a 5-point effect the caller never asked about, and `minDetectableDiff` is a declared numeric input
 *      with no minimum, so that substitution was reachable from the shipped surface.
 *
 * THE ARGUMENTS ARE GUARDED AS PASSED, before any clamp. Clamping first made the guard test a different
 * pair than the caller supplied, in both directions: `(0.9999999, 1e-6)` sums past 1 and was answered
 * because the upper clamp pulled the base rate back, and `(0, 1)` sums to exactly 1 and was refused
 * because the lower clamp pushed it up. There are now no clamps, so the stated rule is the implemented one.
 *
 * WHAT THIS STILL DOES NOT COVER, so nobody reads the refusals as completeness:
 *
 *   - **The low end.** `pbar = p + d / 2` places the comparison arm ABOVE the base rate, so the formula is
 *     one-directional by construction and a `baseRate - mdd` below 0 is outside what it models.
 *   - **This module's own ≥5-successes-and-≥5-failures rule** (see `compareProportions`). The returned n
 *     is the POWER requirement and nothing else; the textbook formula carries no validity floor, and at
 *     high base rates the two diverge. `requiredNPerGroup(0.94, 0.05)` is 212, but an arm at 0.99 expects
 *     only 2.12 failures at n=212, so `compareProportions` still refuses there. A caller that needs both
 *     must apply `n >= 5 / min(p, 1 - p, p + d, 1 - (p + d))` itself. Folding that floor in here would
 *     change shipped constants (`requiredNPerGroup(0.044, 0.2)` 49 → 114) and is a modelling call, not a
 *     bug fix — filed on the card rather than decided in a review round.
 *
 * @returns {number|null} observations per group, or null in the three cases above.
 */
export function requiredNPerGroup(baseRate, mdd = 0.05) {
  const p = Number(baseRate);
  const d = Number(mdd);
  if (!Number.isFinite(p) || !Number.isFinite(d)) return null;
  if (d <= 0 || p < 0 || p > 1) return null;
  if (p + d >= 1) return null;
  const pbar = p + d / 2;
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
  // CORPUS-WIDE, and named as such. `baseRate` above is pooled across all five bands AND across both arms,
  // so this figure describes the corpus, not any band and not any one arm. Kept because it is the headline
  // an operator quotes, but the BLOCKER no longer speaks from it — see `bandNeeds`.
  const required = requiredNPerGroup(baseRate, mdd);

  // PER BAND, AND FROM THE CLEAN ARM (PR #1203 review, finding 1). The blocker asks a per-band question —
  // "PRs per group per band" — and answering it from the pooled rate made a categorical claim out of a
  // population the decision does not use. Demonstrated: 80 records at 98.75% plus 20 at 10% pools to 81%,
  // which refuses outright, while the `xs` band's own 10% needs 63 per group. The old text said "~33 per
  // group per band" — an under-estimate pointing the right way; the categorical version points the wrong
  // way and reads as "collecting more data is futile", which is the worst thing this module can say.
  //
  // The CLEAN arm specifically, not the band pooled across arms: the formula sizes a comparison against a
  // control at `baseRate` and a treatment at `baseRate + mdd`, so the control arm's rate is the base rate
  // it means. Pooling the two arms feeds the comparison its own answer.
  const bandNeeds = SIZE_BANDS.map(([label]) => {
    const { n, k } = bands[label].clean;
    if (!n) return null;
    const rate = k / n;
    return { band: label, baseRate: rate, requiredNPerGroup: requiredNPerGroup(rate, mdd) };
  }).filter(Boolean);

  if (!testable.length) {
    const answerable = bandNeeds.filter((b) => b.requiredNPerGroup !== null);
    // The REACHABLE one — the band that needs the fewest. "No sample size would do" is a claim about every
    // band at once, so it may only be made when every band refuses.
    const easiest = answerable.length
      ? answerable.reduce((a, b) => (b.requiredNPerGroup < a.requiredNPerGroup ? b : a))
      : null;
    const step = Math.round(mdd * 100);
    let need;
    if (easiest) {
      need = `the nearest band is \`${easiest.band}\`, whose clean arm sits at ${(100 * easiest.baseRate).toFixed(1)}% — ~${easiest.requiredNPerGroup} PRs per group there would detect a ${step}-point difference`;
    } else if (bandNeeds.length) {
      need = `no sample size would detect a ${step}-point rise in ANY band — every band's clean arm is already within ${step} points of 100%`;
    } else {
      need = `no band holds a single clean-arm observation, so there is no rate to size against`;
    }
    blockers.push(`insufficient observations — no size band reaches 5 defects and 5 non-defects in both groups at a ${(100 * baseRate).toFixed(1)}% corpus-wide base rate; ${need}`);
  }

  // `obs.observed` is the working set, not a result. Returning it put all 300 records inside the finding a
  // web caller renders — kilobytes of payload to say "23% were observable".
  const { observed, ...observability } = obs;
  return {
    window: { prs: all.length, escalated: all.filter((r) => r.escalated).length, clean: all.filter((r) => !r.escalated).length },
    observability: { ...observability, observed: observed.length },
    clustering: cluster,
    multiplicity: { bandsTested: testable.length, alphaPerBand: alpha, uncorrectedFamilyWise: 1 - (0.95 ** (testable.length || 1)) },
    // `baseRate`/`requiredNPerGroup` are CORPUS-WIDE — pooled across bands and across arms. `perBand` is the
    // pair the blocker speaks from: one entry per band that has any clean-arm record, sized from that arm's
    // own rate. A reader wanting "how far off are we" wants `perBand`; the corpus figure is the headline.
    power: { baseRate, minDetectableDiff: mdd, requiredNPerGroup: required, perBand: bandNeeds },
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
