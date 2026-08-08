/**
 * review-runner-core.mjs — the PURE core of the scheduled SHADOW review runner (#2830, the front slice of #2572,
 * under epic #2612). This is the DECISION half of the runner that removes the human from routing `review:pending`
 * PRs to review: the runner is a TRIGGER, not new convergence logic. The editor↔reviewer convergence loop is
 * ALREADY built (`we:scripts/workflows/review-parked-prs.mjs`, #2639) and the disposition→label→land seams are
 * ALREADY built (`disposition-land-seam.mjs` #2674, `auto-land-seam.mjs` #2675). This core only ORCHESTRATES
 * those existing pieces — it adds NO new derivation.
 *
 * WHAT LIVES HERE (all PURE — no fs, no gh, no clock; unit-tested in
 * `we:scripts/lib/__tests__/review-runner-core.test.mjs`):
 *   • `partitionRunnerPRs` — the discovery FILTER: split a discovered PR set into the agent-clearable
 *     `review:pending` class vs the `review:human` class (NEVER touched — #2439 non-author / INVARIANT 2) vs the
 *     label-UNVERIFIED class (fail-closed: a PR whose labels could not be read is never acted on). Mirrors the
 *     workflow's `filterAgentClearable`, single-sourced on `REVIEW_LABELS` / `hasReviewLabel`.
 *   • `runnerShadowPlan` — the SHADOW disposition: feed a PR's jury LEDGER through the EXISTING
 *     `decideDispositionLabel` (#2674) → intent, then the EXISTING `decideAutoLand` (#2675) with the mode FORCED
 *     to SHADOW. Both are PURE deciders, so this composition is pure AND structurally incapable of mutating: it
 *     never reaches `applyAutoLand`'s label writer. THIS is the runner's zero-mutation guarantee — the runner
 *     never passes `enforce` and never calls a writer, so in shadow it clears NOTHING regardless of config.
 *   • `summarizeLedger` / `buildShadowRecord` — the structured shadow-LOG record per PR (PR#, would-be verdict,
 *     findings summary, would-clear yes/no, `mutated:false`), reusing `reduceLedger` (#2652) for the findings +
 *     per-lens verdict projection (never re-derived).
 *
 * WHY FORCED SHADOW (not `config.landMode`): the ratified default IS shadow, but the runner does not merely
 * INHERIT that default — it hard-codes SHADOW so that even if the global mode is later flipped to `enforce`, THIS
 * runner still observes-only. Flipping the runner to act is a SEPARATE, later, ratified step (#2572 part 2); a
 * mechanical implementation slice must not be able to auto-land anything. See `runnerShadowPlan`.
 */
import { REVIEW_LABELS, hasReviewLabel, partitionAgentClearable } from './review-escalation.mjs';
import { decideDispositionLabel, LAND_ACTIONS } from './disposition-land-seam.mjs';
import { decideAutoLand, LAND_MODES } from './auto-land-seam.mjs';
import { reduceLedger, dispositionPanelVerdict } from './disposition-judge.mjs';
import { verdictStrictness } from './jury-core.mjs';

/** The agent-clearable park the runner acts on, and the human-only class it NEVER touches (fail-closed). */
export const RUNNER_PENDING = REVIEW_LABELS.pending;
export const RUNNER_HUMAN = REVIEW_LABELS.human;

/** The STRICTEST per-lens verdict for the shadow-log fallback line — diversity-selection (#2567): the strictest
 *  verdict carries (needs-human > changes > prevention-outstanding > accept). Purely descriptive, and only a
 *  FALLBACK for the case where the judge escalated before it could derive a panel verdict (no-roster / no-verdicts /
 *  missing-mandatory-lens). Uses jury-core's CANONICAL `verdictStrictness` — no hand-copied rank table (#2823): an
 *  unranked verdict THROWS loudly rather than silently ranking below accept. Lens verdicts are enum-constrained
 *  upstream (`validateJuryEvent`), so this never throws on real ledger data. */
function strictestLensVerdict(lensVerdicts) {
  const entries = Object.values(lensVerdicts || {});
  if (!entries.length) return 'unknown';
  return entries.reduce((worst, v) => (verdictStrictness(v) > verdictStrictness(worst) ? v : worst));
}

