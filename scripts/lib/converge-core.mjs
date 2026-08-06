/**
 * converge-core.mjs — the editor↔reviewer CONVERGENCE loop as a PURE, IMPORTABLE, UNIT-TESTABLE core
 * (#x2mo71w, ahead of the /converge front door #xztipiw).
 *
 * WHY THIS EXISTS. The loop shipped inside `we:scripts/workflows/review-parked-prs.mjs` — a Workflow *harness
 * body*, which by construction cannot be imported (it ends in a top-level `return`, so it is not an ES module)
 * and therefore cannot be unit-tested at all. Every invariant it carries — the round-cap backstop, the grow-only
 * roster union, the fail-closed degradations — is validated only by running it live against a real PR, against
 * nondeterministic LLM jurors. A second caller (the working-tree `/converge`) would have had to COPY that control
 * flow, and the copies would drift silently.
 *
 * WHERE THE SEAM IS, AND WHY IT IS NOT WHERE YOU'D FIRST DRAW IT. The obvious extraction lifts only the
 * *decisions* (continue/escalate, the cap, the union). A jury on this design (elevated care) rejected that seam:
 * the historically bug-prone surface (#2639 / #2640 / #2450) spans BOTH the decision and the **sensing that
 * precedes it**, so a line drawn mid-mechanism leaves the untrusted half exactly where it was while claiming the
 * invariant is now covered. Concretely — if this core were handed an already-reduced verdict, then "a crashed
 * MANDATORY lens degrades the round to needs-human" would be *unreachable from inside it*: the degradation would
 * already have happened upstream, in the untestable harness. So the core takes the **RAW per-lens juror results**
 * and performs the sensing, the reduction, and the decision itself. The harness only *executes actions* and
 * *reports what happened* — it never decides.
 *
 * THE CONTRACT THIS MODULE DEPENDS ON (declared, not assumed). A concurrent workstream is revising panel
 * weighting inside `we:scripts/lib/jury-core.mjs`. Promising "zero lines changed in that file" prevents merge
 * conflicts but NOT semantic drift — this core's tests can break with zero textual overlap if the meaning of a
 * shared export changes. So the dependency is stated here as a named contract:
 *
 *   from we:scripts/lib/jury-core.mjs   — `deriveVerdict` (findings → one lens verdict), `derivePanelVerdict`
 *     (lens verdicts + findings → one panel verdict, by diversity-selection), `deriveNegotiationOutcome`
 *     (verdict + round + cap → land|continue|escalate), `MANDATORY_LENSES`, `NEGOTIATION_ROUND_CAP`, `VERDICTS`,
 *     `NEGOTIATION_OUTCOMES`.
 *   from we:scripts/lib/review-core.mjs — `growOnlyRoster`, `floorGrowOnlyJurors`, `absentMandatoryLenses`.
 *
 * If a weighting change alters what any of those MEAN (not just how they compute), this core's tests are the
 * intended tripwire — that is a stated contract break, not a mystery failure. NOTHING about who judges, how many
 * jurors a care band earns, which lenses are mandatory, or how verdicts reduce is re-derived here (#51 / F1).
 *
 * PURITY. No I/O, no filesystem, no network, no clock, no randomness. Every export is a total function of its
 * arguments. That is the whole point: the harness owns the effects, this module owns the reasoning.
 */

import {
  VERDICTS,
  NEGOTIATION_OUTCOMES,
  NEGOTIATION_ROUND_CAP,
  MANDATORY_LENSES,
  deriveVerdict,
  derivePanelVerdict,
  deriveNegotiationOutcome,
  normalizeFindings,
} from './jury-core.mjs';
import {
  growOnlyRoster,
  floorGrowOnlyJurors,
  absentMandatoryLenses,
} from './review-core.mjs';

/**
 * The actions the core can hand back to a harness. The harness executes EXACTLY one of these per step and
 * reports the result as the next observation; it never chooses one itself.
 */
