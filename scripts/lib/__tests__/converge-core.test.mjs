/**
 * @file converge-core.test.mjs — proof of the extracted editor↔reviewer CONVERGENCE core (#x2mo71w).
 *
 * These are the tests the loop could NOT have before the extraction. The loop lived inside a Workflow harness
 * body, which is not an importable ES module, so every invariant below was previously "validated" only by
 * running it live against a real PR with nondeterministic LLM jurors — a proof that cannot fail meaningfully.
 *
 * The suite is deliberately weighted toward the FAIL-CLOSED cases (a dead reviewer, a missing mandatory lens, a
 * stalled editor, a shrinking roster echo), because those are where the historical bugs were (#2639 / #2640 /
 * #2450) and because they are exactly the paths a live run almost never exercises.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONVERGE_ACTIONS,
  ESCALATION_REASONS,
  initConvergeState,
  deriveRoundObservations,
  reduceLensJury,
  pickGroundedInvite,
  reducePanelRound,
  convergeStep,
  applyJurorInvite,
  buildEscalationPacket,
} from '../converge-core.mjs';
import {
  VERDICTS,
  NEGOTIATION_OUTCOMES,
  NEGOTIATION_ROUND_CAP,
  MANDATORY_LENSES,
  deriveNegotiationOutcome,
} from '../jury-core.mjs';

const LENSES = ['correctness', 'security', 'simplicity', 'standards-conformance'];

/** A state seeded the way a real caller would. */
function stateWith(over = {}) {
  return initConvergeState({
    activeLenses: LENSES,
    seatableLenses: LENSES,
    jurorsPerLens: 1,
    jurorCeiling: 3,
    roundCap: 3,
    ...over,
  });
}

/** A clean panel — every lens ran, nobody found anything. */
function cleanPanel(lenses = LENSES) {
  return lenses.map((lens) => ({ lens, ok: true, findings: [] }));
}

/** A blocking finding, in the shape `normalizeFindings` expects. */
function blocker(summary = 'a real defect') {
  return { summary, impactIfUnfixed: 'broken', failure_scenario: 'it breaks', category: 'correctness' };
}

const READ_OK = { material: 'diff --git a/x b/x\n+changed' };

/** Observations stamped for a round — the shape every shipped caller sends (see the round-stamp guard below). */
const obs = (o = {}) => deriveRoundObservations({ round: 1, ...o });

/** A red-team that ran and found nothing — what turns an `accept` into a `land` (#2707). */
const RED_TEAM_CLEAN = { ran: true, findings: [] };

describe('reduceLensJury — diversity-selection, never a vote', () => {
  it('unions every juror\'s findings, so any one juror\'s concern carries', () => {
    const r = reduceLensJury('correctness', [
      { ok: true, findings: [blocker('a')] },
      { ok: true, findings: [blocker('b')] },
    ]);
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(2);
  });

  it('counts the lens as run when only SOME jurors ran — a partial jury still judged', () => {
    const r = reduceLensJury('security', [{ ok: false, findings: [] }, { ok: true, findings: [blocker()] }]);
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(1);
  });

  it('fails the lens only when the WHOLE jury failed', () => {
    const r = reduceLensJury('security', [{ ok: false, findings: [] }, { ok: false, findings: [] }]);
    expect(r.ok).toBe(false);
    expect(r.findings).toEqual([]);
  });
});