/**
 * Split a discovered parked-PR set into the AGENT-CLEARABLE `review:pending` set, the SKIPPED `review:human`
 * set, and the label-UNVERIFIED set — INVARIANT 2 / #2439, FAIL-CLOSED. PURE; reads each entry's OWN observed
 * labels (never caller-asserted state). An entry is:
 *   • UNVERIFIED (skipped) — no `labels` array at all: its labels could not be read, so we cannot PROVE it is not
 *     a `review:human` PR → never act on it.
 *   • HUMAN (skipped) — carries `review:human`: a gate-self / statute PR is a human's to clear (conflict of
 *     interest). The human check runs BEFORE the pending check, so a PR carrying BOTH is skipped as human.
 *   • CLEARABLE — has `review:pending` and is not human: the agent-clearable park the runner disposes in shadow.
 * A PR with a verified label array that carries NEITHER pending nor human is simply not this runner's business
 * (dropped silently — the runner only routes the `review:pending` class).
 *
 * SINGLE-SOURCED on `partitionAgentClearable` (`review-escalation.mjs`) — the ONE INVARIANT-2 filter the
 * convergence workflow also shares (#2823 mirror-instead-of-import). The runner's only divergence, routing just
 * the `review:pending` class, is a CALLER-SIDE filter over the shared `clearable`, not a second partition.
 *
 * @param {Array<{pr:(number|string), repo?:string, labels?:Array}>} prs
 * @returns {{ clearable: Array<{pr:number,repo:string,labels:Array}>,
 *             skippedHuman: Array<{pr:number,repo:string}>,
 *             skippedUnverified: Array<{pr:number,repo:string}> }}
 */
export function partitionRunnerPRs(prs) {
  const { clearable, skippedHuman, skippedUnverified } = partitionAgentClearable(prs);
  return {
    // caller-side narrowing: the runner routes ONLY the review:pending class (a verified non-human PR that is not
    // pending is not this runner's business — dropped silently, never surfaced as skipped).
    clearable: clearable.filter((c) => hasReviewLabel(c.labels, RUNNER_PENDING)),
    skippedHuman,
    skippedUnverified,
  };
}

/**
 * THE SHADOW DISPOSITION (#2830) — feed one PR's converged jury LEDGER through the EXISTING seams to a PLAN of
 * what the runner WOULD do, applying NOTHING. PURE — both `decideDispositionLabel` and `decideAutoLand` are pure
 * deciders, so this composition does no I/O and, critically, NEVER reaches `applyAutoLand`'s label writer.
 *
 * ZERO-MUTATION GUARANTEE: the mode is HARD-CODED to `LAND_MODES.SHADOW`. The runner does not read
 * `config.landMode` for the act/observe decision — so however the global mode is set (even `enforce`), the plan
 * this returns is always observe-only (`plan.apply === false`). A clean auto-dispose still yields
 * `plan.action === 'clear'` (it records WOULD-clear) but is never applied. Flipping the runner to act is a
 * separate ratified step; this slice cannot.
 *
 * #2844 — `authorId`/`clearerId` ride through to the seam's SELF-CLEAR rail. The runner passes whatever it can
 * observe; when it can observe neither (the common case today — a PR opened before the `authored-by-actor` stamp
 * existed), the seam records a REFUSED-to-clear shadow line instead of a WOULD-write one. That is the honest
 * dry run: it reports what an enforce runner would actually do, which is refuse.
 *
 * @param {{ ledger?: Array<object>, config: object, signals?: object, mandatoryLenses?: string[],
 *           currentLabels?: Array, authorId?: string, clearerId?: string }} o - `config` is a RESOLVED #2651
 *   disposition config (`resolveDispositionConfig`); `currentLabels` are the PR's OBSERVED labels (enforces the
 *   INVARIANT-2 refusal on the clear branch via `decideDispositionLabel`).
 * @returns {{ intent: import('./disposition-land-seam.mjs').DispositionLabelIntent,
 *             plan: import('./auto-land-seam.mjs').AutoLandPlan }}
 */
export function runnerShadowPlan({
  ledger = [], config, signals = {}, mandatoryLenses, currentLabels = [], authorId, clearerId,
} = {}) {
  const intent = decideDispositionLabel({ ledger, config, signals, mandatoryLenses, currentLabels });
  // FORCED SHADOW — the runner NEVER passes enforce (see the module header). decideAutoLand normalizes any
  // non-`enforce` mode to shadow, but we pass the explicit SHADOW constant to make the observe-only intent
  // unmistakable at the call site: the returned plan is ALWAYS apply:false.
  const plan = decideAutoLand({ intent, mode: LAND_MODES.SHADOW, authorId, clearerId });
  return { intent, plan };
}