export const CONVERGE_ACTIONS = Object.freeze({
  /** Read the current material (a PR's net diff, or the lane's working-tree diff). */
  READ: 'read',
  /** Fan out the panel over the current material. */
  PANEL: 'panel',
  /** Grow the jury on a grounded juror invite, then re-judge the SAME material. */
  INVITE: 'invite',
  /** Hand the round's findings to an editor, which revises the material. */
  EDIT: 'edit',
  /** Converged — a non-author panel accepted the final material. */
  LAND: 'land',
  /** Deadlocked / degraded — a human decides. */
  ESCALATE: 'escalate',
});

/** Why an escalation happened. Rides the escalation packet so an operator sees one shape for every cause. */
export const ESCALATION_REASONS = Object.freeze({
  READ_FAILED: 'read-failed',
  MANDATORY_LENS_ABSENT: 'mandatory-lens-absent',
  ROUND_CAP: 'round-cap',
  EDITOR_STALLED: 'editor-stalled',
  NEEDS_HUMAN: 'needs-human',
});

/**
 * Seed the loop state. `roundCap` is FIXED for the whole run — an invite SPENDS rounds against it and can never
 * extend it (that is what stops a chain of invites from dodging the budget). The roster and the per-lens juror
 * count are MUTABLE but GROW-ONLY.
 *
 * @param {{careLevel?: string, jurorsPerLens?: number, roundCap?: number, jurorCeiling?: number,
 *   activeLenses?: string[], mandatoryLenses?: string[], seatableLenses?: string[]}} [o]
 * @returns {object} the initial state — treat as opaque; every transition goes through `convergeStep`.
 */
export function initConvergeState({
  careLevel = 'low',
  jurorsPerLens = 1,
  roundCap = NEGOTIATION_ROUND_CAP,
  jurorCeiling = jurorsPerLens,
  activeLenses = [],
  mandatoryLenses = MANDATORY_LENSES,
  seatableLenses = activeLenses,
} = {}) {
  const cap = Number.isFinite(Number(roundCap)) && Number(roundCap) >= 1
    ? Math.min(Math.floor(Number(roundCap)), NEGOTIATION_ROUND_CAP)
    : NEGOTIATION_ROUND_CAP;
  const per = Number.isFinite(Number(jurorsPerLens)) && Number(jurorsPerLens) >= 1 ? Math.floor(Number(jurorsPerLens)) : 1;
  return Object.freeze({
    round: 1,
    roundCap: cap,
    careLevel,
    jurorsPerLens: per,
    jurorCeiling: Math.max(per, Number.isFinite(Number(jurorCeiling)) ? Math.floor(Number(jurorCeiling)) : per),
    activeLenses: Object.freeze([...activeLenses]),
    mandatoryLenses: Object.freeze([...mandatoryLenses]),
    seatableLenses: Object.freeze([...seatableLenses]),
    /** Findings the editor dismissed with a stated reason, accumulated across rounds (never silently dropped). */
    dismissed: Object.freeze([]),
    /** One entry per completed round — the audit trail an escalation packet carries. */
    history: Object.freeze([]),
    /** Set once the loop is done. */
    done: false,
  });
}

/**
 * Reduce ONE lens's jury (N independent jurors) to that lens's findings by diversity-SELECTION: the UNION of
 * every juror's findings. Any juror's concern carries — the strictest read wins; this is NEVER a vote. A lens
 * counts as having RUN iff AT LEAST ONE of its jurors ran; it fails only when the whole jury failed.
 *
 * Moved verbatim (in behaviour) out of the harness, where it could not be tested.
 *
 * @param {string} lens
 * @param {Array<{ok?: boolean, findings?: any[]}>} jurorResults
 * @returns {{lens: string, ok: boolean, findings: any[]}}
 */
export function reduceLensJury(lens, jurorResults) {
  const jurors = Array.isArray(jurorResults) ? jurorResults : [];
  const ran = jurors.filter((j) => j && j.ok === true);
  if (!ran.length) return { lens, ok: false, findings: [] };
  return { lens, ok: true, findings: ran.flatMap((j) => (Array.isArray(j.findings) ? j.findings : [])) };
}