// ── The regression this suite exists for: `reduceLensJury` was exported and unit-tested and NEVER CALLED, so a
//    multi-juror lens collapsed last-writer-wins inside `reducePanelRound` and the SAME two jurors produced
//    opposite outcomes depending on array order.
describe('multi-juror lenses UNION inside deriveRoundObservations — not last-writer-wins', () => {
  const dirty = { lens: 'correctness', ok: true, findings: [blocker('juror 1 saw it')] };
  const clean = { lens: 'correctness', ok: true, findings: [] };
  const rest = cleanPanel(['security', 'simplicity', 'standards-conformance']);

  it('folds two jurors of one lens into ONE lens result', () => {
    const o = obs({ readResult: READ_OK, lensResults: [dirty, clean, ...rest] });
    expect(o.panel.lensResults.filter((r) => r.lens === 'correctness')).toHaveLength(1);
    expect(o.panel.jurorCounts.correctness).toBe(2);
  });

  it('the strict juror carries, in BOTH array orders — order used to flip land↔edit', () => {
    for (const order of [[dirty, clean], [clean, dirty]]) {
      const r = convergeStep(stateWith(), obs({ readResult: READ_OK, lensResults: [...order, ...rest] }));
      expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
      expect(r.lensVerdicts.correctness).toBe(VERDICTS.CHANGES);
    }
  });

  it('a lens whose WHOLE jury failed still reads as absent', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [
        { lens: 'security', ok: false, findings: [] },
        { lens: 'security', ok: false, findings: [] },
        ...cleanPanel(['correctness']),
      ],
    });
    expect(o.panel.absentMandatory).toContain('security');
  });
});

describe('deriveRoundObservations — the sensing half reads missing signal as FAILURE', () => {
  it('treats an EMPTY diff as a successful read of nothing — NOT a broken read', () => {
    const r = deriveRoundObservations({ round: 1, readResult: { material: '' } }).read;
    expect(r.ok).toBe(true);
    expect(r.empty).toBe(true);
  });

  it('treats an errored read as failed even when material is present', () => {
    expect(obs({ readResult: { material: 'x', error: 'boom' } }).read.ok).toBe(false);
  });

  it('treats an absent read result as failed', () => {
    expect(obs({}).read.ok).toBe(false);
  });

  it('treats a non-string material as failed — a harness cannot fake a read with a truthy object', () => {
    expect(obs({ readResult: { material: { toString: () => 'x' } } }).read.ok).toBe(false);
  });

  it('reports a mandatory lens that CRASHED as absent', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [] }, { lens: 'security', ok: false, findings: [] }],
    });
    expect(o.panel.absentMandatory).toContain('security');
  });

  it('reports a mandatory lens that was NEVER SCHEDULED as absent — the #2640 shrunk-roster hole', () => {
    const o = obs({ readResult: READ_OK, lensResults: [{ lens: 'simplicity', ok: true, findings: [] }] });
    expect(o.panel.absentMandatory).toEqual(expect.arrayContaining([...MANDATORY_LENSES]));
  });

  it('distinguishes "no panel ran yet" from "a panel ran and every lens failed"', () => {
    expect(obs({ readResult: READ_OK }).panel.observed).toBe(false);
    expect(obs({ readResult: READ_OK, lensResults: [] }).panel.observed).toBe(true);
  });

  it('reads an editor that reported nothing as NOT advanced', () => {
    expect(obs({ readResult: READ_OK, editResult: {} }).edit.advanced).toBe(false);
    expect(obs({ readResult: READ_OK, editResult: { advanced: 'yes' } }).edit.advanced).toBe(false);
    expect(obs({ readResult: READ_OK, editResult: { advanced: true } }).edit.advanced).toBe(true);
  });

  it('reads a red-team that did not explicitly report `ran: true` as NOT run', () => {
    expect(obs({ readResult: READ_OK, redTeamResult: {} }).redTeam.ran).toBe(false);
    expect(obs({ readResult: READ_OK, redTeamResult: { ran: true, error: 'crashed' } }).redTeam.ran).toBe(false);
    expect(obs({ readResult: READ_OK, redTeamResult: { ran: true } }).redTeam.ran).toBe(true);
  });

  it('carries the #2410 required-test-check gate through the seam, defaulting GREEN only when unsaid', () => {
    expect(obs({ readResult: READ_OK }).gates.requiredTestGreen).toBe(true);
    expect(obs({ readResult: READ_OK, requiredTestGreen: false }).gates.requiredTestGreen).toBe(false);
  });

  it('records the round it was stamped for', () => {
    expect(deriveRoundObservations({ round: 3, readResult: READ_OK }).round).toBe(3);
    expect(deriveRoundObservations({ readResult: READ_OK }).round).toBeNull();
  });
});