/**
 * Project one PR's jury LEDGER to a compact summary for the shadow log — reusing `reduceLedger` (#2652), never
 * re-deriving. PURE. A ledger with no events (the convergence loop has not run / persisted for this PR yet)
 * summarizes as `ledgerFound:false` — which the seams treat fail-closed (no roster / no verdicts → escalate).
 * @param {Array<object>} ledger - the append-only jury-ledger events (#2654 shape).
 */
export function summarizeLedger(ledger) {
  const events = Array.isArray(ledger) ? ledger : [];
  const reduced = reduceLedger(events);
  const findingsByLens = {};
  for (const f of reduced.outstandingFindings) {
    const lens = (f && typeof f.category === 'string' && f.category) ? f.category : 'unattributed';
    findingsByLens[lens] = (findingsByLens[lens] || 0) + 1;
  }
  return {
    ledgerFound: events.length > 0,
    rosterKnown: reduced.rosterKnown,
    lensVerdicts: reduced.lensVerdicts,
    // ledger rounds are 0-based (`maxRound`); the loop's are 1-based. Report the human 1-based count, or 0 when
    // there is no ledger at all.
    rounds: events.length > 0 ? reduced.maxRound + 1 : 0,
    outstandingFindings: reduced.outstandingFindings.length,
    findingsByLens,
  };
}

/**
 * Build the structured SHADOW-LOG record for one PR (#2830): what the loop concluded (the reduced ledger), the
 * seams' would-be disposition + action, whether it WOULD clear, and the invariant `mutated:false`. PURE.
 *
 * `wouldClear` is the disposition INTENT (`intent.action === 'clear'`), NOT whether it was applied — in shadow it
 * is never applied (`applied:false`), which is the whole point of the record: it shows what an ENFORCE runner
 * WOULD have cleared, so an operator can build confidence before the flip.
 *
 * @param {{ item: {pr:(number|string), repo?:string}, ledger?: Array<object>,
 *           intent: import('./disposition-land-seam.mjs').DispositionLabelIntent,
 *           plan: import('./auto-land-seam.mjs').AutoLandPlan }} o
 */
export function buildShadowRecord({ item, ledger = [], intent, plan }) {
  const repo = (item && typeof item.repo === 'string' && item.repo) ? item.repo : 'we';
  const summary = summarizeLedger(ledger);
  const wouldClear = intent.action === LAND_ACTIONS.CLEAR;
  // The panel verdict for the log line: the JUDGE'S OWN reduced panel verdict — read via the single accessor
  // `dispositionPanelVerdict` (it lives at `verdict.proposed.panelVerdict`, NOT the verdict root; reaching for the
  // wrong path silently read `undefined` and always fell through — the #2830 M2 defect). Only when the judge
  // escalated BEFORE deriving a panel verdict (no-roster / no-verdicts / missing-mandatory-lens) do we fall back to
  // the strictest per-lens verdict from the reduced ledger, else `none` (no ledger at all).
  const panelVerdict = dispositionPanelVerdict(intent.verdict)
    || (summary.ledgerFound ? strictestLensVerdict(summary.lensVerdicts) : 'none');
  return {
    pr: Number(item && item.pr),
    repo,
    subject: `${repo}#${Number(item && item.pr)}`,
    ledgerFound: summary.ledgerFound,
    panelVerdict,
    lensVerdicts: summary.lensVerdicts,
    outstandingFindings: summary.outstandingFindings,
    findingsByLens: summary.findingsByLens,
    rounds: summary.rounds,
    disposition: intent.disposition,   // 'auto-dispose' | 'escalate'
    action: plan.action,               // 'clear' | 'keep-parked'
    wouldClear,                        // the seams' intent — WOULD it clear? (shadow never applies it)
    mode: plan.mode,                   // always 'shadow' (the runner forces it)
    applied: plan.apply === true,      // always false in shadow — the record's proof it acted on nothing
    mutated: false,                    // INVARIANT: the runner mutates NOTHING in shadow, ever
    reason: plan.reason || intent.reason || '',
    observation: plan.observation || '',
    trail: Array.isArray(intent.trail) ? intent.trail : [],
  };
}