/**
 * Pick the first GROUNDED juror invite of a round (#2640). An invite is grounded only if it CITES a finding
 * (guardrail 1) and names a lens this panel can actually seat — a perspective lens whose grounding method this
 * caller does not run is not seatable, so inviting it would seat a juror that cannot judge. At most ONE invite
 * is applied per round: one discovery spends one round-trip.
 *
 * @param {Array<{lens?: string, citedFinding?: string, from?: string}>} invites
 * @param {string[]} seatableLenses
 * @returns {{lens: string, citedFinding: string, from: string|null}|null}
 */
export function pickGroundedInvite(invites, seatableLenses = []) {
  const seatable = new Set(Array.isArray(seatableLenses) ? seatableLenses : []);
  for (const inv of Array.isArray(invites) ? invites : []) {
    const lens = inv && typeof inv.lens === 'string' ? inv.lens.trim() : '';
    const cited = inv && typeof inv.citedFinding === 'string' ? inv.citedFinding.trim() : '';
    if (cited && seatable.has(lens)) {
      return { lens, citedFinding: cited, from: inv && typeof inv.from === 'string' ? inv.from : null };
    }
  }
  return null;
}

/**
 * THE SENSING HALF — normalize a round's RAW effect results into a trusted observation record.
 *
 * This is the half the naive extraction leaves behind, and it is where the fail-closed bugs live. Every field is
 * derived DEFENSIVELY from possibly-malformed agent output: an absent/garbled result is read as FAILURE, never as
 * success. A harness cannot make the loop believe something ran by returning a malformed shape.
 *
 * @param {{readResult?: any, lensResults?: any[], invites?: any[], editResult?: any,
 *   mandatoryLenses?: string[]}} [o]
 * @returns {{read: {ok: boolean, material: string}, panel: {lensResults: Array<{lens: string, ok: boolean,
 *   findings: any[]}>, ranOkLenses: string[], failedLenses: string[], absentMandatory: string[],
 *   invites: any[], observed: boolean}, edit: {observed: boolean, advanced: boolean, dismissed: any[]}}}
 */
export function deriveRoundObservations({
  readResult,
  lensResults,
  invites,
  editResult,
  mandatoryLenses = MANDATORY_LENSES,
} = {}) {
  // ── READ. Material must be a NON-EMPTY string and the result must not carry an error. Anything else is a
  //    failed read — there is nothing to judge, and judging nothing must never read as accept.
  const material = readResult && typeof readResult.material === 'string' ? readResult.material : '';
  const readOk = !!(readResult && !readResult.error && material.length > 0);

  // ── PANEL. `observed` distinguishes "no panel ran yet this step" from "a panel ran and every lens failed".
  const rawLens = Array.isArray(lensResults) ? lensResults : null;
  const normalizedLens = (rawLens || []).map((r) => ({
    lens: r && typeof r.lens === 'string' ? r.lens : '',
    ok: !!(r && r.ok === true),
    findings: r && Array.isArray(r.findings) ? r.findings : [],
  })).filter((r) => r.lens);
  const ranOkLenses = normalizedLens.filter((r) => r.ok).map((r) => r.lens);
  const failedLenses = normalizedLens.filter((r) => !r.ok).map((r) => r.lens);

  // A mandatory lens is absent whether it RAN AND ERRORED or was NEVER SCHEDULED — keying only on failures let a
  // shrunk roster that never ran a mandatory lens see zero failures and reduce to accept (#2640).
  const absentMandatory = absentMandatoryLenses(ranOkLenses, mandatoryLenses);

  // ── EDIT. `advanced` is what stops the loop re-judging identical material forever. It must be reported by the
  //    editor; an absent or non-true value is read as NOT advanced (fail-closed).
  const editObserved = editResult != null;
  const advanced = !!(editResult && editResult.advanced === true);
  const dismissed = editResult && Array.isArray(editResult.dismissed) ? editResult.dismissed : [];

  return {
    read: { ok: readOk, material },
    panel: {
      lensResults: normalizedLens,
      ranOkLenses,
      failedLenses,
      absentMandatory,
      invites: Array.isArray(invites) ? invites : [],
      observed: rawLens !== null,
    },
    edit: { observed: editObserved, advanced, dismissed },
  };
}