describe('initConvergeState fails SAFE on a bad round cap — the smallest budget, never the largest', () => {
  it('floors a zero cap at 1 rather than opening the maximum', () => {
    // `panelRigorForCareLevel('none')` legitimately returns `rounds: 0`; the weakest care band must not buy the
    // most expensive possible run.
    expect(initConvergeState({ roundCap: 0 }).roundCap).toBe(1);
  });

  it('floors a non-numeric cap at 1', () => {
    for (const bad of [NaN, undefined, null, 'abc', -4, {}]) {
      expect(initConvergeState({ roundCap: bad }).roundCap).toBe(1);
    }
  });

  it('still clamps an over-large cap DOWN to the engine ceiling', () => {
    expect(initConvergeState({ roundCap: 99 }).roundCap).toBe(NEGOTIATION_ROUND_CAP);
  });
});

describe('reducePanelRound — a round with missing signal can only reduce to needs-human', () => {
  it('forces humanRequired when a mandatory lens is absent, even with zero findings', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [] }, { lens: 'simplicity', ok: true, findings: [] }],
    });
    const r = reducePanelRound(stateWith(), o);
    expect(r.humanRequired).toBe(true);
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('forces humanRequired when the read failed', () => {
    expect(reducePanelRound(stateWith(), obs({ readResult: { error: 'boom' }, lensResults: cleanPanel() })).humanRequired).toBe(true);
  });

  it('tags every finding with the lens that raised it', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [...cleanPanel(['correctness']), { lens: 'security', ok: true, findings: [blocker()] }],
    });
    const r = reducePanelRound(stateWith(), o);
    expect(r.findings.every((f) => typeof f.lens === 'string' && f.lens)).toBe(true);
    expect(r.findings.find((f) => f.lens === 'security')).toBeTruthy();
  });

  it('DEGRADES rather than THROWS on an inconsistent mandatory set — every export is total', () => {
    // `derivePanelVerdict` throws on an empty mandatory set. A throw exits a harness with code 1 and a stack
    // trace instead of the fail-closed escalation packet this module exists to produce.
    const s = stateWith({ mandatoryLenses: [] });
    const o = deriveRoundObservations({ round: 1, readResult: READ_OK, lensResults: cleanPanel(), mandatoryLenses: [] });
    let r;
    expect(() => { r = reducePanelRound(s, o); }).not.toThrow();
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
    expect(r.reductionError).toBeTruthy();
  });

  it('an inconsistent mandatory set escalates with its own reason, never a stack trace', () => {
    const s = stateWith({ mandatoryLenses: [] });
    const o = deriveRoundObservations({ round: 1, readResult: READ_OK, lensResults: cleanPanel(), mandatoryLenses: [] });
    const r = convergeStep(s, o);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.REDUCTION_FAILED);
  });
});

