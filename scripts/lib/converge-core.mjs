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
 *     (verdict + round + cap + requiredTestGreen → land|continue|escalate), `normalizeFindings` (raw juror
 *     output → the canonical finding shape), `buildPanelFindings` (findings → findings stamped with their
 *     originating lens as `category: '<lens>/<cat>'`), `redTeamRequired` + `foldRedTeamVerdict` (the #2707
 *     pre-LAND ratification pair), `MANDATORY_LENSES`, `NEGOTIATION_ROUND_CAP`, `VERDICTS`,
 *     `NEGOTIATION_OUTCOMES`.
 *   from we:scripts/lib/review-core.mjs — `growOnlyRoster`, `floorGrowOnlyJurors`, `absentMandatoryLenses`.
 *
 * THE DECLARED LIST ABOVE IS MACHINE-CHECKED against this module's actual `import` specifiers by
 * `check:standards` (rule 16, `checkDeclaredContract`). It drifted from the import list before it ever shipped —
 * `normalizeFindings` was imported and called and never declared — which is the exact false negative the block
 * exists to prevent, so the block is no longer maintained by hand.
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
  buildPanelFindings,
  redTeamRequired,
  foldRedTeamVerdict,
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
  /**
   * RATIFY the accept (#2707) — an adversarial red-team actively tries to BREAK the final material before it
   * lands. `we:scripts/lib/jury-core.mjs` states the rule and single-sources it as `redTeamRequired` /
   * `foldRedTeamVerdict`; this member is what makes the stage reachable from the loop. It SPENDS NO ROUND: it
   * judges the material the panel just accepted, so the round counter is unchanged.
   */
  RED_TEAM: 'red-team',
  /** Converged — a non-author panel accepted the final material AND a red-team failed to break it. */
  LAND: 'land',
  /** Deadlocked / degraded — a human decides. */
  ESCALATE: 'escalate',
});

