/**
 * @file scripts/lib/gate-health.mjs
 * @description Are the review-escalation criteria selecting the RIGHT pull requests? The pure analysis half —
 *   no `gh`, no `git`, no clock. Every function here takes already-read data and returns numbers.
 *
 * ── WHY THIS EXISTS, AND WHY THE FIRST ATTEMPT WAS WRONG ────────────────────────────────────────────────────
 *
 * The obvious measurement is: "how often is a merged PR followed by a fix touching its files?", split by
 * whether the rubric escalated it. Run naively over 300 merged PRs it returns 23% for escalated versus 7% for
 * clean — a clean-looking 3× signal that the criteria are picking real risk.
 *
 * That number is not trustworthy, for two reasons visible in its own output, and BOTH are encoded as
 * corrections below rather than left as caveats in a report nobody re-reads:
 *
 *  1. **The follow-ups are the review working, not the PR failing.** The commits it counts are named
 *     `fix-live-review-findings` and `small-owed-fixes`. An escalated PR gets reviewed, the review finds
 *     things, and those become fix commits. Counting them as evidence the PR was risky is circular: it credits
 *     the criteria for an effect they CAUSED. {@link classifyFollowUp} separates the two populations, and
 *     {@link compareGroups} takes only the independent half as the defect signal.
 *
 *  2. **Escalated PRs are simply bigger** — a median of 18 changed files against 2. More surface means more
 *     chance of intersecting any later commit whatsoever, defect or not. Comparing the raw rates measures
 *     size, not the criteria. {@link stratifyBySize} bands the PRs first so the comparison happens between
 *     like-sized PRs, which is the only form of it that carries information.
 *
 * ── AND WHY IT REPORTS UNCERTAINTY RATHER THAN A NUMBER ─────────────────────────────────────────────────────
 *
 * Split 300 PRs into size bands and then into escalated/clean, and a cell holds a few dozen. At that n, an
 * 8-point difference in rates is indistinguishable from noise, and a tool that prints `23% vs 7%` invites a
 * parameter change on evidence that cannot support one. {@link compareProportions} returns a 95% interval on
 * the DIFFERENCE and a `separated` flag that is true only when that interval excludes zero. Nothing in this
 * module ever calls a difference real on the point estimate alone.
 *
 * This matters more, not less, once review parameters are per-project and A/B-tested: the same arithmetic
 * decides whether a variant actually beat the control, and the failure mode — shipping a parameter change on
 * a difference that was noise — is exactly what an underpowered comparison manufactures.
 *
 * ── WHAT IT CANNOT DO, STATED HERE SO NO CALLER INFERS OTHERWISE ────────────────────────────────────────────
 *
 * It cannot attribute an outcome to a PARAMETER SET. The escalation record stamped on a PR carries the reason
 * strings and nothing else — `review-policy.contract.json` has a `version` field and no code reads it. So a
 * threshold change silently splits the history into incomparable halves with no marker at the seam.
 * {@link assessCriteria} reports `parameterSet: null` for exactly this reason, and a caller must treat the
 * whole window as ONE unlabelled configuration. Retrospective A/B is not possible until that is stamped.
 */

/**
 * The size bands the comparison is stratified over, as `[label, minLines]` ordered LARGEST FIRST so the first
 * match wins. Chosen against the observed distribution, not round numbers for their own sake: the escalated
 * median is ~1166 changed lines and the clean median ~69, so the bands have to be fine-grained at the small
 * end — that is where the two populations actually overlap and where a comparison can say anything.
 */
export const SIZE_BANDS = Object.freeze([
  ['xl', 1000],
  ['l', 400],
  ['m', 150],
  ['s', 50],
  ['xs', 0],
]);

/** Which band a changed-line count falls in. Pure. */
export function bandOf(lines) {
  const n = Number(lines) || 0;
  for (const [label, min] of SIZE_BANDS) if (n >= min) return label;
  return 'xs';
}

/**
 * Commit subjects that mean "somebody fixed something". Deliberately broad — a missed defect costs more than
 * a false one here, because the two groups share the false-positive rate and the COMPARISON is what is read.
 */