describe('convergeStep — the fail-closed decisions', () => {
  it('escalates immediately on a failed read, without judging nothing', () => {
    const r = convergeStep(stateWith(), obs({ readResult: { error: 'the command failed' } }));
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.READ_FAILED);
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('reports an EMPTY read as nothing-to-review, not as a broken read', () => {
    const r = convergeStep(stateWith(), obs({ readResult: { material: '' } }));
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.NOTHING_TO_REVIEW);
    // Still never an accept — there was nothing to judge.
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('asks for a panel once material is in hand', () => {
    expect(convergeStep(stateWith(), obs({ readResult: READ_OK })).action).toBe(CONVERGE_ACTIONS.PANEL);
  });

  it('REFUSES observations stamped for another round — a harness appending to one blob re-sends stale results', () => {
    const stale = deriveRoundObservations({ round: 1, readResult: READ_OK, lensResults: cleanPanel() });
    const r = convergeStep({ ...stateWith(), round: 2 }, stale);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.STALE_OBSERVATIONS);
  });

  it('REFUSES unstamped panel observations — an absent stamp is not a matching one', () => {
    const unstamped = deriveRoundObservations({ readResult: READ_OK, lensResults: cleanPanel() });
    const r = convergeStep(stateWith(), unstamped);
    expect(r.reason).toBe(ESCALATION_REASONS.STALE_OBSERVATIONS);
  });

  // #2975 — a driver that reports `editResult` (or `redTeamResult`) without re-sending `lensResults` used to hit
  // the `!obs.panel.observed` short-circuit BEFORE the staleness/consistency guard could ever see it, so it got a
  // fresh `panel` action seeded with the PRE-edit material instead of the escalation the module's own header
  // promises. That panel could then land on material nobody judged, with the round's prior findings never
  // re-confirmed.
  it('ESCALATES an editResult reported with no lensResults for the round — not a fresh panel on stale material', () => {
    const malformed = obs({ readResult: READ_OK, editResult: { advanced: true } });
    expect(malformed.panel.observed).toBe(false); // sanity: this is exactly the "no panel" shape
    const r = convergeStep(stateWith(), malformed);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.action).not.toBe(CONVERGE_ACTIONS.PANEL);
    expect(r.reason).toBe(ESCALATION_REASONS.STALE_OBSERVATIONS);
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('ESCALATES a redTeamResult reported with no lensResults for the round — same malformed shape', () => {
    const malformed = obs({ readResult: READ_OK, redTeamResult: RED_TEAM_CLEAN });
    expect(malformed.panel.observed).toBe(false);
    const r = convergeStep(stateWith(), malformed);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.STALE_OBSERVATIONS);
  });

  it('#2975 END TO END — the reproduction from the backlog item can no longer reach `land`', () => {
    // 1. init → read is implicit (stateWith() starts at round 1, nothing observed).
    let state = stateWith();

    // 2. A round-1 panel over "AAA", every mandate fenced with it → PANEL.
    let r = convergeStep(state, obs({ readResult: { material: 'AAA' } }));
    expect(r.action).toBe(CONVERGE_ACTIONS.PANEL);
    state = r.state;

    // 3. Round-1 lensResults carrying a `security` finding → EDIT, round still 1.
    r = convergeStep(state, obs({
      readResult: { material: 'AAA' },
      lensResults: [{ lens: 'security', ok: true, findings: [blocker('a real security defect')] }, ...cleanPanel(['correctness', 'simplicity', 'standards-conformance'])],
    }));
    expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
    expect(r.state.round).toBe(1);
    state = r.state;

    // 4. `editResult: { advanced: true }` with NO `lensResults` — the malformed shape. The real CLI carries
    //    `readResult` forward within a round (see converge-cli.mjs's `carry`), so `readResult` still reads OK
    //    here exactly as it would for a live driver; what is missing is `lensResults`. Must escalate, not hand
    //    back a fresh `panel` seeded with the same pre-edit "AAA" material.
    r = convergeStep(state, obs({ readResult: { material: 'AAA' }, editResult: { advanced: true } }));
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.action).not.toBe(CONVERGE_ACTIONS.PANEL);
    expect(r.action).not.toBe(CONVERGE_ACTIONS.LAND);
    expect(r.reason).toBe(ESCALATION_REASONS.STALE_OBSERVATIONS);
    // The loop is DONE — there is no path left from here to a `land` over unread material.
    expect(r.state.done).toBe(true);
  });

  it('lands a clean panel ONLY after a red-team fails to break it (#2707)', () => {
    const clean = obs({ readResult: READ_OK, lensResults: cleanPanel() });
    const first = convergeStep(stateWith(), clean);
    expect(first.action).toBe(CONVERGE_ACTIONS.RED_TEAM);
    expect(first.state.done).toBe(false);
    expect(first.state.round).toBe(1); // ratification spends no round

    const ratified = convergeStep(stateWith(), obs({ readResult: READ_OK, lensResults: cleanPanel(), redTeamResult: RED_TEAM_CLEAN }));
    expect(ratified.action).toBe(CONVERGE_ACTIONS.LAND);
    expect(ratified.outcome).toBe(NEGOTIATION_OUTCOMES.LAND);
  });

  it('an UNRUN red-team never ratifies — it escalates instead of landing', () => {
    const r = convergeStep(stateWith(), obs({ readResult: READ_OK, lensResults: cleanPanel(), redTeamResult: { ran: false } }));
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.RED_TEAM_UNRUN);
  });

  it('a red-team that BREAKS the accept feeds its findings back into the same round loop', () => {
    const r = convergeStep(stateWith(), obs({
      readResult: READ_OK,
      lensResults: cleanPanel(),
      redTeamResult: { ran: true, findings: [blocker('the adversary broke it')] },
    }));
    expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
    expect(r.verdict).toBe(VERDICTS.CHANGES);
    expect(r.findings.some((f) => f.lens === 'red-team')).toBe(true);
  });

  it('a RED required test check stops an accept auto-landing (#2410), through the observation seam', () => {
    const r = convergeStep(stateWith(), obs({ readResult: READ_OK, lensResults: cleanPanel(), requiredTestGreen: false }));
    expect(r.action).not.toBe(CONVERGE_ACTIONS.LAND);
  });

  it('NEVER lands when a mandatory reviewer died — a dead reviewer does not read as accept', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [
        { lens: 'correctness', ok: true, findings: [] },
        { lens: 'security', ok: false, findings: [] },
        { lens: 'simplicity', ok: true, findings: [] },
        { lens: 'standards-conformance', ok: true, findings: [] },
      ],
    });
    const r = convergeStep(stateWith(), o);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.MANDATORY_LENS_ABSENT);
  });

  it('escalates a dead mandatory lens at round 1 — no round budget saves it', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: false, findings: [] }, ...cleanPanel(['security'])],
    });
    const r = convergeStep(stateWith({ roundCap: 5 }), o);
    expect(r.state.round).toBe(1);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
  });

  it('sends findings to an editor while under the cap', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
    });
    const r = convergeStep(stateWith(), o);
    expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
    expect(r.findings).toHaveLength(1);
  });

  it('escalates at the cap instead of continuing', () => {
    const o = deriveRoundObservations({
      round: 2,
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
    });
    const atCap = stateWith({ roundCap: 2 });
    const r = convergeStep({ ...atCap, round: 2 }, o);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.ROUND_CAP);
  });

  // The cap used to be re-applied here as a "backstop" branch. It was mutation-verified DEAD — the guarantee
  // belongs to the declared jury-core contract, so THAT is what is pinned, where a drift would actually show.
  it('CONTRACT — deriveNegotiationOutcome never returns `continue` at or past the cap', () => {
    for (const cap of [1, 2, 3, NEGOTIATION_ROUND_CAP]) {
      for (const round of [cap, cap + 1, cap + 7]) {
        expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round, roundCap: cap }))
          .not.toBe(NEGOTIATION_OUTCOMES.CONTINUE);
      }
    }
  });

  it('escalates when the editor could not advance the material', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: false, dismissed: [] },
    });
    const r = convergeStep(stateWith(), o);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.EDITOR_STALLED);
  });

  it('advances the round and re-reads after a successful edit', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary: 'not real', reason: 'by design' }] },
    });
    const r = convergeStep(stateWith(), o);
    expect(r.action).toBe(CONVERGE_ACTIONS.READ);
    expect(r.state.round).toBe(2);
    expect(r.state.dismissed).toHaveLength(1);
  });

  it('keeps dismissed findings across rounds — never silently dropped', () => {
    const mk = (round, summary) => deriveRoundObservations({
      round,
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary, reason: 'stated' }] },
    });
    const r1 = convergeStep(stateWith({ roundCap: 5 }), mk(1, 'one'));
    const r2 = convergeStep(r1.state, mk(2, 'two'));
    expect(r2.state.dismissed.map((d) => d.summary)).toEqual(['one', 'two']);
  });

  // The `dismissed` docstring promised "accumulated across rounds (never silently dropped)" while the LAND and
  // ESCALATE branches returned before the merge — so `buildEscalationPacket` under-reported the very dismissals
  // it exists to carry.
  it('carries dismissals onto the LAND branch too', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: cleanPanel(),
      editResult: { advanced: true, dismissed: [{ summary: 'argued away', reason: 'not real' }] },
      redTeamResult: RED_TEAM_CLEAN,
    });
    const r = convergeStep(stateWith(), o);
    expect(r.state.dismissed.map((d) => d.summary)).toEqual(['argued away']);
  });

  it('carries dismissals onto the ESCALATE branch too', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: false, findings: [] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary: 'argued away', reason: 'not real' }] },
    });
    const r = convergeStep(stateWith(), o);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(buildEscalationPacket(r.state, r).dismissed.map((d) => d.summary)).toEqual(['argued away']);
  });
});

