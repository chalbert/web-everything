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
import { VERDICTS, NEGOTIATION_OUTCOMES, MANDATORY_LENSES } from '../jury-core.mjs';

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

describe('deriveRoundObservations — the sensing half reads missing signal as FAILURE', () => {
  it('treats an empty diff as a failed read', () => {
    expect(deriveRoundObservations({ readResult: { material: '' } }).read.ok).toBe(false);
  });

  it('treats an errored read as failed even when material is present', () => {
    expect(deriveRoundObservations({ readResult: { material: 'x', error: 'boom' } }).read.ok).toBe(false);
  });

  it('treats an absent read result as failed', () => {
    expect(deriveRoundObservations({}).read.ok).toBe(false);
  });

  it('reports a mandatory lens that CRASHED as absent', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [] }, { lens: 'security', ok: false, findings: [] }],
    });
    expect(obs.panel.absentMandatory).toContain('security');
  });

  it('reports a mandatory lens that was NEVER SCHEDULED as absent — the #2640 shrunk-roster hole', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'simplicity', ok: true, findings: [] }],
    });
    expect(obs.panel.absentMandatory).toEqual(expect.arrayContaining([...MANDATORY_LENSES]));
  });

  it('distinguishes "no panel ran yet" from "a panel ran and every lens failed"', () => {
    expect(deriveRoundObservations({ readResult: READ_OK }).panel.observed).toBe(false);
    expect(deriveRoundObservations({ readResult: READ_OK, lensResults: [] }).panel.observed).toBe(true);
  });

  it('reads an editor that reported nothing as NOT advanced', () => {
    expect(deriveRoundObservations({ readResult: READ_OK, editResult: {} }).edit.advanced).toBe(false);
    expect(deriveRoundObservations({ readResult: READ_OK, editResult: { advanced: 'yes' } }).edit.advanced).toBe(false);
    expect(deriveRoundObservations({ readResult: READ_OK, editResult: { advanced: true } }).edit.advanced).toBe(true);
  });
});

describe('reducePanelRound — a round with missing signal can only reduce to needs-human', () => {
  it('forces humanRequired when a mandatory lens is absent, even with zero findings', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [] }, { lens: 'simplicity', ok: true, findings: [] }],
    });
    const r = reducePanelRound(stateWith(), obs);
    expect(r.humanRequired).toBe(true);
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('forces humanRequired when the read failed', () => {
    const obs = deriveRoundObservations({ readResult: { material: '' }, lensResults: cleanPanel() });
    expect(reducePanelRound(stateWith(), obs).humanRequired).toBe(true);
  });

  it('tags every finding with the lens that raised it', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [...cleanPanel(['correctness']), { lens: 'security', ok: true, findings: [blocker()] }],
    });
    const r = reducePanelRound(stateWith(), obs);
    expect(r.findings.every((f) => typeof f.lens === 'string' && f.lens)).toBe(true);
    expect(r.findings.find((f) => f.lens === 'security')).toBeTruthy();
  });
});

describe('convergeStep — the fail-closed decisions', () => {
  it('escalates immediately on a failed read, without judging nothing', () => {
    const r = convergeStep(stateWith(), deriveRoundObservations({ readResult: { material: '' } }));
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.READ_FAILED);
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('asks for a panel once material is in hand', () => {
    expect(convergeStep(stateWith(), deriveRoundObservations({ readResult: READ_OK })).action)
      .toBe(CONVERGE_ACTIONS.PANEL);
  });

  it('lands a clean panel', () => {
    const r = convergeStep(stateWith(), deriveRoundObservations({ readResult: READ_OK, lensResults: cleanPanel() }));
    expect(r.action).toBe(CONVERGE_ACTIONS.LAND);
    expect(r.outcome).toBe(NEGOTIATION_OUTCOMES.LAND);
  });

  it('NEVER lands when a mandatory reviewer died — a dead reviewer does not read as accept', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [
        { lens: 'correctness', ok: true, findings: [] },
        { lens: 'security', ok: false, findings: [] },
        { lens: 'simplicity', ok: true, findings: [] },
        { lens: 'standards-conformance', ok: true, findings: [] },
      ],
    });
    const r = convergeStep(stateWith(), obs);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.MANDATORY_LENS_ABSENT);
  });

  it('escalates a dead mandatory lens at round 1 — no round budget saves it', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: false, findings: [] }, ...cleanPanel(['security'])],
    });
    const r = convergeStep(stateWith({ roundCap: 5 }), obs);
    expect(r.state.round).toBe(1);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
  });

  it('sends findings to an editor while under the cap', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
    });
    const r = convergeStep(stateWith(), obs);
    expect(r.action).toBe(CONVERGE_ACTIONS.EDIT);
    expect(r.findings).toHaveLength(1);
  });

  it('THE CAP BACKSTOP — escalates at the cap instead of continuing', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
    });
    const atCap = stateWith({ roundCap: 2 });
    const r = convergeStep({ ...atCap, round: 2 }, obs);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.ROUND_CAP);
  });

  it('escalates when the editor could not advance the material', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: false, dismissed: [] },
    });
    const r = convergeStep(stateWith(), obs);
    expect(r.action).toBe(CONVERGE_ACTIONS.ESCALATE);
    expect(r.reason).toBe(ESCALATION_REASONS.EDITOR_STALLED);
  });

  it('advances the round and re-reads after a successful edit', () => {
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary: 'not real', reason: 'by design' }] },
    });
    const r = convergeStep(stateWith(), obs);
    expect(r.action).toBe(CONVERGE_ACTIONS.READ);
    expect(r.state.round).toBe(2);
    expect(r.state.dismissed).toHaveLength(1);
  });

  it('keeps dismissed findings across rounds — never silently dropped', () => {
    const mk = (summary) => deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary, reason: 'stated' }] },
    });
    const r1 = convergeStep(stateWith({ roundCap: 5 }), mk('one'));
    const r2 = convergeStep(r1.state, mk('two'));
    expect(r2.state.dismissed.map((d) => d.summary)).toEqual(['one', 'two']);
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
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      invites: [{ lens: 'security', citedFinding: 'unescaped input', from: 'correctness' }],
    });
    const r = convergeStep(stateWith(), obs);
    expect(r.action).toBe(CONVERGE_ACTIONS.INVITE);
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
    const obs = deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
    });
    const r = convergeStep({ ...stateWith({ roundCap: 1 }), round: 1 }, obs);
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
    convergeStep(s, deriveRoundObservations({
      readResult: READ_OK,
      lensResults: [{ lens: 'correctness', ok: true, findings: [blocker()] }, ...cleanPanel(['security'])],
      editResult: { advanced: true, dismissed: [{ summary: 'x' }] },
    }));
    expect(JSON.stringify(s)).toBe(before);
  });
});