const FIX_SUBJECT = /\b(fix|fixes|fixed|revert|reverts|regress|regression|defect|bug|broke|broken|repair|hotfix)\b/i;

/**
 * Subjects that mean "this fix exists BECAUSE a review found something". The branch-name conventions the
 * repo actually uses (`lane/fix-live-review-findings`, `lane/…-review-fix`, `lane/…-review-followup-…`)
 * surface in the merge subject, so they are matchable without reading PR bodies.
 */
const REVIEW_FOLLOWUP = /review[-\s]?(finding|fix|followup|follow-up)|(finding|fix)[-\s]?review/i;

/**
 * Classify a candidate follow-up commit against a merged PR.
 *
 * Three outcomes, and the middle one is the whole point of the function:
 *  - `'review-followup'` — a fix that exists because a reviewer asked for it. **Evidence the gate WORKED.**
 *    Counting it as a defect credits the criteria for an effect they caused (see the file header).
 *  - `'independent-fix'` — a fix with no review provenance in its subject. The honest defect signal.
 *  - `null` — not a fix at all.
 *
 * The classification reads only the SUBJECT, which is a real limit: a review-driven fix landed on a branch
 * named something else is counted as independent, biasing the escalated group's defect rate UPWARD. That is
 * the conservative direction — it works against the conclusion "the criteria are good" — so it is left rather
 * than papered over with a fuzzier matcher that would misclassify in both directions.
 *
 * @param {string} subject - the follow-up commit's subject line.
 * @returns {'review-followup'|'independent-fix'|null}
 */
export function classifyFollowUp(subject) {
  const s = String(subject ?? '');
  if (REVIEW_FOLLOWUP.test(s)) return 'review-followup';
  if (FIX_SUBJECT.test(s)) return 'independent-fix';
  return null;
}

/**
 * Group merged-PR records into `{ band: { escalated: [], clean: [] } }`.
 *
 * @param {Array<{lines:number, escalated:boolean}>} records
 * @returns {Record<string, {escalated: Array<object>, clean: Array<object>}>}
 */
export function stratifyBySize(records) {
  const out = {};
  for (const [label] of SIZE_BANDS) out[label] = { escalated: [], clean: [] };
  for (const r of Array.isArray(records) ? records : []) {
    const band = out[bandOf(r.lines)];
    (r.escalated ? band.escalated : band.clean).push(r);
  }
  return out;
}

/**
 * A 95% confidence interval on the DIFFERENCE between two proportions (normal approximation, unpooled
 * standard error).
 *
 * `separated` is the only field a caller should branch on. It is true when the interval excludes zero — i.e.
 * when the data can actually distinguish the two rates. Everything else is descriptive.
 *
 * The normal approximation is unreliable when a cell is tiny or a rate is pinned at 0 or 1, so `usable`
 * reports whether the standard textbook condition (at least 5 expected successes AND 5 failures per group)
 * holds. When it does not, `separated` is forced FALSE rather than computed: an interval from an invalid
 * approximation that happens to exclude zero is the single most dangerous output this module could produce.
 *
 * @param {{n:number, k:number}} a - group A: `n` trials, `k` successes.
 * @param {{n:number, k:number}} b - group B.
 * @returns {{rateA:number|null, rateB:number|null, diff:number|null, ci95:[number,number]|null,
 *   separated:boolean, usable:boolean, note:string}}
 */