describe('pickGroundedInvite — an invite must be grounded AND seatable', () => {
  it('rejects an invite that cites no finding', () => {
    expect(pickGroundedInvite([{ lens: 'security', citedFinding: '' }], LENSES)).toBeNull();
  });

  it('rejects an invite naming a lens this caller cannot seat', () => {
    expect(pickGroundedInvite([{ lens: 'visual', citedFinding: 'the button overlaps' }], LENSES)).toBeNull();
  });

  it('accepts a grounded, seatable invite and carries who raised it', () => {
    const got = pickGroundedInvite([{ lens: 'security', citedFinding: 'unescaped input', from: 'correctness' }], LENSES);
    expect(got).toEqual({ lens: 'security', citedFinding: 'unescaped input', from: 'correctness' });
  });

  it('applies at most one invite — the first grounded one', () => {
    const got = pickGroundedInvite([
      { lens: 'security', citedFinding: 'first' },
      { lens: 'simplicity', citedFinding: 'second' },
    ], LENSES);
    expect(got.lens).toBe('security');
  });

  it('prefers an invite over an editor round when both are available', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      invites: [{ lens: 'security', citedFinding: 'unescaped input', from: 'correctness' }],
    });
    expect(convergeStep(stateWith(), o).action).toBe(CONVERGE_ACTIONS.INVITE);
  });
});

