/**
 * disposition-land-seam.mjs — the SEAM that wires the #2652 DISPOSITION JUDGE into the review LAND path (#2674,
 * under epic #2636). This is the missing connector: `disposition-judge.mjs` (`disposeVerdict`) is built as PURE
 * functions but, until this file, is imported by NOTHING on the land path — its only consumer was the decision
 * surface (`micro-decision-surface.mjs`). This module lets a parked-PR jury verdict actually FLOW through the
 * judge to a LABEL decision.
 *
 * WHAT IT DOES — one PURE function, `decideDispositionLabel`:
 *   1. Feeds a parked PR's jury LEDGER (the #2654 append-only event stream the #2639 convergence loop produces)
 *      through `disposeVerdict`, consuming the #2651 disposition config (per-lens weights + dissent threshold +
 *      resolution mode) the caller resolved with `resolveDispositionConfig`.
 *   2. Maps the judge's disposition onto a LABEL INTENT:
 *        • `auto-dispose` (a CLEAR WINNER — green proposed it AND the red adversary failed to refute it) →
 *          the auto-CLEAR intent (accept). It routes that through `decideSetLabel({ to: 'accepted' })`, so the
 *          swap INHERITS INVARIANT 2 unbypassed — `decideSetLabel` REFUSES an accept on a `review:human` PR.
 *        • `escalate` (CONTESTED / red-REFUTED / gate-self / any fail-closed reason) → a KEEP-PARKED intent
 *          that routes the PR to a human (`review:human`), never an accept.
 *
 * DECISION-ONLY, NO AUTO-ACTION (the #2674 / #2675 boundary). This seam RETURNS a label INTENT and NOTHING
 * ELSE — it writes no label, posts no comment, merges nothing, does no I/O. Applying the intent (the actual
 * `review:accepted` write + the drain merge) is the SEPARATE sibling seam #2675, which stays behind SHADOW mode
 * (it observes what this seam WOULD decide before it is ever allowed to act). Keeping #2674 a pure decider is
 * the whole safety point: turning the judge's verdict into an EXECUTED auto-land is a distinct, later, gated step.
 *
 * FAIL-CLOSED, TWO RINGS. `disposeVerdict` is already fail-closed by construction (any unreadable ledger,
 * missing mandatory-lens verdict, dissent, or gate-self signal → `escalate`, never a silent accept). This seam
 * adds one more ring: if the judge cannot even RUN (a missing / invalid config makes `disposeVerdict` throw),
 * the seam keeps the PR PARKED — it NEVER lets an error become an auto-accept. And the auto-dispose branch is
 * belt-and-suspenders: even a survived auto-dispose is run through `decideSetLabel`, whose INVARIANT-2 refusal
 * keeps a `review:human`-labelled PR parked no matter what the ledger proposed. The invariant this preserves:
 * a red-judge-refuted OR gate-self PR is NEVER auto-disposed.
 *
 * TRUST-CHAIN MEMBER (POLICY tier). This file DECIDES whether a PR auto-clears or goes to a human — it is the
 * disposition-to-label router, exactly the "leash-defining" class `gate-config.mjs` describes. It is registered
 * in `TRUST_CHAIN` as `tier: 'policy'`, so a change here forces `review:human` (an agent may not clear an edit
 * to its own auto-dispose leash). Keep it that way.
 *
 * Pure, unit-tested in `we:scripts/lib/__tests__/disposition-land-seam.test.mjs`.
 */
import { disposeVerdict, DISPOSITIONS } from './disposition-judge.mjs';
import { REVIEW_LABELS } from './review-escalation.mjs';
import { decideSetLabel } from '../review-set-label.mjs';

/**
 * The two LAND-PATH actions a disposition maps to (#2674). A frozen enum so every caller (and #2675) names them
 * once. Deliberately NOT the reviewer-verdict vocabulary of `decideSetLabel` (`accepted` / `changes`): this is
 * the disposition→land intent, one level up.
 */
export const LAND_ACTIONS = Object.freeze({
  CLEAR: 'clear',             // auto-dispose survived → INTENT to swap the parked review to review:accepted (accept)
  KEEP_PARKED: 'keep-parked', // escalate / refuted / gate-self / judge-error → keep it parked for a HUMAN (review:human)
});

/**
 * @typedef {Object} SetLabelDecision
 * @property {boolean} allowed - whether the label swap may be applied.
 * @property {string} addLabel - the label to add.
 * @property {string[]} removeLabels - the labels to remove (a SUPERSET; the applier intersects with the PR's real labels).
 * @property {string} reason - a short human reason for the swap.
 */

