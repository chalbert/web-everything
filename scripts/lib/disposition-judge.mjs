/**
 * disposition-judge.mjs — the DISPOSITION LAYER over the jury ledger (#2652, core of epic #2636).
 *
 * WHY: #2576 established "the human disposes". #2652 is the deliberately, SEPARATELY-ratified relaxation of that
 * (decision record 273a2dbd, FF1): once the jury has rendered its ledger + verdict (`jury-core.mjs`), a
 * care-gated disposition POLICY may PROPOSE that a clean, unanimous, uncontested review AUTO-DISPOSE (accept)
 * instead of routing every review to a human. It is modeled as JUDGE + RED-JUDGE:
 *
 *   • the GREEN JUDGE (`proposeDisposition`) — a PURE function over the jury ledger + the resolved #2651
 *     disposition config (`resolveDispositionConfig` → `{ lensWeights, dissentThreshold, resolutionMode }`).
 *     It PROPOSES either `auto-dispose` (accept) or `escalate` (needs-human), reducing the panel's per-lens /
 *     per-juror verdicts under the config's weights, dissent threshold, and resolutionMode.
 *
 *   • the RED JUDGE (`redRefute`) — the ADVERSARY. Given a PROPOSED auto-dispose it tries to REFUTE it: a hidden
 *     contention, a load-bearing dissent the reduction smoothed over, or a flaw a lens surfaced that the accept
 *     glossed. This is the adversarial-verify pattern (the same one the delivery agent runs on a diff) lifted to
 *     the DECISION. An auto-dispose survives ONLY if the red pass FAILS to refute it; otherwise it escalates.
 *
 *   • the COMBINED judge (`disposeVerdict`) — runs green, and (only when green proposes auto-dispose) the red
 *     pass. Auto-dispose is the outcome ONLY when green proposes it AND red fails to refute it.
 *
 * HARD INVARIANT — never auto-dispose a gate-self change. #2652 relaxes #2576's "human disposes", BUT the
 * operator's rule stands: a gate-self / policy-tier change (`signals.gateSelf`) is ALWAYS human-disposed, never
 * agent-auto-cleared. The green judge treats gate-self as a HARD escalate BEFORE it even reads the ledger —
 * regardless of the jury verdict or the red pass. Fail-CLOSED throughout: any uncertainty (an unreadable ledger,
 * a missing mandatory-lens verdict, a deadlock signal) → escalate, never auto-accept.
 *
 * SCOPE — this layer PROPOSES a disposition; it does NOT apply a label or merge. Applying the proposal (the
 * `ready-to-merge` / `review:human` label, the merge) stays the caller's / #2635's seam. This module is PURE:
 * no I/O, no side effects, deterministic — the same ledger + config always yields the same proposal.
 *
 * DISTINCT FROM #2637 — #2637 red-teams the ROSTER (did we pick the right jury?); this red-teams the
 * DISPOSITION (is the auto-clear actually safe?). Different target, same adversarial spirit.
 *
 * Pure, unit-tested in `we:scripts/lib/__tests__/disposition-judge.test.mjs`.
 */
import {
  VERDICTS,
  MANDATORY_LENSES,
  JURY_EVENT_TYPES,
  normalizeJuryEvent,
} from './jury-core.mjs';

/** The two dispositions the green judge proposes (#2652). A frozen enum so every caller names them once. */
export const DISPOSITIONS = Object.freeze({
  AUTO_DISPOSE: 'auto-dispose',
  ESCALATE: 'escalate',
});

/** Verdict strictness — diversity-selection order (#2567): the STRICTEST verdict wins a reduction, never a vote.
 *  `needs-human` (2) beats `changes` (1) beats `accept` (0). */
const VERDICT_STRICTNESS = Object.freeze({
  [VERDICTS.ACCEPT]: 0,
  [VERDICTS.CHANGES]: 1,
  [VERDICTS.NEEDS_HUMAN]: 2,
});

/** A finding is OUTSTANDING unless a fix pass explicitly resolved it (mirrors `deriveVerdict` in jury-core). */
function isFindingOutstanding(finding) {
  return finding.outcome !== 'fixed' && finding.outcome !== 'no_change_needed';
}