/**
 * Reduce one panel round's RAW lens results to a verdict — the whole decision chain, purely.
 *
 * Per-lens findings → `deriveVerdict` → a lens-verdict map → `derivePanelVerdict` (diversity-selection over the
 * mandatory set). `humanRequired` is forced when the read failed or a MANDATORY lens is absent, so a round with
 * missing signal can only reduce to `needs-human`. All four derivations come from the declared jury-core
 * contract; none of the semantics are re-implemented here.
 *
 * @param {object} state
 * @param {ReturnType<typeof deriveRoundObservations>} obs
 * @param {{conflict?: boolean, requiredTestGreen?: boolean}} [o]
 * @returns {{verdict: string, lensVerdicts: Record<string,string>, findings: any[], humanRequired: boolean}}
 */
export function reducePanelRound(state, obs, { conflict = false } = {}) {
  const lensVerdicts = {};
  const allFindings = [];
  for (const r of obs.panel.lensResults) {
    if (!r.ok) continue;
    const findings = normalizeFindings(r.findings);
    lensVerdicts[r.lens] = deriveVerdict({ findings });
    for (const f of findings) allFindings.push({ ...f, lens: r.lens });
  }

  // FAIL-CLOSED: missing signal is a FAILING signal. A failed read means nothing was judged; an absent mandatory
  // lens means the bar was never applied. Either way the round cannot accept.
  const humanRequired = !obs.read.ok || obs.panel.absentMandatory.length > 0;

  const verdict = derivePanelVerdict({
    lensVerdicts,
    humanRequired,
    conflict,
    mandatoryLenses: state.mandatoryLenses,
    findings: allFindings,
  });

  return { verdict, lensVerdicts, findings: allFindings, humanRequired };
}

/** Freeze a new state object over the previous one. */
function next(state, patch) {
  return Object.freeze({ ...state, ...patch });
}

/** Append one round to the audit trail. */
function withHistory(state, entry) {
  return Object.freeze([...state.history, Object.freeze(entry)]);
}

/**
 * THE STEP FUNCTION — the loop's entire control flow, as one pure transition.
 *
 * Call it with the state and the round's observations; it returns the next ACTION and the next STATE. The
 * harness performs the action, gathers the raw results, calls `deriveRoundObservations`, and steps again. The
 * harness never re-decides anything the core decided, and the core never touches the world.
 *
 * ORDER OF PRECEDENCE, and why each rule sits where it does:
 *   1. A failed READ escalates immediately. There is no material, so a panel would judge nothing. (The harness
 *      this was extracted from ran the panel anyway and let it degrade at reduce time; the OUTCOME is identical —
 *      `escalate` on a `needs-human` verdict — but short-circuiting saves a fan-out that cannot produce signal.)
 *   2. An absent MANDATORY lens forces `needs-human` inside the reduction, which `deriveNegotiationOutcome`
 *      turns into `escalate` at any round. A dead reviewer NEVER reads as accept, and no round budget saves it.
 *   3. The ROUND-CAP BACKSTOP is enforced HERE, from the core's own counter — never from a value an LLM returned.
 *      This is defence-in-depth: `deriveNegotiationOutcome` already applies the cap, but a loop must be bounded
 *      by its own arithmetic too, or a single bad agent reply becomes an unbounded run.
 *   4. A grounded INVITE is preferred over an editor round: a discovery deserves a fresh, larger jury on the
 *      SAME material before anyone revises it. It SPENDS a round and never resets the counter.
 *   5. An editor that could not ADVANCE the material escalates. Re-judging byte-identical material would just
 *      replay the same verdict until the cap.
 *
 * @param {object} state
 * @param {ReturnType<typeof deriveRoundObservations>} obs
 * @param {{conflict?: boolean, requiredTestGreen?: boolean}} [o]
 * @returns {{action: string, state: object, verdict?: string, outcome?: string, findings?: any[],
 *   lensVerdicts?: Record<string,string>, invite?: object|null, reason?: string}}
 */