export function compareProportions(a, b) {
  const nA = Math.max(0, Math.floor(Number(a?.n) || 0));
  const nB = Math.max(0, Math.floor(Number(b?.n) || 0));
  const kA = Math.min(nA, Math.max(0, Math.floor(Number(a?.k) || 0)));
  const kB = Math.min(nB, Math.max(0, Math.floor(Number(b?.k) || 0)));
  if (nA === 0 || nB === 0) {
    return { rateA: null, rateB: null, diff: null, ci95: null, separated: false, usable: false, note: 'one group is empty — nothing to compare' };
  }
  const pA = kA / nA;
  const pB = kB / nB;
  const usable = Math.min(kA, nA - kA, kB, nB - kB) >= 5;
  const se = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  const diff = pA - pB;
  const lo = diff - 1.96 * se;
  const hi = diff + 1.96 * se;
  return {
    rateA: pA,
    rateB: pB,
    diff,
    ci95: [lo, hi],
    // Forced false on an unusable approximation — see the docblock. An underpowered cell must read as
    // "we cannot tell", never as a result.
    separated: usable && (lo > 0 || hi < 0),
    usable,
    note: usable
      ? (lo > 0 || hi < 0 ? 'the interval excludes zero — the rates differ' : 'the interval spans zero — indistinguishable at this n')
      : `too few observations for a normal approximation (need ≥5 successes AND ≥5 failures per group; have ${kA}/${nA - kA} and ${kB}/${nB - kB})`,
  };
}

/**
 * Compare escalated against clean within ONE size band, using only the independent-fix signal.
 *
 * @param {{escalated: Array<object>, clean: Array<object>}} band
 * @returns {object}
 */
export function compareGroups(band) {
  const count = (list) => ({
    n: list.length,
    // The DEFECT signal. `review-followup` follow-ups are deliberately NOT counted — see `classifyFollowUp`.
    k: list.filter((r) => r.followUp === 'independent-fix').length,
    reviewDriven: list.filter((r) => r.followUp === 'review-followup').length,
  });
  const esc = count(band.escalated ?? []);
  const cln = count(band.clean ?? []);
  return {
    escalated: esc,
    clean: cln,
    // Read as: does escalating a PR of THIS SIZE correlate with it needing an independent fix afterwards?
    comparison: compareProportions({ n: esc.n, k: esc.k }, { n: cln.n, k: cln.k }),
  };
}

/**
 * The whole assessment. Returns per-band comparisons plus a plain verdict on whether the data supports any
 * conclusion at all.
 *
 * @param {object} o
 * @param {Array<object>} o.records - one per merged PR: `{number, title, lines, files, escalated, followUp}`.
 * @param {string|null} [o.parameterSet] - which policy version scored these PRs. Today ALWAYS null: nothing
 *   stamps it (see the file header). Present so the field exists the day it can be filled.
 * @returns {object}
 */
export function assessCriteria({ records, parameterSet = null } = {}) {
  const list = Array.isArray(records) ? records : [];
  const strata = stratifyBySize(list);
  const bands = {};
  for (const [label] of SIZE_BANDS) bands[label] = compareGroups(strata[label]);

  const separated = Object.entries(bands).filter(([, b]) => b.comparison.separated);
  const usable = Object.entries(bands).filter(([, b]) => b.comparison.usable);

  return {
    window: {
      prs: list.length,
      escalated: list.filter((r) => r.escalated).length,
      clean: list.filter((r) => !r.escalated).length,
    },
    // Null until the escalation record carries the contract version. A caller MUST treat the window as one
    // unlabelled configuration — if a threshold moved inside it, two regimes are being averaged together and
    // nothing here can tell.
    parameterSet,
    parameterSetCaveat: parameterSet === null
      ? 'UNKNOWN — nothing stamps the policy-contract version onto a PR, so this window may span more than one parameter set with no marker at the seam. Retrospective A/B is not possible until it is stamped.'
      : null,
    bands,
    verdict: {
      // The honest headline. Almost always this, at these sample sizes — which IS the finding: the criteria
      // cannot be tuned from this much history, and the tool says so instead of producing a number.
      conclusive: separated.length > 0,
      bandsWithEnoughData: usable.map(([label]) => label),
      bandsShowingADifference: separated.map(([label]) => label),
      summary: separated.length > 0
        ? `escalation correlates with later independent fixes in size band(s): ${separated.map(([l]) => l).join(', ')}`
        : usable.length > 0
          ? 'no size band shows a distinguishable difference — at this sample size the criteria cannot be shown to select riskier PRs, nor shown not to'
          : 'no size band has enough observations to support any comparison; collect more history before tuning a threshold',
    },
  };
}