/**
 * @typedef {Object} ReducedLedger
 * @property {boolean} rosterKnown - a `roster-picked` event named the roster.
 * @property {Map<string,string>} lensByJuror - jurorId → its lens (from the roster).
 * @property {Map<string,{verdict: string, round: number}>} jurorVerdicts - jurorId → its LATEST verdict (highest round).
 * @property {Object<string,string>} lensVerdicts - lens → the STRICTEST verdict among its jurors (diversity-selection).
 * @property {import('./jury-core.mjs').Finding[]} outstandingFindings - findings no fix pass resolved.
 * @property {number} maxRound - the highest round any event referenced (0 if none).
 */

/**
 * Reduce a raw jury ledger (the append-only `jury-core` event stream) to the state the disposition judge reads.
 * Pure — never throws (a malformed event is skipped, mirroring the never-throw contract of `validateJuryEvent`).
 * Each juror's LATEST verdict (highest round it emitted a verdict in) is its current verdict; each lens's verdict
 * is the STRICTEST among its jurors (diversity-selection, #2567 — one juror wanting changes carries the lens).
 * @param {Array<object>} ledger - the append-only jury-ledger events (#2654 shape).
 * @returns {ReducedLedger}
 */
export function reduceLedger(ledger) {
  const events = (Array.isArray(ledger) ? ledger : []).map(normalizeJuryEvent).filter(Boolean);
  const lensByJuror = new Map();
  const jurorVerdicts = new Map();
  // Findings are keyed by identity (juror + anchor + summary) so a RE-report of the same finding — the append-only
  // ledger's way of recording that a fix pass resolved it in a later round — supersedes the earlier outstanding
  // event instead of double-counting. Latest round wins, mirroring the per-juror verdict fold below.
  const findingByKey = new Map();
  let rosterKnown = false;
  let maxRound = 0;
  for (const ev of events) {
    if (Number.isInteger(ev.round) && ev.round > maxRound) maxRound = ev.round;
    switch (ev.type) {
      case JURY_EVENT_TYPES.ROSTER_PICKED:
        rosterKnown = true;
        for (const juror of ev.jurors) lensByJuror.set(juror.id, juror.lens);
        break;
      case JURY_EVENT_TYPES.VERDICT: {
        const prev = jurorVerdicts.get(ev.jurorId);
        // Latest verdict wins: keep the one from the highest round (a later round supersedes an earlier one).
        if (!prev || ev.round >= prev.round) jurorVerdicts.set(ev.jurorId, { verdict: ev.verdict, round: ev.round });
        break;
      }
      case JURY_EVENT_TYPES.FINDING: {
        const f = ev.finding;
        const key = JSON.stringify([ev.jurorId, f.file ?? '', f.line ?? '', f.summary]);
        const prev = findingByKey.get(key);
        if (!prev || ev.round >= prev.round) findingByKey.set(key, { round: ev.round, finding: f });
        break;
      }
      default:
        break; // juror-running / round-advanced carry no disposition state
    }
  }
  // A finding is outstanding only in its LATEST reported state (a later `outcome: fixed` re-report resolves it).
  const outstandingFindings = [];
  for (const { finding } of findingByKey.values()) {
    if (isFindingOutstanding(finding)) outstandingFindings.push(finding);
  }
  // Reduce per-juror verdicts to per-lens verdicts by diversity-selection (strictest wins).
  const lensVerdicts = {};
  for (const [jurorId, { verdict }] of jurorVerdicts) {
    const lens = lensByJuror.get(jurorId);
    if (!lens) continue; // a verdict from a juror the roster never named — ignore it (fail-closed handles the gap)
    const current = lensVerdicts[lens];
    if (current === undefined || VERDICT_STRICTNESS[verdict] > VERDICT_STRICTNESS[current]) {
      lensVerdicts[lens] = verdict;
    }
  }
  return { rosterKnown, lensByJuror, jurorVerdicts, lensVerdicts, outstandingFindings, maxRound };
}

/** The weight of one juror's lens under a resolved `{ default, values }` lens-weight config (#2651). A lens absent
 *  from `values` weighs `default`; a non-finite / negative weight falls back to `default` then 1 (fail-safe). */
function lensWeight(lens, lensWeights) {
  const values = lensWeights && typeof lensWeights === 'object' ? lensWeights.values : undefined;
  const dflt = lensWeights && Number.isFinite(lensWeights.default) && lensWeights.default >= 0 ? lensWeights.default : 1;
  const raw = values && Number.isFinite(values[lens]) && values[lens] >= 0 ? values[lens] : dflt;
  return raw;
}