export function convergeStep(state, obs, { conflict = false, requiredTestGreen = true } = {}) {
  if (state.done) return { action: CONVERGE_ACTIONS.ESCALATE, state, reason: 'already-done' };

  // ── 1. No material → nothing can be judged. Escalate (fail-closed).
  if (!obs.read.ok) {
    return {
      action: CONVERGE_ACTIONS.ESCALATE,
      state: next(state, { done: true, history: withHistory(state, { round: state.round, verdict: VERDICTS.NEEDS_HUMAN, reason: ESCALATION_REASONS.READ_FAILED }) }),
      verdict: VERDICTS.NEEDS_HUMAN,
      outcome: NEGOTIATION_OUTCOMES.ESCALATE,
      reason: ESCALATION_REASONS.READ_FAILED,
    };
  }

  // ── A read that succeeded but no panel yet → judge it.
  if (!obs.panel.observed) return { action: CONVERGE_ACTIONS.PANEL, state };

  // ── 2. Reduce the raw lens results (forces needs-human on absent mandatory lenses).
  const { verdict, lensVerdicts, findings, humanRequired } = reducePanelRound(state, obs, { conflict });
  let outcome = deriveNegotiationOutcome({ verdict, round: state.round, roundCap: state.roundCap, requiredTestGreen });

  // ── 3. THE CAP BACKSTOP — bound the loop by this counter, never by a returned value.
  if (outcome === NEGOTIATION_OUTCOMES.CONTINUE && state.round >= state.roundCap) {
    outcome = NEGOTIATION_OUTCOMES.ESCALATE;
  }

  const historyEntry = { round: state.round, verdict, findings: findings.length, lensVerdicts };

  if (outcome === NEGOTIATION_OUTCOMES.LAND) {
    return {
      action: CONVERGE_ACTIONS.LAND,
      state: next(state, { done: true, history: withHistory(state, historyEntry) }),
      verdict, outcome, findings, lensVerdicts,
    };
  }

  if (outcome === NEGOTIATION_OUTCOMES.ESCALATE) {
    const reason = obs.panel.absentMandatory.length ? ESCALATION_REASONS.MANDATORY_LENS_ABSENT
      : verdict === VERDICTS.NEEDS_HUMAN ? ESCALATION_REASONS.NEEDS_HUMAN
        : ESCALATION_REASONS.ROUND_CAP;
    return {
      action: CONVERGE_ACTIONS.ESCALATE,
      state: next(state, { done: true, history: withHistory(state, { ...historyEntry, reason }) }),
      verdict, outcome, findings, lensVerdicts, reason,
    };
  }

  // ── outcome === continue ──────────────────────────────────────────────────────────────────────────────────

  // ── 4. A grounded invite outranks an editor round — but only BEFORE an editor has run this round.
  if (!obs.edit.observed) {
    const invite = pickGroundedInvite(obs.panel.invites, state.seatableLenses);
    if (invite) return { action: CONVERGE_ACTIONS.INVITE, state, verdict, outcome, findings, lensVerdicts, invite };
    return { action: CONVERGE_ACTIONS.EDIT, state, verdict, outcome, findings, lensVerdicts };
  }

  // ── 5. An editor ran. If it could not advance the material, re-judging is pointless.
  const dismissed = Object.freeze([...state.dismissed, ...obs.edit.dismissed]);
  if (!obs.edit.advanced) {
    return {
      action: CONVERGE_ACTIONS.ESCALATE,
      state: next(state, { done: true, dismissed, history: withHistory(state, { ...historyEntry, reason: ESCALATION_REASONS.EDITOR_STALLED }) }),
      verdict: VERDICTS.NEEDS_HUMAN,
      outcome: NEGOTIATION_OUTCOMES.ESCALATE,
      findings, lensVerdicts,
      reason: ESCALATION_REASONS.EDITOR_STALLED,
    };
  }

  // The editor advanced the material — spend a round and re-read it for the next panel.
  return {
    action: CONVERGE_ACTIONS.READ,
    state: next(state, { round: state.round + 1, dismissed, history: withHistory(state, historyEntry) }),
    verdict, outcome, findings, lensVerdicts,
  };
}