/** Why an escalation happened. Rides the escalation packet so an operator sees one shape for every cause. */
export const ESCALATION_REASONS = Object.freeze({
  READ_FAILED: 'read-failed',
  /** The read SUCCEEDED and the material was empty — a distinct, ordinary case, not a broken read. */
  NOTHING_TO_REVIEW: 'nothing-to-review',
  MANDATORY_LENS_ABSENT: 'mandatory-lens-absent',
  ROUND_CAP: 'round-cap',
  EDITOR_STALLED: 'editor-stalled',
  /** A red-team was scheduled and did not run. An unrun red-team NEVER ratifies (#2707). */
  RED_TEAM_UNRUN: 'red-team-unrun',
  /** The observations the harness fed back are not stamped for the round the core is on. */
  STALE_OBSERVATIONS: 'stale-observations',
  /** The reduction could not be performed at all (e.g. an inconsistent mandatory-lens set). */
  REDUCTION_FAILED: 'reduction-failed',
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
  // An UNSTATED budget is the smallest one, for the same reason an out-of-range one is (see the clamp below).
  roundCap = 1,
  jurorCeiling = jurorsPerLens,
  activeLenses = [],
  mandatoryLenses = MANDATORY_LENSES,
  seatableLenses = activeLenses,
} = {}) {
  // FAIL SAFE, NOT LOOSE (PR #1064 review). An out-of-range `roundCap` — `0`, `NaN`, any non-numeric — used to
  // become `NEGOTIATION_ROUND_CAP`, i.e. the MAXIMUM. `panelRigorForCareLevel('none')` legitimately returns
  // `rounds: 0`, so the WEAKEST care band bought the LARGEST possible round budget. For a budget the safe
  // default is the SMALLEST value; `we:scripts/workflows/review-parked-prs.mjs` already floors it at 1, and the
  // extraction had reversed the safety direction.
  const asked = Math.floor(Number(roundCap));
  const cap = Number.isFinite(asked) && asked >= 1 ? Math.min(asked, NEGOTIATION_ROUND_CAP) : 1;
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
 * MULTI-JUROR LENSES UNION HERE (PR #1064 review, blocker 4). At `--care=high` the panel runs N jurors PER LENS,
 * so the harness reports N entries with the same `lens`. Before this, `reducePanelRound` iterated them and
 * `lensVerdicts[lens]` was overwritten by whichever arrived LAST — the same two jurors produced `land` or `edit`
 * depending on array order. Every entry for a lens is now folded through `reduceLensJury` (diversity-SELECTION:
 * the UNION of every juror's findings; the lens counts as having RUN iff at least one juror ran), which is what
 * `we:scripts/workflows/review-parked-prs.mjs` has always done before reducing.
 *
 * @param {{readResult?: any, lensResults?: any[], invites?: any[], editResult?: any, redTeamResult?: any,
 *   round?: number, requiredTestGreen?: boolean, conflict?: boolean, mandatoryLenses?: string[]}} [o]
 * @returns {{round: number|null, read: {ok: boolean, empty: boolean, material: string},
 *   panel: {lensResults: Array<{lens: string, ok: boolean, findings: any[]}>, jurorCounts: Record<string,number>,
 *   ranOkLenses: string[], failedLenses: string[], absentMandatory: string[], mandatoryLenses: string[],
 *   invites: any[], observed: boolean}, edit: {observed: boolean, advanced: boolean, dismissed: any[]},
 *   redTeam: {observed: boolean, ran: boolean, findings: any[]},
 *   gates: {requiredTestGreen: boolean, conflict: boolean}}}
 */
export function deriveRoundObservations({
  readResult,
  lensResults,
  invites,
  editResult,
  redTeamResult,
  round,
  requiredTestGreen = true,
  conflict = false,
  mandatoryLenses = MANDATORY_LENSES,
} = {}) {
  // ── READ. The result must be present, carry no error, and carry a STRING `material`. Anything else is a failed
  //    read. An EMPTY string is NOT a failed read (PR #1064 review): a freshly created lane, or one whose agent
  //    has saved nothing, is the ordinary case — telling the operator the read broke when it plainly worked is a
  //    false diagnosis. It is reported separately as `empty`, and `convergeStep` terminates it with its own
  //    reason. Judging nothing still never reads as accept.
  const material = readResult && typeof readResult.material === 'string' ? readResult.material : '';
  const readOk = !!(readResult && !readResult.error && typeof readResult.material === 'string');
  const readEmpty = readOk && material.length === 0;

  // ── PANEL. `observed` distinguishes "no panel ran yet this step" from "a panel ran and every lens failed".
  const rawLens = Array.isArray(lensResults) ? lensResults : null;
  const perJuror = (rawLens || []).map((r) => ({
    lens: r && typeof r.lens === 'string' ? r.lens : '',
    ok: !!(r && r.ok === true),
    findings: r && Array.isArray(r.findings) ? r.findings : [],
  })).filter((r) => r.lens);

  // Fold every juror entry for a lens into ONE lens result, in first-seen lens order. Order-independent by
  // construction: the union is a flatMap over all jurors that ran, so `[dirty, clean]` and `[clean, dirty]`
  // produce the same findings set and therefore the same verdict.
  const byLens = new Map();
  for (const r of perJuror) {
    if (!byLens.has(r.lens)) byLens.set(r.lens, []);
    byLens.get(r.lens).push(r);
  }
  const normalizedLens = [...byLens.entries()].map(([lens, jurors]) => reduceLensJury(lens, jurors));
  const jurorCounts = Object.fromEntries([...byLens.entries()].map(([lens, jurors]) => [lens, jurors.length]));

  const ranOkLenses = normalizedLens.filter((r) => r.ok).map((r) => r.lens);
  const failedLenses = normalizedLens.filter((r) => !r.ok).map((r) => r.lens);

  // A mandatory lens is absent whether it RAN AND ERRORED or was NEVER SCHEDULED — keying only on failures let a
  // shrunk roster that never ran a mandatory lens see zero failures and reduce to accept (#2640).
  const mandatory = Array.isArray(mandatoryLenses) ? [...mandatoryLenses] : [...MANDATORY_LENSES];
  const absentMandatory = absentMandatoryLenses(ranOkLenses, mandatory);

  // ── EDIT. `advanced` is what stops the loop re-judging identical material forever. It must be reported by the
  //    editor; an absent or non-true value is read as NOT advanced (fail-closed).
  const editObserved = editResult != null;
  const advanced = !!(editResult && editResult.advanced === true);
  const dismissed = editResult && Array.isArray(editResult.dismissed) ? editResult.dismissed : [];

  // ── RED TEAM (#2707). Same fail-closed sensing as everything else: `ran` must be reported TRUE explicitly.
  const redTeamObserved = redTeamResult != null;
  const redTeamRan = !!(redTeamResult && redTeamResult.ran === true && !redTeamResult.error);

  return {
    // ── ROUND STAMP. Which round the harness says these observations describe. `convergeStep` refuses a panel or
    //    edit observation that is not stamped for the round it is on — a harness that keeps APPENDING to one
    //    observation blob (plausible, and nothing told it not to) otherwise re-sends stale `lensResults` +
    //    `editResult` and burns the whole budget with no second panel while the ledger reports N panels ran.
    round: Number.isFinite(Number(round)) ? Math.floor(Number(round)) : null,
    read: { ok: readOk, empty: readEmpty, material },
    panel: {
      lensResults: normalizedLens,
      jurorCounts,
      ranOkLenses,
      failedLenses,
      absentMandatory,
      // Recorded so the reduction has exactly ONE source for the mandatory set. Two independent sources (this
      // argument and `state.mandatoryLenses`) could disagree, and disagreement made `derivePanelVerdict` THROW.
      mandatoryLenses: mandatory,
      invites: Array.isArray(invites) ? invites : [],
      observed: rawLens !== null,
    },
    edit: { observed: editObserved, advanced, dismissed },
    redTeam: {
      observed: redTeamObserved,
      ran: redTeamRan,
      findings: redTeamResult && Array.isArray(redTeamResult.findings) ? redTeamResult.findings : [],
    },
    // The #2410 clause that stops an `accept` auto-landing over a red or pending required `test` check now has a
    // CHANNEL through the seam instead of being a defaulted argument no caller could reach.
    gates: { requiredTestGreen: requiredTestGreen !== false, conflict: conflict === true },
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
 * WHY NOT `reduceReview` (PR #1064 review, cosmetic 6 — a DELIBERATE non-adoption, not an oversight). The drain
 * shells `reduceReview` (`we:scripts/review-core-cli.mjs`) for the same `derivePanelVerdict` →
 * `deriveNegotiationOutcome` pair, so routing through it would look like better single-sourcing. It is not:
 *   • `reduceReview` takes `lensVerdicts` ALREADY REDUCED. The per-lens `deriveVerdict` pass and the multi-juror
 *     union — the exact half the extraction jury insisted stay inside this core, because a pre-reduced verdict
 *     makes "a crashed MANDATORY lens degrades the round" unreachable from in here — would still live here.
 *     Nothing is deduplicated.
 *   • It lives in a CLI SCRIPT, not a lib. A `scripts/lib/*.mjs` module importing a shebang CLI inverts the
 *     dependency direction the rest of this tree keeps.
 *   • The two clauses the composition would buy — `requiredTestGreen` and `conflict` — are single-sourced the
 *     SAME way `reduceReview` gets them: straight from `deriveNegotiationOutcome` / `derivePanelVerdict` in
 *     jury-core, now with a real channel through `obs.gates`. A clause added to jury-core reaches both callers.
 * What WAS adopted from the same finding is `buildPanelFindings` — the findings-provenance stamp, which really
 * was re-implemented inline here.
 *
 * TOTAL, INCLUDING ON AN INCONSISTENT MANDATORY SET (PR #1064 review). `derivePanelVerdict` THROWS on an empty
 * or disagreeing mandatory-lens set, which contradicts this module's "every export is a total function of its
 * arguments" header and exits a harness with a stack trace instead of a fail-closed escalation packet. The
 * mandatory set now has ONE source (the one the observation recorded), and the reduction degrades a throw to
 * `needs-human` with the cause attached.
 *
 * @param {object} state
 * @param {ReturnType<typeof deriveRoundObservations>} obs
 * @param {{conflict?: boolean}} [o] - `conflict` marks a known cross-mandate conflict for `derivePanelVerdict`.
 *   (`requiredTestGreen` belongs to `deriveNegotiationOutcome`, not here — it was documented on this signature
 *   by mistake and never accepted.)
 * @returns {{verdict: string, lensVerdicts: Record<string,string>, findings: any[], humanRequired: boolean,
 *   reductionError: string|null}}
 */
export function reducePanelRound(state, obs, { conflict } = {}) {
  const lensVerdicts = {};
  const allFindings = [];
  for (const r of obs.panel.lensResults) {
    if (!r.ok) continue;
    const findings = normalizeFindings(r.findings);
    lensVerdicts[r.lens] = deriveVerdict({ findings });
    // Provenance comes from the shared `buildPanelFindings` (the `category: '<lens>/<cat>'` stamp), not from an
    // inline `{...f, lens}` re-implementation (PR #1064 review). `lens` is kept alongside it because the
    // escalation packet and the editor prompt read that field directly.
    for (const f of buildPanelFindings({ [r.lens]: r.findings })) allFindings.push({ ...f, lens: r.lens });
  }

  // FAIL-CLOSED: missing signal is a FAILING signal. A failed read means nothing was judged; an absent mandatory
  // lens means the bar was never applied. Either way the round cannot accept.
  const humanRequired = !obs.read.ok || obs.read.empty || obs.panel.absentMandatory.length > 0;

  // ONE source for the mandatory set — the set the observation was derived against. `state.mandatoryLenses` is
  // the fallback only when an observation predates the stamp (an older harness).
  const mandatory = Array.isArray(obs.panel.mandatoryLenses) && obs.panel.mandatoryLenses.length
    ? obs.panel.mandatoryLenses
    : state.mandatoryLenses;

  let verdict;
  let reductionError = null;
  try {
    verdict = derivePanelVerdict({
      lensVerdicts,
      humanRequired,
      conflict: conflict === true || obs?.gates?.conflict === true,
      mandatoryLenses: mandatory,
      findings: allFindings,
    });
  } catch (err) {
    verdict = VERDICTS.NEEDS_HUMAN;
    reductionError = err && err.message ? err.message : String(err);
  }

  return { verdict, lensVerdicts, findings: allFindings, humanRequired, reductionError };
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
 *   3. A grounded INVITE is preferred over an editor round: a discovery deserves a fresh, larger jury on the
 *      SAME material before anyone revises it. It SPENDS a round and never resets the counter.
 *   4. An editor that could not ADVANCE the material escalates. Re-judging byte-identical material would just
 *      replay the same verdict until the cap.
 *   5. AN ACCEPT IS NOT A LAND UNTIL A RED-TEAM FAILS TO BREAK IT (#2707). `deriveNegotiationOutcome` returning
 *      `land` schedules `RED_TEAM`, not `LAND`; only `foldRedTeamVerdict` on an adversary that actually RAN and
 *      came back clean turns it into `LAND`. An unrun red-team never ratifies.
 *
 * THE ROUND CAP IS `deriveNegotiationOutcome`'S, SINGLY (PR #1064 review, cosmetic 3). An earlier "cap backstop"
 * branch here re-applied `round >= roundCap`; it was mutation-verified DEAD — deleting it left every test green,
 * including the one named for it — because the declared jury-core contract already guarantees it. A second
 * unreachable copy of a rule is not defence in depth, it is drift waiting to happen; the guarantee is pinned as a
 * CONTRACT TEST against `deriveNegotiationOutcome` instead, which is where a drift would actually be caught.
 *
 * @verdicts-partial this is not a verdict REDUCER — the verdict→outcome mapping is `deriveNegotiationOutcome`'s
 *   (single-sourced in jury-core, and total there). `convergeStep` only branches on the OUTCOME, and touches two
 *   `VERDICTS` members incidentally: `ACCEPT` as the value `foldRedTeamVerdict` must return to ratify a land, and
 *   `NEEDS_HUMAN` as the verdict it stamps on a degradation it detected itself (a failed/empty read, a stalled
 *   editor). Enumerating the rest here would be a SECOND reducer, which is the drift the totality gate exists to
 *   prevent.
 *
 * @param {object} state
 * @param {ReturnType<typeof deriveRoundObservations>} obs
 * @param {{conflict?: boolean, requiredTestGreen?: boolean}} [o] - fallbacks only; `obs.gates` wins when present.
 * @returns {{action: string, state: object, verdict?: string, outcome?: string, findings?: any[],
 *   lensVerdicts?: Record<string,string>, invite?: object|null, reason?: string, dismissed?: any[]}}
 */
export function convergeStep(state, obs, { conflict = false, requiredTestGreen = true } = {}) {
  if (state.done) return { action: CONVERGE_ACTIONS.ESCALATE, state, reason: 'already-done' };

  const gates = obs.gates || {};
  const testGreen = gates.requiredTestGreen !== undefined ? gates.requiredTestGreen : requiredTestGreen;

  /** Terminate the loop, always carrying the accumulated dismissals forward. */
  const terminate = (action, entry, extra) => ({
    action,
    state: next(state, {
      done: true,
      // `dismissed` is accumulated on EVERY terminal branch, not just `continue` (PR #1064 review). Its own
      // docstring promised "never silently dropped" while the land and escalate branches returned earlier and
      // dropped it, so `buildEscalationPacket` under-reported the very dismissals it exists to carry.
      dismissed: Object.freeze([...state.dismissed, ...(obs.edit?.dismissed || [])]),
      history: withHistory(state, entry),
    }),
    ...extra,
  });

  // ── 1. No material → nothing can be judged. Escalate (fail-closed).
  if (!obs.read.ok) {
    return terminate(CONVERGE_ACTIONS.ESCALATE,
      { round: state.round, verdict: VERDICTS.NEEDS_HUMAN, reason: ESCALATION_REASONS.READ_FAILED },
      { verdict: VERDICTS.NEEDS_HUMAN, outcome: NEGOTIATION_OUTCOMES.ESCALATE, reason: ESCALATION_REASONS.READ_FAILED });
  }

  // ── 1b. The read SUCCEEDED and there is nothing in it. Distinct from a broken read: the loop still cannot
  //    accept (nothing was judged), but the operator is told the truth about why.
  if (obs.read.empty) {
    return terminate(CONVERGE_ACTIONS.ESCALATE,
      { round: state.round, verdict: VERDICTS.NEEDS_HUMAN, reason: ESCALATION_REASONS.NOTHING_TO_REVIEW },
      { verdict: VERDICTS.NEEDS_HUMAN, outcome: NEGOTIATION_OUTCOMES.ESCALATE, reason: ESCALATION_REASONS.NOTHING_TO_REVIEW });
  }

  // ── 1c. MALFORMED OBSERVATION (#2975). An `editResult` or `redTeamResult` can only exist because a panel ran
  //    and produced findings to edit against or an accept to ratify — so either arriving with NO `lensResults`
  //    for this round is not "no panel yet," it is a caller that dropped the panel it already has. Read that
  //    way, this shape fell through to the branch below, which re-panels the UNCHANGED pre-edit material and
  //    silently discards the edit/red-team result — the loop could then reduce, accept, and LAND without the
  //    post-edit material ever having been read, exactly the gap this module's own header promises never
  //    happens. This check MUST run BEFORE the `!obs.panel.observed` short-circuit or it is unreachable from
  //    this input shape — that ordering bug, not a missing check, was the root cause.
  if (!obs.panel.observed && (obs.edit.observed || obs.redTeam.observed)) {
    return terminate(CONVERGE_ACTIONS.ESCALATE,
      { round: state.round, verdict: VERDICTS.NEEDS_HUMAN, reason: ESCALATION_REASONS.STALE_OBSERVATIONS, observedRound: obs.round ?? null },
      { verdict: VERDICTS.NEEDS_HUMAN, outcome: NEGOTIATION_OUTCOMES.ESCALATE, reason: ESCALATION_REASONS.STALE_OBSERVATIONS });
  }

  // ── A read that succeeded but no panel yet → judge it.
  if (!obs.panel.observed) return { action: CONVERGE_ACTIONS.PANEL, state };

  // ── 1d. STALE OBSERVATIONS. A panel/edit observation must be stamped for the round this core is on.
  if (obs.round !== state.round) {
    return terminate(CONVERGE_ACTIONS.ESCALATE,
      { round: state.round, verdict: VERDICTS.NEEDS_HUMAN, reason: ESCALATION_REASONS.STALE_OBSERVATIONS, observedRound: obs.round ?? null },
      { verdict: VERDICTS.NEEDS_HUMAN, outcome: NEGOTIATION_OUTCOMES.ESCALATE, reason: ESCALATION_REASONS.STALE_OBSERVATIONS });
  }

  // ── 2. Reduce the raw lens results (forces needs-human on absent mandatory lenses).
  const reduced = reducePanelRound(state, obs, { conflict });
  const { lensVerdicts, humanRequired, reductionError } = reduced;
  let verdict = reduced.verdict;
  let findings = reduced.findings;
  let outcome = deriveNegotiationOutcome({ verdict, round: state.round, roundCap: state.roundCap, requiredTestGreen: testGreen });

  // ── 3. RATIFY BEFORE LANDING (#2707). An `accept` is a candidate, never a conclusion.
  let redTeamReason = null;
  if (outcome === NEGOTIATION_OUTCOMES.LAND && redTeamRequired(verdict)) {
    if (!obs.redTeam.observed) {
      // Spends NO round — the adversary judges the SAME material the panel just accepted.
      return { action: CONVERGE_ACTIONS.RED_TEAM, state, verdict, outcome, findings, lensVerdicts };
    }
    const ratified = foldRedTeamVerdict({ ran: obs.redTeam.ran, findings: obs.redTeam.findings });
    if (ratified !== VERDICTS.ACCEPT) {
      verdict = ratified;
      findings = [...findings, ...normalizeFindings(obs.redTeam.findings).map((f) => ({ ...f, lens: 'red-team' }))];
      outcome = deriveNegotiationOutcome({ verdict, round: state.round, roundCap: state.roundCap, requiredTestGreen: testGreen });
      if (!obs.redTeam.ran) redTeamReason = ESCALATION_REASONS.RED_TEAM_UNRUN;
    }
  }

  const historyEntry = { round: state.round, verdict, findings: findings.length, lensVerdicts, redTeam: obs.redTeam.observed ? { ran: obs.redTeam.ran, findings: obs.redTeam.findings.length } : null };

  if (outcome === NEGOTIATION_OUTCOMES.LAND) {
    return terminate(CONVERGE_ACTIONS.LAND, historyEntry, { verdict, outcome, findings, lensVerdicts });
  }

  if (outcome === NEGOTIATION_OUTCOMES.ESCALATE) {
    const reason = reductionError ? ESCALATION_REASONS.REDUCTION_FAILED
      : redTeamReason ? redTeamReason
        : obs.panel.absentMandatory.length ? ESCALATION_REASONS.MANDATORY_LENS_ABSENT
          : verdict === VERDICTS.NEEDS_HUMAN ? ESCALATION_REASONS.NEEDS_HUMAN
            : ESCALATION_REASONS.ROUND_CAP;
    return terminate(CONVERGE_ACTIONS.ESCALATE, { ...historyEntry, reason, ...(reductionError ? { reductionError } : {}) },
      { verdict, outcome, findings, lensVerdicts, reason, ...(reductionError ? { reductionError } : {}) });
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
    return terminate(CONVERGE_ACTIONS.ESCALATE, { ...historyEntry, reason: ESCALATION_REASONS.EDITOR_STALLED }, {
      verdict: VERDICTS.NEEDS_HUMAN,
      outcome: NEGOTIATION_OUTCOMES.ESCALATE,
      findings, lensVerdicts,
      reason: ESCALATION_REASONS.EDITOR_STALLED,
    });
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

  // Grow-only union, then drop only lenses this caller cannot seat. THE FILTER CAN NEVER SHRINK THE ROSTER
  // (PR #1064 review): filtering the union against `seatableLenses ∪ mandatoryLenses` alone repealed the
  // grow-only guarantee whenever an ALREADY-ACTIVE lens was not in the seatable set — which is exactly the bug
  // class (#2640) this module cites as its reason to exist, and exactly the shape the `pr-branch` transport will
  // have. Keeping the INCUMBENT roster in the allow-set makes the union monotone by construction: the result is
  // always a superset of `state.activeLenses`.
  const keepable = new Set([...state.activeLenses, ...state.seatableLenses, ...state.mandatoryLenses]);
  const grown = growOnlyRoster(state.activeLenses, invite.lens, echoedAdded).filter((l) => keepable.has(l));
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