/**
 * The WEIGHTED juror totals over the reduced ledger (#2651 `lensWeights`) — the total weight across all rostered
 * jurors and the weight whose verdict is NOT `accept` (dissent from an auto-dispose). Pure. A juror the roster
 * never named contributes nothing (its lens is unknown). `total` is 0 only when every rostered juror's lens
 * weighs 0 — a DEGENERATE config the caller treats as an absence of signal (fail-closed), never as unanimity.
 * @param {ReducedLedger} reduced
 * @param {{default: number, values: object}} lensWeights
 * @returns {{total: number, dissent: number}}
 */
export function weightedTotals(reduced, lensWeights) {
  let total = 0;
  let dissent = 0;
  for (const [jurorId, { verdict }] of reduced.jurorVerdicts) {
    const lens = reduced.lensByJuror.get(jurorId);
    if (!lens) continue;
    const w = lensWeight(lens, lensWeights);
    total += w;
    if (verdict !== VERDICTS.ACCEPT) dissent += w;
  }
  return { total, dissent };
}

/**
 * The WEIGHTED dissent fraction over the reduced ledger (#2651 `lensWeights`) — the share of total juror weight
 * whose verdict is NOT `accept`. Pure. Range [0, 1]; 0 = weighted unanimity to accept. When EVERY juror weighs
 * zero the fraction is 0 (no weighted signal) — but that DEGENERATE case is caught as a fail-closed escalate in
 * `proposeDisposition` BEFORE this value is trusted, so a zero fraction here always means genuine unanimity.
 * @param {ReducedLedger} reduced
 * @param {{default: number, values: object}} lensWeights
 * @returns {number}
 */
export function weightedDissentFraction(reduced, lensWeights) {
  const { total, dissent } = weightedTotals(reduced, lensWeights);
  return total > 0 ? dissent / total : 0;
}

/**
 * @typedef {Object} DispositionProposal
 * @property {'auto-dispose'|'escalate'} disposition - what the green judge PROPOSES.
 * @property {string} reason - a short machine-token for WHY (e.g. `gate-self`, `dissent-present`, `unanimous-accept`).
 * @property {string[]} trail - the human-readable reasoning trail the ledger records (the disposition trail).
 * @property {string} [panelVerdict] - the reduced panel verdict, when the ledger was read far enough to derive it.
 * @property {number} [dissentFraction] - the weighted dissent fraction, when computed.
 */

/** Build an escalate proposal with a trail. */
function escalate(reason, trailLine, extra = {}) {
  return { disposition: DISPOSITIONS.ESCALATE, reason, trail: [trailLine], ...extra };
}

/**
 * THE GREEN JUDGE (#2652) — PROPOSE a disposition from the jury ledger + the resolved #2651 disposition config.
 * PURE. PROPOSES `auto-dispose` (accept) or `escalate` (needs-human); it does NOT apply a label or merge.
 * Fail-CLOSED — every branch that cannot PROVE the auto-dispose is safe escalates.
 *
 * Order of decision (strictest / most-conservative first):
 *   1. HARD INVARIANT — `signals.gateSelf` → escalate, ALWAYS, before the ledger is even read. A gate-self /
 *      policy-tier change is never agent-auto-cleared no matter how clean the verdict (the ratified relaxation of
 *      #2576 keeps THIS carve-out). `signals.humanRequired` / `signals.nonConvergence` (a #2285 conflict of
 *      interest, or a #2311 round-cap deadlock the caller detected) escalate here too.
 *   2. FAIL-CLOSED ledger reads — no `roster-picked` (unknown roster), or no juror verdicts at all → escalate.
 *   3. MANDATORY-LENS coverage — every mandatory lens must carry a verdict; a missing one → escalate (we cannot
 *      claim a lens accepted when it never ran).
 *   4. PANEL verdict (diversity-selection over the mandatory lenses' strictest verdicts): any mandatory lens at
 *      `needs-human` or `changes` → escalate. Only a unanimous mandatory `accept` continues.
 *   5. DISSENT policy (the #2651 knobs) over ALL jurors' weighted verdicts:
 *        • `present-unless-all-agree` (the conservative default) → auto-dispose ONLY on weighted unanimity
 *          (dissent fraction 0); any weighted dissent → escalate. (`dissentThreshold` does not loosen this mode —
 *          unanimity is the mode's contract.)
 *        • `accept-best` → auto-dispose while weighted dissent ≤ `dissentThreshold`; above it → escalate.
 *
 * @param {{ ledger?: Array<object>, config: {lensWeights: object, dissentThreshold: number, resolutionMode: string},
 *   signals?: {gateSelf?: boolean, humanRequired?: boolean, nonConvergence?: boolean}, mandatoryLenses?: string[] }} o
 * @returns {DispositionProposal}
 */