/**
 * Apply an accepted juror invite to the state — GROW-ONLY, re-derived from the loop's OWN inputs.
 *
 * TRUST BOUNDARY (#2640). The invite derivation runs behind an agent, and an agent's ECHO cannot be trusted to
 * have preserved the grow-only shape: a misbehaving or prompt-injected invite agent could echo a SHRUNK roster
 * (`{ jurorsPerLens: 1, seatedLenses: ['simplicity'] }`) and drop the mandatory lenses mid-loop. So the echo is
 * ADVISORY ONLY — accept/reject plus a ceiling-bounded target — and the actual roster is re-derived here from
 * state the attacker does not control, via the tested specs `growOnlyRoster` / `floorGrowOnlyJurors`.
 *
 * The invite SPENDS a round (the counter advances) and NEVER resets it, so a chain of invites is bounded by the
 * same `roundCap` as everything else. If spending that round would exceed the cap, this escalates instead.
 *
 * @param {object} state
 * @param {{accepted?: boolean, toCareLevel?: string, jurorsPerLens?: number, addedLenses?: any[],
 *   reason?: string}|null} echo - what the invite agent returned (advisory).
 * @param {{lens: string, citedFinding: string}} invite
 * @returns {{action: string, state: object, applied: boolean, reason?: string}}
 */
export function applyJurorInvite(state, echo, invite) {
  if (!echo || echo.accepted !== true) {
    // Not applied — fall through to a normal editor round on the SAME round number.
    return { action: CONVERGE_ACTIONS.EDIT, state, applied: false, reason: (echo && echo.reason) || 'no-delta' };
  }

  const echoedAdded = Array.isArray(echo.addedLenses)
    ? echo.addedLenses.map((a) => (typeof a === 'string' ? a : (a && typeof a.lens === 'string' ? a.lens : ''))).filter(Boolean)
    : [];

  // Grow-only union, then keep only lenses this caller can actually seat — a mandatory lens is always seatable,
  // so it can never be filtered out of the roster by this step.
  const grown = growOnlyRoster(state.activeLenses, invite.lens, echoedAdded)
    .filter((l) => state.seatableLenses.includes(l) || state.mandatoryLenses.includes(l));
  const perLens = floorGrowOnlyJurors(state.jurorsPerLens, echo.jurorsPerLens, state.jurorCeiling);

  const round = state.round + 1;
  if (round > state.roundCap) {
    return {
      action: CONVERGE_ACTIONS.ESCALATE,
      state: next(state, { done: true, history: withHistory(state, { round: state.round, reason: ESCALATION_REASONS.ROUND_CAP }) }),
      applied: false,
      reason: ESCALATION_REASONS.ROUND_CAP,
    };
  }

  // Record the round the invite SPENT. `convergeStep` appends a history entry at the END of an ordinary round
  // (after the editor), and an invite round has no editor — so without this the round that grew the jury would
  // vanish from the audit trail, and an escalation packet would under-report how the budget was actually used.
  const historyEntry = {
    round: state.round,
    invited: invite.lens,
    citedFinding: invite.citedFinding,
    fromCareLevel: state.careLevel,
    toCareLevel: typeof echo.toCareLevel === 'string' && echo.toCareLevel ? echo.toCareLevel : state.careLevel,
  };

  return {
    action: CONVERGE_ACTIONS.READ,
    state: next(state, {
      round,
      careLevel: historyEntry.toCareLevel,
      jurorsPerLens: perLens,
      activeLenses: Object.freeze(grown),
      history: withHistory(state, historyEntry),
    }),
    applied: true,
  };
}

/**
 * Build the operator-facing escalation packet from a finished state. Pure; the caller renders/persists it.
 * @param {object} state
 * @param {{verdict?: string, findings?: any[], reason?: string}} [last]
 */
export function buildEscalationPacket(state, last = {}) {
  return {
    reason: last.reason || ESCALATION_REASONS.NEEDS_HUMAN,
    roundsRun: state.round,
    roundCap: state.roundCap,
    verdict: last.verdict || VERDICTS.NEEDS_HUMAN,
    history: [...state.history],
    findings: Array.isArray(last.findings) ? last.findings : [],
    dismissed: [...state.dismissed],
  };
}