/**
 * @typedef {Object} DispositionLabelIntent
 * @property {'clear'|'keep-parked'} action - the land-path action (see {@link LAND_ACTIONS}).
 * @property {'auto-dispose'|'escalate'} disposition - the judge's combined disposition this intent realizes.
 * @property {string} reason - the machine-token for WHY (the judge's reason, or a seam-level `judge-error` /
 *   `refused-accept` token).
 * @property {SetLabelDecision} setLabel - the LABEL swap intent (NOT applied — #2675 applies it behind shadow mode).
 * @property {string[]} trail - the human-readable disposition trail (the judge's, plus any seam ring that fired).
 * @property {import('./disposition-judge.mjs').DispositionVerdict|null} verdict - the full judge verdict (null on a judge-error).
 */

/** Build a KEEP-PARKED intent — route the PR to a human (`review:human`), never an accept. The label intent
 *  ADDS `review:human` and DROPS both `review:pending` (the agent-clearable park) AND a stale `review:accepted`,
 *  so applying it upgrades a pending park to the human gate and — like `decideSetLabel`'s bounce path
 *  (review-set-label.mjs) — can NEVER leave an escalated PR looking accepted (a residual `review:accepted` wins
 *  over everything in `decideReviewGate`, so scrubbing it here keeps the escalate honest). Pure. (The applier —
 *  #2675 — narrows this `removeLabels` SUPERSET to the labels the PR actually carries, so removals of absent
 *  labels are no-ops.) */
function parkedIntent({ reason, trail = [], verdict = null }) {
  return {
    action: LAND_ACTIONS.KEEP_PARKED,
    disposition: DISPOSITIONS.ESCALATE,
    reason,
    setLabel: {
      allowed: true,
      addLabel: REVIEW_LABELS.human,
      removeLabels: [REVIEW_LABELS.pending, REVIEW_LABELS.accepted],
      reason: `escalate → keep parked for a human (${reason})`,
    },
    trail: [...trail],
    verdict,
  };
}

/**
 * THE SEAM (#2674) — turn a parked PR's jury ledger into a LABEL INTENT via the #2652 disposition judge. PURE:
 * no I/O, no side effects, deterministic — the same ledger + config + labels always yield the same intent. It
 * RETURNS the intent; it does NOT apply it (that is #2675, behind shadow mode).
 *
 * @param {{
 *   ledger?: Array<object>,
 *   config: {lensWeights: object, dissentThreshold: number, resolutionMode: string},
 *   signals?: {gateSelf?: boolean, humanRequired?: boolean, nonConvergence?: boolean},
 *   mandatoryLenses?: string[],
 *   currentLabels?: Array
 * }} o - `config` is a RESOLVED #2651 disposition config (`resolveDispositionConfig`); `signals` are the judge's
 *   hard-escalate signals; `currentLabels` is the PR's OBSERVED labels (string or `{name}` shape, per
 *   `hasReviewLabel`) — read ONLY to enforce `decideSetLabel`'s INVARIANT-2 refusal on the clear branch.
 * @returns {DispositionLabelIntent}
 */
export function decideDispositionLabel({
  ledger = [],
  config,
  signals = {},
  mandatoryLenses,
  currentLabels = [],
} = {}) {
  // Ring 1 — run the PURE judge. It is fail-closed by construction, but the SEAM adds one more fail-closed ring:
  // if the judge cannot even RUN (a missing / invalid config makes disposeVerdict throw), keep the PR PARKED —
  // an error NEVER becomes an auto-accept.
  let verdict;
  try {
    verdict = disposeVerdict({ ledger, config, signals, mandatoryLenses });
  } catch (e) {
    return parkedIntent({ reason: `judge-error: ${(e && e.message) || 'disposeVerdict threw'}` });
  }

  // ESCALATE (contested / red-refuted / gate-self / any fail-closed reason) → keep it parked for a human.
  if (verdict.disposition !== DISPOSITIONS.AUTO_DISPOSE) {
    return parkedIntent({ reason: verdict.reason, trail: verdict.trail, verdict });
  }

  // AUTO-DISPOSE survived green + the red adversary → the auto-CLEAR intent (accept). Route it through
  // decideSetLabel so INVARIANT 2 is inherited UNBYPASSED: decideSetLabel REFUSES an accept on a review:human
  // PR. A gate-self PR is already escalated by the judge above; this is the belt-and-suspenders ring — if the
  // LABEL says human yet the ledger somehow proposed auto-dispose, the refusal keeps it parked, never laundered
  // into an accept.
  const setLabel = decideSetLabel({ to: 'accepted', currentLabels });
  if (!setLabel.allowed) {
    return parkedIntent({
      reason: `refused-accept: ${setLabel.reason}`,
      trail: [...verdict.trail, `INVARIANT 2 refused the auto-clear: ${setLabel.reason} — keep parked.`],
      verdict,
    });
  }
  return {
    action: LAND_ACTIONS.CLEAR,
    disposition: DISPOSITIONS.AUTO_DISPOSE,
    reason: verdict.reason,
    setLabel,
    trail: [...verdict.trail],
    verdict,
  };
}