export function proposeDisposition({ ledger = [], config, signals = {}, mandatoryLenses = MANDATORY_LENSES } = {}) {
  if (!config || typeof config !== 'object') {
    throw new Error('proposeDisposition: a resolved disposition config { lensWeights, dissentThreshold, resolutionMode } is required');
  }
  if (!Array.isArray(mandatoryLenses) || mandatoryLenses.length === 0) {
    // Guard the same vacuous-truth trap `derivePanelVerdict` (jury-core.mjs) does: an empty mandatory set would
    // make step 3's `missing` filter and step 4's `reduce` both pass vacuously — a lone advisory juror could
    // auto-dispose with correctness/security never checked. An empty set is a caller misconfiguration, not a
    // free accept.
    throw new Error('proposeDisposition: mandatoryLenses must be a non-empty array — an empty set would vacuously "accept"');
  }
  const { lensWeights, dissentThreshold, resolutionMode } = config;

  // 1 — HARD INVARIANT + caller-supplied hard escalates (checked BEFORE the ledger; no verdict overrides them).
  if (signals.gateSelf) {
    return escalate('gate-self', 'HARD INVARIANT: a gate-self / policy-tier change is always human-disposed, never auto-cleared — regardless of the jury verdict or the red pass.');
  }
  if (signals.humanRequired) return escalate('human-required', 'A #2285 conflict-of-interest flag requires a human — escalate.');
  if (signals.nonConvergence) return escalate('non-convergence', 'The negotiation loop hit its round cap without agreeing — a deadlock hands straight to a human.');

  // 2 — FAIL-CLOSED ledger reads.
  const reduced = reduceLedger(ledger);
  if (!reduced.rosterKnown) return escalate('no-roster', 'The ledger names no roster (no roster-picked event) — cannot prove a jury reviewed this; fail-closed escalate.');
  if (reduced.jurorVerdicts.size === 0) return escalate('no-verdicts', 'The ledger carries no juror verdicts — nothing to auto-dispose on; fail-closed escalate.');

  // 3 — MANDATORY-LENS coverage.
  const missing = mandatoryLenses.filter((lens) => reduced.lensVerdicts[lens] === undefined);
  if (missing.length) {
    return escalate('missing-mandatory-lens', `Mandatory lens(es) with no verdict in the ledger: ${missing.join(', ')} — cannot claim they accepted; fail-closed escalate.`);
  }

  // 4 — PANEL verdict over the mandatory lenses (diversity-selection: strictest wins).
  const strictestMandatory = mandatoryLenses.reduce((worst, lens) => {
    const v = reduced.lensVerdicts[lens];
    return VERDICT_STRICTNESS[v] > VERDICT_STRICTNESS[worst] ? v : worst;
  }, VERDICTS.ACCEPT);
  const totals = weightedTotals(reduced, lensWeights);
  const dissentFraction = totals.total > 0 ? totals.dissent / totals.total : 0;
  // FAIL-CLOSED — a zero total weight (every juror's lens weighs 0) is an ABSENCE of weighted signal, not
  // unanimity: without it the dissent fraction reads 0 and a dissenting juror could slip through. Escalate.
  if (totals.total === 0) {
    return escalate('degenerate-weights', 'Every rostered juror\'s lens weighs 0 — no weighted signal to auto-dispose on; fail-closed escalate.', { panelVerdict: strictestMandatory, dissentFraction });
  }
  if (strictestMandatory === VERDICTS.NEEDS_HUMAN) {
    return escalate('panel-needs-human', 'A mandatory lens returned needs-human — escalate.', { panelVerdict: strictestMandatory, dissentFraction });
  }
  if (strictestMandatory === VERDICTS.CHANGES) {
    return escalate('panel-changes', 'A mandatory lens wants changes — the review has not converged to accept; escalate.', { panelVerdict: strictestMandatory, dissentFraction });
  }

  // 5 — DISSENT policy (the #2651 knobs). Mandatory lenses unanimously accept here.
  if (resolutionMode === 'present-unless-all-agree') {
    if (dissentFraction > 0) {
      return escalate('dissent-present', `resolutionMode present-unless-all-agree requires weighted unanimity; weighted dissent ${dissentFraction.toFixed(3)} > 0 — escalate.`, { panelVerdict: VERDICTS.ACCEPT, dissentFraction });
    }
    return { disposition: DISPOSITIONS.AUTO_DISPOSE, reason: 'unanimous-accept', panelVerdict: VERDICTS.ACCEPT, dissentFraction, trail: ['Every mandatory lens accepted and every weighted juror agreed (present-unless-all-agree) — propose auto-dispose.'] };
  }
  if (resolutionMode === 'accept-best') {
    if (dissentFraction > dissentThreshold) {
      return escalate('dissent-over-threshold', `Weighted dissent ${dissentFraction.toFixed(3)} exceeds dissentThreshold ${dissentThreshold} — escalate.`, { panelVerdict: VERDICTS.ACCEPT, dissentFraction });
    }
    return { disposition: DISPOSITIONS.AUTO_DISPOSE, reason: 'accept-best-within-tolerance', panelVerdict: VERDICTS.ACCEPT, dissentFraction, trail: [`Mandatory lenses accepted; weighted dissent ${dissentFraction.toFixed(3)} ≤ dissentThreshold ${dissentThreshold} (accept-best) — propose auto-dispose.`] };
  }
  // Unknown resolutionMode — fail-closed (a resolved config from `resolveDispositionConfig` is always one of the
  // two, but a hand-built config must not slip an auto-dispose through an unrecognized mode).
  return escalate('unknown-resolution-mode', `Unrecognized resolutionMode "${String(resolutionMode)}" — fail-closed escalate.`, { panelVerdict: VERDICTS.ACCEPT, dissentFraction });
}