describe('applyJurorInvite — the echo is advisory, the grow-only shape is enforced here', () => {
  const invite = { lens: 'security', citedFinding: 'unescaped input' };

  it('a SHRUNK roster echo cannot drop a seated lens', () => {
    const s = stateWith();
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 1, addedLenses: [] }, invite);
    expect(r.applied).toBe(true);
    for (const lens of LENSES) expect(r.state.activeLenses).toContain(lens);
  });

  // The seatability filter used to be applied to the WHOLE union, so an already-active lens that was not in
  // `seatableLenses` was dropped — repealing grow-only, which is the exact bug class (#2640) this module cites
  // as its reason to exist. Unreachable from the shipped CLI; reachable for the `pr-branch` shape #xyihiji has.
  it('the seatability filter can never SHRINK the roster below what was already active', () => {
    const s = stateWith({ activeLenses: [...LENSES, 'a11y'], seatableLenses: LENSES });
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 1 }, invite);
    expect(r.state.activeLenses).toContain('a11y');
    for (const lens of LENSES) expect(r.state.activeLenses).toContain(lens);
  });

  it('still refuses to seat an echoed lens this caller cannot ground', () => {
    const s = stateWith();
    const r = applyJurorInvite(s, { accepted: true, addedLenses: ['telepathy'] }, invite);
    expect(r.state.activeLenses).not.toContain('telepathy');
  });

  it('a SHRUNK juror-count echo cannot shrink the panel', () => {
    const s = stateWith({ jurorsPerLens: 2, jurorCeiling: 3 });
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 1 }, invite);
    expect(r.state.jurorsPerLens).toBeGreaterThanOrEqual(2);
  });

  it('caps growth at the ceiling', () => {
    const s = stateWith({ jurorsPerLens: 1, jurorCeiling: 2 });
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 99 }, invite);
    expect(r.state.jurorsPerLens).toBe(2);
  });

  it('an invite SPENDS a round and never resets the counter', () => {
    const s = { ...stateWith({ roundCap: 4 }), round: 2 };
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 1 }, invite);
    expect(r.state.round).toBe(3);
  });

  it('a chain of invites cannot dodge the round cap', () => {
    const s = { ...stateWith({ roundCap: 2 }), round: 2 };
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 1 }, invite);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.ROUND_CAP);
  });

  it('records the round the invite SPENT, so the budget is not under-reported', () => {
    const s = stateWith({ roundCap: 4 });
    const r = applyJurorInvite(s, { accepted: true, jurorsPerLens: 2, toCareLevel: 'high' }, invite);
    expect(r.state.history).toHaveLength(1);
    expect(r.state.history[0]).toMatchObject({ round: 1, invited: 'security', toCareLevel: 'high' });
  });

  it('falls through to an editor round when the invite was not accepted', () => {
    const r = applyJurorInvite(stateWith(), { accepted: false, reason: 'at-ceiling' }, invite);
    expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
    expect(r.applied).toBe(false);
  });

  it('falls through to an editor round when the invite agent could not run at all', () => {
    const r = applyJurorInvite(stateWith(), null, invite);
    expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
    expect(r.applied).toBe(false);
  });
});