/**
 * @typedef {Object} RedRefutation
 * @property {boolean} refuted - true when the red judge found grounds to REFUTE the proposed auto-dispose.
 * @property {string[]} grounds - one line per refutation ground (empty when the auto-dispose survives).
 */

/**
 * THE RED JUDGE (#2652) — the ADVERSARY over a PROPOSED auto-dispose. PURE. Given the green judge's auto-dispose
 * proposal, it re-examines the SAME ledger for evidence the green reduction discarded, and tries to REFUTE the
 * auto-clear. It returns `{ refuted, grounds }`; it does NOT itself dispose. An auto-dispose survives ONLY if
 * `refuted` is false. Called only when green PROPOSED auto-dispose — refuting an escalate is meaningless (it is
 * already going to a human).
 *
 * The refutation grounds — the "hidden contention / load-bearing dissent / flaw a lens missed" the spec names:
 *   • `gate-self` — belt-and-suspenders: if a gate-self signal reaches the red pass, refute (green should have
 *     already escalated; the red judge NEVER lets a gate-self auto-dispose through).
 *   • `tolerated-dissent` — any WEIGHTED dissent the green judge auto-disposed over (only possible under
 *     `accept-best` with a non-zero `dissentThreshold`): a load-bearing dissent the reduction smoothed over.
 *   • `outstanding-finding` — a finding a lens surfaced that no fix pass resolved. The panel reduction lets an
 *     ADVISORY lens's findings ride (they never block the mandatory-accept land), but to the adversary an
 *     unaddressed finding is exactly the flaw the accept glossed — refute so a human sees it.
 *   • `thin-jury` — a mandatory lens with only ONE juror. The diverse jury (#2567) exists to beat shared blind
 *     spots; a single-juror mandatory lens auto-disposing has no diversity behind its accept — refute.
 *
 * @param {{ ledger?: Array<object>, config: {lensWeights: object, dissentThreshold: number, resolutionMode: string},
 *   proposal: DispositionProposal, signals?: {gateSelf?: boolean}, mandatoryLenses?: string[] }} o
 * @returns {RedRefutation}
 */
export function redRefute({ ledger = [], config, proposal, signals = {}, mandatoryLenses = MANDATORY_LENSES } = {}) {
  const grounds = [];
  // The red judge only engages a PROPOSED auto-dispose; anything else is already escalating.
  if (!proposal || proposal.disposition !== DISPOSITIONS.AUTO_DISPOSE) {
    return { refuted: false, grounds };
  }
  const reduced = reduceLedger(ledger);

  // gate-self must NEVER survive to auto-dispose — refute unconditionally (green already escalates it; this is the
  // adversary's independent enforcement of the hard invariant).
  if (signals.gateSelf) grounds.push('gate-self: a policy-tier change is always human-disposed — the auto-dispose is refuted outright.');

  // A load-bearing dissent the reduction tolerated (accept-best + threshold > 0).
  const dissentFraction = weightedDissentFraction(reduced, config?.lensWeights);
  if (dissentFraction > 0) {
    grounds.push(`tolerated-dissent: weighted juror dissent ${dissentFraction.toFixed(3)} was smoothed over by the reduction — a load-bearing disagreement a human should see.`);
  }

  // A flaw a lens surfaced that no fix resolved — advisory findings ride the panel accept, but the adversary flags them.
  if (reduced.outstandingFindings.length) {
    grounds.push(`outstanding-finding: ${reduced.outstandingFindings.length} finding(s) a lens raised were never resolved — the accept glossed a surfaced flaw.`);
  }

  // A mandatory lens with no diversity behind its accept (a single juror).
  const jurorsPerLens = {};
  for (const [jurorId] of reduced.jurorVerdicts) {
    const lens = reduced.lensByJuror.get(jurorId);
    if (lens) jurorsPerLens[lens] = (jurorsPerLens[lens] || 0) + 1;
  }
  const thin = mandatoryLenses.filter((lens) => (jurorsPerLens[lens] || 0) === 1);
  if (thin.length) {
    grounds.push(`thin-jury: mandatory lens(es) ${thin.join(', ')} accepted on a single juror — no diverse jury behind the accept to catch a shared blind spot.`);
  }

  return { refuted: grounds.length > 0, grounds };
}

/**
 * @typedef {Object} DispositionVerdict
 * @property {'auto-dispose'|'escalate'} disposition - the FINAL disposition after green + (when needed) red.
 * @property {string} reason - the machine-token for the final decision.
 * @property {DispositionProposal} proposed - the green judge's proposal.
 * @property {RedRefutation|null} red - the red judge's refutation result (null when green already escalated).
 * @property {string[]} trail - the full disposition trail (green's trail + the red pass outcome).
 */

/**
 * THE COMBINED DISPOSITION JUDGE (#2652) — run the green judge, and (only when it proposes auto-dispose) the red
 * adversary. PURE. The auto-dispose survives ONLY IF green proposes it AND red fails to refute it — the
 * adversarial-verify pattern lifted to the decision. When green escalates, the red pass is skipped (there is
 * nothing to refute — it is already going to a human). The full disposition trail is recorded so the ledger can
 * show WHY. PROPOSES a disposition only; it does NOT apply a label or merge (that stays the caller's / #2635's seam).
 * @param {{ ledger?: Array<object>, config: {lensWeights: object, dissentThreshold: number, resolutionMode: string},
 *   signals?: {gateSelf?: boolean, humanRequired?: boolean, nonConvergence?: boolean}, mandatoryLenses?: string[] }} o
 * @returns {DispositionVerdict}
 */
export function disposeVerdict({ ledger = [], config, signals = {}, mandatoryLenses = MANDATORY_LENSES } = {}) {
  const proposed = proposeDisposition({ ledger, config, signals, mandatoryLenses });
  if (proposed.disposition === DISPOSITIONS.ESCALATE) {
    return { disposition: DISPOSITIONS.ESCALATE, reason: proposed.reason, proposed, red: null, trail: [...proposed.trail] };
  }
  const red = redRefute({ ledger, config, proposal: proposed, signals, mandatoryLenses });
  if (red.refuted) {
    return {
      disposition: DISPOSITIONS.ESCALATE,
      reason: 'red-refuted',
      proposed,
      red,
      trail: [...proposed.trail, 'Red judge REFUTED the auto-dispose — escalate:', ...red.grounds],
    };
  }
  return {
    disposition: DISPOSITIONS.AUTO_DISPOSE,
    reason: proposed.reason,
    proposed,
    red,
    trail: [...proposed.trail, 'Red judge found no grounds to refute — auto-dispose survives the adversarial pass.'],
  };
}