describe('buildEscalationPacket', () => {
  it('carries the round history, the surviving findings, and the dismissals', () => {
    const o = obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
    });
    const r = convergeStep({ ...stateWith({ roundCap: 1 }), round: 1 }, o);
    const packet = buildEscalationPacket(r.state, r);
    expect(packet.reason).toBe(ESCALATION_REASONS.ROUND_CAP);
    expect(packet.history).toHaveLength(1);
    expect(packet.findings).toHaveLength(1);
  });
});

describe('the state is immutable across steps', () => {
  it('never mutates the state it was given', () => {
    const s = stateWith();
    const before = JSON.stringify(s);
    convergeStep(s, obs({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary: 'x' }] },
    }));
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('the DECLARED jury-core contract matches what the module actually imports', () => {
  // The declared block is the PR's stated tripwire against drift from the concurrent panel-weighting workstream.
  // It shipped already-drifted (`normalizeFindings` imported, called, undeclared), so a maintainer greping
  // declared contracts before changing that export would not have seen this consumer. `check:standards` enforces
  // this repo-wide; the unit test keeps the failure local and fast.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'converge-core.mjs'), 'utf8');

  it('declares every jury-core specifier it imports', () => {
    const imported = /import\s*\{([^}]*)\}\s*from\s*'\.\/jury-core\.mjs'/s.exec(src)[1]
      .split(',').map((s) => s.trim()).filter(Boolean);
    const declared = /from we:scripts\/lib\/jury-core\.mjs([\s\S]*?)from we:scripts\/lib\/review-core\.mjs/.exec(src)[1];
    for (const name of imported) expect(declared).toContain(`\`${name}\``);
  });

  it('declares every review-core specifier it imports', () => {
    const imported = /import\s*\{([^}]*)\}\s*from\s*'\.\/review-core\.mjs'/s.exec(src)[1]
      .split(',').map((s) => s.trim()).filter(Boolean);
    const declared = /from we:scripts\/lib\/review-core\.mjs(.*)/.exec(src)[1];
    for (const name of imported) expect(declared).toContain(`\`${name}\``);
  });
});
