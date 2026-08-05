/**
 * @file jury-core.test.mjs — proof of the #2654 (S2 of epic #2649) append-only JURY-LEDGER EVENT VOCABULARY:
 *   the `JURY_EVENT_TYPES` / `JUROR_STATUSES` enums and the pure `validateJuryEvent` / `normalizeJuryEvent`
 *   schema validator. This is the SHAPE #2641's durable on-disk log appends and the #2642 console serializes;
 *   the on-disk log + fold are #2641, not covered here. New subject-agnostic consumers import from jury-core
 *   directly (these symbols are NOT re-exported through the PR-diff-specific review-core), so this file imports
 *   from '../jury-core.mjs' directly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// #xdompzx round-4, finding 3 — assertions against markdown PROSE go through these, never a raw `toContain` that
// pins a wrap point or a blockquote indent. See the module header for the autopsy.
import { proseContains, blockquoteBlockAt, functionNamesInCodeSpans, normalizeProse } from './doc-prose.mjs';
import {
  JURY_EVENT_TYPES,
  JURY_EVENT_TYPE_LIST,
  JUROR_STATUSES,
  validateJuryEvent,
  normalizeJuryEvent,
  resolveRoster,
  ROSTER_OVERRIDE_OPS,
  applyRosterOverrides,
  materializeRoster,
  rosterPickedEvent,
  AGGREGATION,
  PANEL_LENSES,
  SUBJECT_ADAPTER_CONTRACT,
  validateSubjectAdapter,
  buildSubjectMandate,
  resolveAdapterRoster,
  deriveNegotiationOutcome,
  NEGOTIATION_OUTCOMES,
  NEGOTIATION_ROUND_CAP,
  VERDICTS,
  redTeamRequired,
  foldRedTeamVerdict,
  IMPACT_LEVELS,
  IMPACT_STRICTNESS,
  IMPACT_GLOSS,
  VERDICT_STRICTNESS,
  verdictStrictness,
  impactStrictness,
  PREVENTION_IMPACT_BAR,
  blocksAcceptance,
  hasUncapturedPrevention,
  normalizeFinding,
  deriveVerdict,
  derivePanelVerdict,
  buildPanelFindings,
  frozenLookup,
} from '../jury-core.mjs';

describe('jury-ledger event vocabulary (#2654)', () => {
  it('names exactly the five F4 logbook event types', () => {
    expect(JURY_EVENT_TYPE_LIST).toEqual([
      'roster-picked',
      'juror-running',
      'finding',
      'verdict',
      'round-advanced',
    ]);
    // frozen enum — no silent re-derivation of the vocabulary
    expect(Object.isFrozen(JURY_EVENT_TYPES)).toBe(true);
    expect(Object.isFrozen(JURY_EVENT_TYPE_LIST)).toBe(true);
  });

  it('exposes the derived juror lifecycle statuses', () => {
    expect(JUROR_STATUSES).toEqual({ PENDING: 'pending', RUNNING: 'running', FOUND: 'found' });
    expect(Object.isFrozen(JUROR_STATUSES)).toBe(true);
  });
});

describe('validateJuryEvent — envelope', () => {
  it('rejects non-object input without throwing', () => {
    for (const bad of [null, undefined, 42, 'x', [], [{ type: 'finding' }]]) {
      const res = validateJuryEvent(bad);
      expect(res.valid).toBe(false);
      expect(res.event).toBeNull();
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown event type', () => {
    const res = validateJuryEvent({ type: 'panel-picked', round: 0 });
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/unknown event type/);
  });

  it('never throws on an exotic `type` (bigint / symbol / boolean)', () => {
    for (const t of [10n, Symbol('x'), true, {}, () => {}]) {
      let res;
      expect(() => {
        res = validateJuryEvent({ type: t, round: 0 });
      }).not.toThrow();
      expect(res.valid).toBe(false);
    }
  });

  it('accepts an optional `at` (on any event) and rejects a malformed one', () => {
    const ok = validateJuryEvent({ type: 'round-advanced', round: 2, at: '2026-07-24T10:00:00.000Z' });
    expect(ok.valid).toBe(true);
    expect(ok.event.at).toBe('2026-07-24T10:00:00.000Z');

    const okFinding = validateJuryEvent({
      type: 'finding',
      round: 1,
      jurorId: 'j1',
      finding: { summary: 's' },
      at: '2026-07-24T10:00:00.000Z',
    });
    expect(okFinding.valid).toBe(true);
    expect(okFinding.event.at).toBe('2026-07-24T10:00:00.000Z');

    const bad = validateJuryEvent({ type: 'round-advanced', round: 2, at: 'not-a-date' });
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain('at must be a parseable date string when present');
  });

  it('normalizes to KNOWN fields only — caller-junk is dropped', () => {
    const res = validateJuryEvent({ type: 'round-advanced', round: 3, secret: 'drop me', junk: 1 });
    expect(res.valid).toBe(true);
    expect(res.event).toEqual({ type: 'round-advanced', round: 3 });
  });
});

describe('validateJuryEvent — roster-picked', () => {
  const juror = { id: 'j1', lens: 'correctness', charter: 'find crashes', method: 'opus' };

  it('accepts a well-formed roster and trims/keeps only known juror fields', () => {
    const res = validateJuryEvent({
      type: 'roster-picked',
      round: 0,
      jurors: [{ ...juror, id: '  j1  ', extra: 'x' }, { id: 'j2', lens: 'security', charter: 'find leaks' }],
    });
    expect(res.valid).toBe(true);
    expect(res.event.round).toBe(0);
    expect(res.event.jurors).toEqual([
      { id: 'j1', lens: 'correctness', charter: 'find crashes', method: 'opus' },
      { id: 'j2', lens: 'security', charter: 'find leaks' },
    ]);
  });

  it('requires a non-empty jurors array', () => {
    expect(validateJuryEvent({ type: 'roster-picked', round: 0, jurors: [] }).valid).toBe(false);
    expect(validateJuryEvent({ type: 'roster-picked', round: 0 }).valid).toBe(false);
  });

  it('rejects a juror missing id / lens / charter', () => {
    const res = validateJuryEvent({ type: 'roster-picked', round: 0, jurors: [{ lens: 'x' }] });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /id/.test(e))).toBe(true);
    expect(res.errors.some((e) => /charter/.test(e))).toBe(true);
  });

  it('rejects a duplicate juror id in the roster', () => {
    const res = validateJuryEvent({
      type: 'roster-picked',
      round: 0,
      jurors: [juror, { id: 'j1', lens: 'security', charter: 'other' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /duplicated/.test(e))).toBe(true);
  });
});

describe('validateJuryEvent — juror-running / finding / verdict', () => {
  it('juror-running requires a jurorId and round', () => {
    expect(validateJuryEvent({ type: 'juror-running', round: 1, jurorId: 'j1' }).valid).toBe(true);
    expect(validateJuryEvent({ type: 'juror-running', round: 1 }).valid).toBe(false);
    expect(validateJuryEvent({ type: 'juror-running', jurorId: 'j1' }).valid).toBe(false);
  });

  it('finding carries a normalized Finding (summary required)', () => {
    const res = validateJuryEvent({
      type: 'finding',
      round: 1,
      jurorId: 'j1',
      finding: { summary: '  off-by-one  ', category: 'correctness', extra: 'x' },
    });
    expect(res.valid).toBe(true);
    expect(res.event.finding).toEqual({ summary: 'off-by-one', category: 'correctness' });

    const bad = validateJuryEvent({ type: 'finding', round: 1, jurorId: 'j1', finding: { note: 'no summary' } });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => /summary/.test(e))).toBe(true);
  });

  it('verdict must be one of accept / changes / needs-human', () => {
    for (const v of ['accept', 'changes', 'needs-human']) {
      expect(validateJuryEvent({ type: 'verdict', round: 1, jurorId: 'j1', verdict: v }).valid).toBe(true);
    }
    const bad = validateJuryEvent({ type: 'verdict', round: 1, jurorId: 'j1', verdict: 'maybe' });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => /verdict/.test(e))).toBe(true);
  });
});

describe('validateJuryEvent — round rules', () => {
  it('round-advanced requires round >= 1 (round 0 is the initial roster)', () => {
    expect(validateJuryEvent({ type: 'round-advanced', round: 1 }).valid).toBe(true);
    expect(validateJuryEvent({ type: 'round-advanced', round: 0 }).valid).toBe(false);
  });

  it('other events allow round 0 but reject non-integer / negative rounds', () => {
    expect(validateJuryEvent({ type: 'juror-running', round: 0, jurorId: 'j1' }).valid).toBe(true);
    expect(validateJuryEvent({ type: 'juror-running', round: -1, jurorId: 'j1' }).valid).toBe(false);
    expect(validateJuryEvent({ type: 'juror-running', round: 1.5, jurorId: 'j1' }).valid).toBe(false);
  });
});

describe('normalizeJuryEvent', () => {
  it('returns the clean event on success and null on failure (filter(Boolean)-friendly)', () => {
    const log = [
      { type: 'roster-picked', round: 0, jurors: [{ id: 'j1', lens: 'correctness', charter: 'c' }] },
      { type: 'bogus' },
      { type: 'round-advanced', round: 1 },
    ];
    const kept = log.map(normalizeJuryEvent).filter(Boolean);
    expect(kept.map((e) => e.type)).toEqual(['roster-picked', 'round-advanced']);
  });
});

describe('deriveNegotiationOutcome — the subject-jury self-driving loop\'s continue/escalate decision (#2685)', () => {
  // The #2685 self-driving convergence loop (`we:skills-src/jury/subject-jury.workflow.js`) must NOT hand-roll the
  // continue-vs-escalate call — that mechanical decision is single-sourced HERE and reached each round through the
  // reduce CLI's `.outcome` (`review-core-cli reduce --round --roundCap`, which returns `deriveNegotiationOutcome`
  // verbatim). These pin the exact routing the loop relies on, so a drift in the function is caught, not the harness.
  it('an `accept` verdict LANDS the loop (the panel converged) at any round', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 1, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.LAND);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 3, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.LAND);
  });

  it('a `changes` verdict UNDER the round cap CONTINUES (an editor fold + another panel)', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: 1, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: 2, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
  });

  it('a `changes` verdict AT the round cap ESCALATES (stuck — did not converge in N rounds)', () => {
    // The harness floors its per-run cap at the care band's `plan.rounds`; low care = cap 1 → one panel, then escalate.
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: 1, roundCap: 1 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: 3, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  it('a `needs-human` verdict ESCALATES on ANY round — no round budget clears a mandatory-lens/conflict escalation', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.NEEDS_HUMAN, round: 1, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.NEEDS_HUMAN, round: 3, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  it('defaults its cap to NEGOTIATION_ROUND_CAP when the caller passes none (the engine hard budget)', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: NEGOTIATION_ROUND_CAP - 1 })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: NEGOTIATION_ROUND_CAP })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  it('#2823 — prevention-outstanding ESCALATES immediately on EVERY round (never a non-progressing loop)', () => {
    // No editor round can close it and no loop actor files the guard, so `continue` would just burn the whole
    // budget re-deriving the same verdict. It hands straight to the operator instead — at round 1 AND at the cap.
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.PREVENTION_OUTSTANDING, round: 1, roundCap: 5 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.PREVENTION_OUTSTANDING, round: 5, roundCap: 5 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    // never LANDs even with a green test (it is not an accept).
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.PREVENTION_OUTSTANDING, round: 1, roundCap: 5, requiredTestGreen: true })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  // #2410 slice D (capstone) — the CI-green land clause is folded into the land condition. `requiredTestGreen`
  // defaults to true so every pre-#2410 caller stays byte-stable; it only BLOCKS a land when explicitly not-green.
  describe('CI-green land clause (#2410 slice D — required-`test`-green folded into the land condition)', () => {
    it('omitting requiredTestGreen is byte-stable — an accept still LANDS (default green)', () => {
      expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 1, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.LAND);
    });

    it('accept + required test GREEN → LAND (the full bar holds)', () => {
      expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 1, roundCap: 3, requiredTestGreen: true })).toBe(NEGOTIATION_OUTCOMES.LAND);
    });

    it('accept but required test NOT green re-enters the loop like a `changes` — CONTINUE under the cap', () => {
      expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 1, roundCap: 3, requiredTestGreen: false })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
    });

    it('accept but required test NOT green ESCALATES at the cap (reviewed-but-red never silently lands)', () => {
      expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 3, roundCap: 3, requiredTestGreen: false })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    });

    it('fails CLOSED on an unknown (null) CI state — an accept over an undetermined test does NOT land', () => {
      expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 1, roundCap: 3, requiredTestGreen: null })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
    });

    it('a red required test never overrides a `needs-human` escalate (needs-human still wins)', () => {
      expect(deriveNegotiationOutcome({ verdict: VERDICTS.NEEDS_HUMAN, round: 1, roundCap: 3, requiredTestGreen: false })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    });
  });
});

describe('resolveRoster — the stateless roster-recompute spine (#2655, F3)', () => {
  const methodsFor = (lens) => [`m:${lens}`]; // a stand-in method resolver — the spine is subject-agnostic

  it('care `none` → an EMPTY roster, regardless of the touch-set signal', () => {
    const plan = resolveRoster({ careLevel: 'none', touchLenses: ['a11y', 'perf'], resolveMethods: methodsFor });
    expect(plan.lenses).toEqual([]);
    expect(plan.jurorsPerLens).toBe(0);
    expect(plan.rounds).toBe(0);
    expect(plan.aggregation).toBe(AGGREGATION.DIVERSITY_SELECTION);
  });

  it('merges the care-band static lenses with the subject touch-set lenses, static first, de-duped', () => {
    const plan = resolveRoster({ careLevel: 'low', touchLenses: ['a11y', 'visual-vs-target'], resolveMethods: methodsFor });
    expect(plan.lenses.map((l) => l.lens)).toEqual([...PANEL_LENSES, 'a11y', 'visual-vs-target']);
    for (const l of plan.lenses) {
      expect(l.attachedBy).toBe(PANEL_LENSES.includes(l.lens) ? 'care' : 'touch-set');
      expect(l.methods).toEqual([`m:${l.lens}`]);
    }
  });

  it('the care band WINS an overlap — a touch-set lens equal to a static lens is not duplicated', () => {
    const plan = resolveRoster({ careLevel: 'low', touchLenses: ['correctness', 'a11y'], resolveMethods: methodsFor });
    const lenses = plan.lenses.map((l) => l.lens);
    expect(new Set(lenses).size).toBe(lenses.length);
    expect(plan.lenses.find((l) => l.lens === 'correctness').attachedBy).toBe('care');
  });

  it('carries the rigor dial through from panelRigorForCareLevel unchanged', () => {
    const plan = resolveRoster({ careLevel: 'high', touchLenses: [], resolveMethods: methodsFor });
    expect(plan.jurorsPerLens).toBe(2);
    expect(plan.rounds).toBe(3);
  });

  it('without a method resolver, seats carry no methods (subject-agnostic default)', () => {
    const plan = resolveRoster({ careLevel: 'low' });
    expect(plan.lenses.every((l) => l.methods.length === 0)).toBe(true);
  });

  it('ignores empty / falsy touch-set entries', () => {
    const plan = resolveRoster({ careLevel: 'low', touchLenses: ['', null, 'a11y', undefined] });
    expect(plan.lenses.filter((l) => l.attachedBy === 'touch-set').map((l) => l.lens)).toEqual(['a11y']);
  });

  it('delegates the unknown-care-level throw to panelRigorForCareLevel', () => {
    expect(() => resolveRoster({ careLevel: 'critical' })).toThrow(/unknown care-level/);
  });
});

describe('applyRosterOverrides — the minimal, ledger-trailed override layer (#2655, F3)', () => {
  const base = () => resolveRoster({ careLevel: 'low', touchLenses: [], resolveMethods: (l) => [`m:${l}`] });

  it('exposes exactly the two override ops as a frozen enum', () => {
    expect(ROSTER_OVERRIDE_OPS).toEqual({ ADD: 'add', REMOVE: 'remove' });
    expect(Object.isFrozen(ROSTER_OVERRIDE_OPS)).toBe(true);
  });

  it('add appends a lens tagged `override`, grounded via the injected resolver', () => {
    const plan = applyRosterOverrides(base(), [{ op: 'add', lens: 'perf' }], { resolveMethods: (l) => [`m:${l}`] });
    const perf = plan.lenses.find((l) => l.lens === 'perf');
    expect(perf).toEqual({ lens: 'perf', methods: ['m:perf'], attachedBy: 'override' });
  });

  it('remove drops a lens; both ops are idempotent no-ops on an absent/present lens', () => {
    const removed = applyRosterOverrides(base(), [{ op: 'remove', lens: 'simplicity' }]);
    expect(removed.lenses.some((l) => l.lens === 'simplicity')).toBe(false);
    // remove-absent and add-existing are no-ops
    const noop = applyRosterOverrides(base(), [{ op: 'remove', lens: 'nope' }, { op: 'add', lens: 'correctness' }]);
    expect(noop.lenses.map((l) => l.lens)).toEqual(base().lenses.map((l) => l.lens));
  });

  it('is PURE — never mutates the input plan', () => {
    const plan = base();
    const before = plan.lenses.map((l) => l.lens);
    applyRosterOverrides(plan, [{ op: 'remove', lens: 'correctness' }, { op: 'add', lens: 'perf' }]);
    expect(plan.lenses.map((l) => l.lens)).toEqual(before);
  });

  it('throws on a malformed override (bad shape, empty lens, unknown op)', () => {
    expect(() => applyRosterOverrides(base(), [null])).toThrow(/must be an object/);
    expect(() => applyRosterOverrides(base(), [{ op: 'add', lens: '  ' }])).toThrow(/non-empty string/);
    expect(() => applyRosterOverrides(base(), [{ op: 'swap', lens: 'perf' }])).toThrow(/unknown override op/);
  });
});

describe('materializeRoster + rosterPickedEvent — the S2 ledger bridge (#2655)', () => {
  const plan = () => resolveRoster({ careLevel: 'high', touchLenses: ['perf'], resolveMethods: (l) => [`m:${l}`] });

  it('expands each seat into jurorsPerLens jurors with unique ids and the seat method', () => {
    const jurors = materializeRoster(plan());
    // high → 2 jurors per lens; 4 static + 1 touch-set = 5 lenses → 10 jurors
    expect(jurors.length).toBe(10);
    expect(new Set(jurors.map((j) => j.id)).size).toBe(jurors.length);
    const c1 = jurors.find((j) => j.id === 'correctness#1');
    expect(c1.lens).toBe('correctness');
    expect(c1.method).toBe('m:correctness');
    expect(c1.charter).toMatch(/correctness/);
  });

  it('uses the injected charterForLens when supplied', () => {
    const jurors = materializeRoster(plan(), { charterForLens: (l) => `find ${l} bugs` });
    expect(jurors.find((j) => j.id === 'perf#1').charter).toBe('find perf bugs');
  });

  it('care `none` (jurorsPerLens 0) materializes to an empty roster and NO roster-picked event', () => {
    const none = resolveRoster({ careLevel: 'none' });
    expect(materializeRoster(none)).toEqual([]);
    expect(rosterPickedEvent(none)).toBeNull();
  });

  it('rosterPickedEvent emits a SCHEMA-VALID S2 roster-picked event carrying the effective roster', () => {
    const overridden = applyRosterOverrides(plan(), [{ op: 'remove', lens: 'simplicity' }], { resolveMethods: (l) => [`m:${l}`] });
    const ev = rosterPickedEvent(overridden, { round: 0, at: '2026-07-24T10:00:00.000Z' });
    expect(ev.type).toBe('roster-picked');
    expect(ev.round).toBe(0);
    expect(ev.at).toBe('2026-07-24T10:00:00.000Z');
    // the removed lens is absent from the trailed roster (the override is reflected in the event)
    expect(ev.jurors.some((j) => j.lens === 'simplicity')).toBe(false);
    // round-trips through the validator it was built with
    expect(validateJuryEvent(ev).valid).toBe(true);
  });
});

describe('SUBJECT_ADAPTER_CONTRACT / validateSubjectAdapter — the subject-adapter interface (#2656, F2)', () => {
  // a minimal, subject-neutral stub adapter — the smallest thing that satisfies the contract
  const stub = {
    subject: 'stub',
    extractTouchSet: (input) => (Array.isArray(input) ? input : []),
    resolveMethods: (lens) => [`m:${lens}`],
  };

  it('names the required + optional interface keys as a frozen descriptor', () => {
    expect(SUBJECT_ADAPTER_CONTRACT.required).toEqual(['subject', 'extractTouchSet', 'resolveMethods']);
    expect(SUBJECT_ADAPTER_CONTRACT.optional).toEqual(['subjectNoun', 'mandatoryLenses', 'charterForLens', 'buildMandate']);
    expect(Object.isFrozen(SUBJECT_ADAPTER_CONTRACT)).toBe(true);
    expect(Object.isFrozen(SUBJECT_ADAPTER_CONTRACT.required)).toBe(true);
  });

  it('accepts a minimal well-formed adapter', () => {
    expect(validateSubjectAdapter(stub)).toEqual({ valid: true, errors: [] });
  });

  it('rejects a non-object without throwing', () => {
    for (const bad of [null, undefined, 42, 'x', []]) {
      const res = validateSubjectAdapter(bad);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });

  it('flags each missing / mistyped REQUIRED member', () => {
    const res = validateSubjectAdapter({ subject: '', extractTouchSet: 'nope' });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /subject/.test(e))).toBe(true);
    expect(res.errors.some((e) => /extractTouchSet/.test(e))).toBe(true);
    expect(res.errors.some((e) => /resolveMethods/.test(e))).toBe(true);
  });

  it('validates OPTIONAL members only when present', () => {
    expect(validateSubjectAdapter({ ...stub, mandatoryLenses: [] }).valid).toBe(false);
    expect(validateSubjectAdapter({ ...stub, charterForLens: 'x' }).valid).toBe(false);
    expect(validateSubjectAdapter({ ...stub, subjectNoun: '  ' }).valid).toBe(false);
    expect(validateSubjectAdapter({ ...stub, mandatoryLenses: ['correctness'], subjectNoun: 'thing' }).valid).toBe(true);
  });
});

describe('the mandatory post-jury red-team gate (#2707)', () => {
  it('owes a red-team EXACTLY on a positive (accept) verdict', () => {
    expect(redTeamRequired(VERDICTS.ACCEPT)).toBe(true);
    // a verdict already bouncing / escalating has nothing to ratify → no red-team owed
    expect(redTeamRequired(VERDICTS.CHANGES)).toBe(false);
    expect(redTeamRequired(VERDICTS.NEEDS_HUMAN)).toBe(false);
    expect(redTeamRequired('unknown')).toBe(false);
    expect(redTeamRequired(undefined)).toBe(false);
  });

  it('ratifies ONLY a red-team that ran and found nothing', () => {
    expect(foldRedTeamVerdict({ ran: true, findings: [] })).toBe(VERDICTS.ACCEPT);
  });

  it('bounces to changes when a red-team that ran broke the accept', () => {
    expect(foldRedTeamVerdict({ ran: true, findings: [{ summary: 'an unhandled empty-input case' }] }))
      .toBe(VERDICTS.CHANGES);
  });

  it('FAILS CLOSED — an unrun red-team NEVER ratifies (the fabricated-ratings guard)', () => {
    // no signal is a FAILING signal: ran:false → needs-human regardless of (absent) findings, and even
    // if a caller passed clean findings the humanRequired path wins (mirrors deriveVerdict).
    expect(foldRedTeamVerdict({ ran: false, findings: [] })).toBe(VERDICTS.NEEDS_HUMAN);
    expect(foldRedTeamVerdict({ ran: false, findings: [{ summary: 'x' }] })).toBe(VERDICTS.NEEDS_HUMAN);
    // defaults: no args ⇒ ran defaults false ⇒ needs-human (never a silent accept on an empty call)
    expect(foldRedTeamVerdict()).toBe(VERDICTS.NEEDS_HUMAN);
    expect(foldRedTeamVerdict({})).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('resolves red-team findings marked fixed/no_change_needed, leaving only genuinely outstanding ones', () => {
    expect(foldRedTeamVerdict({ ran: true, findings: [{ summary: 'addressed', outcome: 'fixed' }] }))
      .toBe(VERDICTS.ACCEPT);
    expect(foldRedTeamVerdict({ ran: true, findings: [
      { summary: 'addressed', outcome: 'fixed' },
      { summary: 'still broken' },
    ] })).toBe(VERDICTS.CHANGES);
  });

  it('a red-team break feeds the SAME negotiation loop — changes continues under the cap, escalates at it', () => {
    const broke = foldRedTeamVerdict({ ran: true, findings: [{ summary: 'real defect' }] });
    expect(deriveNegotiationOutcome({ verdict: broke, round: 1, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
    expect(deriveNegotiationOutcome({ verdict: broke, round: 3, roundCap: 3 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    // an unrun red-team (needs-human) always escalates, no round budget clears it
    const unrun = foldRedTeamVerdict({ ran: false });
    expect(deriveNegotiationOutcome({ verdict: unrun, round: 1, roundCap: 5 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });
});

describe('buildSubjectMandate — the subject-neutral mandate skeleton (#2656, F2)', () => {
  it('assembles the mandate line + neutral judge-only closing for any subject', () => {
    const text = buildSubjectMandate({ subjectNoun: 'design', mandate: 'accessibility', findingAnchor: 'region' });
    expect(text).toContain('You are reviewing a design against this mandate: accessibility.');
    expect(text).toContain('report concrete findings (region,');
    expect(text).toMatch(/Report an empty findings list/);
  });

  it('joins a multi-mandate array and falls back to defaultMandate on an empty one', () => {
    expect(buildSubjectMandate({ mandate: ['a', 'b'] })).toContain('this mandate: a, b.');
    expect(buildSubjectMandate({ mandate: [], defaultMandate: 'correctness' })).toContain('this mandate: correctness.');
  });

  it('splices adapter body lines between the opening and the closing, and omits an empty isolation line', () => {
    const text = buildSubjectMandate({ subjectNoun: 'x', mandate: 'm', bodyLines: ['MIDDLE ONE', 'MIDDLE TWO'] });
    expect(text).toContain('MIDDLE ONE MIDDLE TWO');
    // no isolation line supplied → no stray double-space before the body
    expect(text).not.toMatch(/ {2}/);
  });
});

describe('resolveAdapterRoster — the adapter-driven roster seam (#2656, F2)', () => {
  const adapter = {
    subject: 'stub',
    extractTouchSet: (input) => (Array.isArray(input) ? input : []),
    resolveMethods: (lens, ctx) => [`${ctx?.tag ?? 'm'}:${lens}`],
  };

  it('feeds the adapter touch-set + ctx-bound methods into the stateless spine', () => {
    const plan = resolveAdapterRoster({ adapter, careLevel: 'low', input: ['a11y'], ctx: { tag: 'X' } });
    expect(plan.lenses.map((l) => l.lens)).toEqual([...PANEL_LENSES, 'a11y']);
    expect(plan.lenses.find((l) => l.lens === 'a11y')).toEqual({ lens: 'a11y', methods: ['X:a11y'], attachedBy: 'touch-set' });
    expect(plan.lenses.find((l) => l.lens === 'correctness').methods).toEqual(['X:correctness']);
  });

  it('applies minimal overrides on top of the recompute, grounded by the same ctx-bound resolver', () => {
    const plan = resolveAdapterRoster({ adapter, careLevel: 'low', input: [], overrides: [{ op: 'add', lens: 'perf' }], ctx: { tag: 'X' } });
    expect(plan.lenses.find((l) => l.lens === 'perf')).toEqual({ lens: 'perf', methods: ['X:perf'], attachedBy: 'override' });
  });

  it('throws loudly on an adapter that fails the contract', () => {
    expect(() => resolveAdapterRoster({ adapter: { subject: 'bad' }, careLevel: 'low' })).toThrow(/invalid subject adapter/);
  });

  it('delegates the unknown-care-level throw to the spine', () => {
    expect(() => resolveAdapterRoster({ adapter, careLevel: 'critical' })).toThrow(/unknown care-level/);
  });
});

describe('IMPACT IF UNFIXED + the strictness dial (#xdompzx)', () => {
  const guarded = (extra = {}) => normalizeFinding({
    summary: 'a finding', prevention: 'some durable gate', preventionCaptured: false, outcome: 'fixed', ...extra,
  });

  it('ranks the levels least- to most-costly and is total over the enum', () => {
    expect(impactStrictness(IMPACT_LEVELS.COSMETIC)).toBeLessThan(impactStrictness(IMPACT_LEVELS.DEGRADED));
    expect(impactStrictness(IMPACT_LEVELS.DEGRADED)).toBeLessThan(impactStrictness(IMPACT_LEVELS.BROKEN));
    expect(impactStrictness(IMPACT_LEVELS.BROKEN)).toBeLessThan(impactStrictness(IMPACT_LEVELS.UNRECOVERABLE));
    for (const level of Object.values(IMPACT_LEVELS)) expect(IMPACT_STRICTNESS[level]).toBeTypeOf('number');
  });

  it('throws on an unranked level rather than yielding undefined (every >= bar compare would lose it)', () => {
    expect(() => impactStrictness('catastrophic')).toThrow(/no rank for impact level/);
  });

  it('normalizeFinding carries a valid level and DROPS an invented one (so it reads as undeclared)', () => {
    expect(guarded({ impactIfUnfixed: 'broken' }).impactIfUnfixed).toBe('broken');
    expect(guarded({ impactIfUnfixed: 'high' })).not.toHaveProperty('impactIfUnfixed');
    expect(guarded()).not.toHaveProperty('impactIfUnfixed');
  });

  it('blocks at or above the bar, and does not below it', () => {
    expect(blocksAcceptance(guarded({ impactIfUnfixed: 'cosmetic' }))).toBe(false);
    expect(blocksAcceptance(guarded({ impactIfUnfixed: 'degraded' }))).toBe(false);
    expect(blocksAcceptance(guarded({ impactIfUnfixed: 'broken' }))).toBe(true);
    expect(blocksAcceptance(guarded({ impactIfUnfixed: 'unrecoverable' }))).toBe(true);
  });

  it('FAILS CLOSED on an undeclared or invented impact — the pre-#xdompzx behaviour, so this is a strict relaxation', () => {
    expect(blocksAcceptance(guarded())).toBe(true);
    expect(blocksAcceptance(guarded({ impactIfUnfixed: 'high' }))).toBe(true);
  });

  it('a captured guard never blocks, whatever its impact', () => {
    expect(blocksAcceptance(guarded({ preventionCaptured: true, impactIfUnfixed: 'unrecoverable' }))).toBe(false);
  });

  it('keeps below-bar guards VISIBLE to the notice — the relaxation loses no information', () => {
    const nit = guarded({ impactIfUnfixed: 'cosmetic' });
    expect(hasUncapturedPrevention(nit)).toBe(true); // the notice still reports it
    expect(blocksAcceptance(nit)).toBe(false); // the verdict does not stop for it
  });

  it('deriveVerdict accepts a below-bar guard and withholds on an at-bar one', () => {
    expect(deriveVerdict({ findings: [guarded({ impactIfUnfixed: 'cosmetic' })] })).toBe(VERDICTS.ACCEPT);
    expect(deriveVerdict({ findings: [guarded({ impactIfUnfixed: 'broken' })] })).toBe(VERDICTS.PREVENTION_OUTSTANDING);
  });

  it('an OUTSTANDING finding is still `changes` regardless of impact — the fix outranks the guard', () => {
    expect(deriveVerdict({ findings: [guarded({ impactIfUnfixed: 'cosmetic', outcome: undefined })] })).toBe(VERDICTS.CHANGES);
  });

  it('TURNING THE DIAL tightens without touching a consumer', () => {
    const nit = guarded({ impactIfUnfixed: 'cosmetic' });
    expect(deriveVerdict({ findings: [nit] })).toBe(VERDICTS.ACCEPT);
    expect(deriveVerdict({ findings: [nit], bar: IMPACT_LEVELS.COSMETIC })).toBe(VERDICTS.PREVENTION_OUTSTANDING);
  });

  it('derivePanelVerdict applies the same gate as deriveVerdict', () => {
    const lensVerdicts = { correctness: 'accept', security: 'accept' };
    const below = buildPanelFindings({ simplicity: [{ summary: 'nit', prevention: 'g', preventionCaptured: false, impactIfUnfixed: 'cosmetic', outcome: 'fixed' }] });
    const above = buildPanelFindings({ security: [{ summary: 'race', prevention: 'g', preventionCaptured: false, impactIfUnfixed: 'unrecoverable', outcome: 'fixed' }] });
    expect(derivePanelVerdict({ lensVerdicts, findings: below })).toBe(VERDICTS.ACCEPT);
    expect(derivePanelVerdict({ lensVerdicts, findings: above })).toBe(VERDICTS.PREVENTION_OUTSTANDING);
    expect(derivePanelVerdict({ lensVerdicts, findings: below, bar: IMPACT_LEVELS.COSMETIC })).toBe(VERDICTS.PREVENTION_OUTSTANDING);
  });

  it('the shipped bar is `broken` — the solo-context setting, documented as the knob to turn', () => {
    expect(PREVENTION_IMPACT_BAR).toBe(IMPACT_LEVELS.BROKEN);
  });

  it('the mandate demands impact on every finding, and DEFINES each level from IMPACT_GLOSS (not a pasted copy)', () => {
    const text = buildSubjectMandate({ subjectNoun: 'diff', mandate: 'correctness' });
    expect(text).toContain('IMPACT (required, for EVERY finding)');
    // The GLOSS, not merely the bare level name — a `join(', ')` of the enum satisfies a name-only assertion, which
    // is how a fifth level could ship listed-but-undefined with the suite green (#xdompzx review, finding 6).
    for (const level of Object.values(IMPACT_LEVELS)) {
      expect(text).toContain(level);
      expect(text).toContain(IMPACT_GLOSS[level]);
    }
  });

  // ── #xdompzx review, blocker 3A — the prevention DEMAND is unconditional; only the GATE consults the bar. ──
  // Asserted on the SURFACE (the mandate text a reviewer actually reads), not on the predicate: a demand a
  // reviewer can opt out of by declaring a finding cheap starves both the operator notice and the posted PR
  // comment of the guards they exist to surface, on exactly the path the bar newly un-blocks.
  it('the mandate demands the prevention triple on EVERY finding — never conditioned on the impact bar', () => {
    const text = buildSubjectMandate({ subjectNoun: 'diff', mandate: 'correctness' });
    expect(text).toContain('PREVENTION INTROSPECTION (required, for EVERY finding you report — at every severity, nits included)');
    expect(text).toContain('rootCause');
    expect(text).toContain('prevention');
    expect(text).toContain('preventionCaptured');
    // the conditioning this PR shipped and the review bounced — it must not come back in any wording
    expect(text).not.toContain('OPTIONAL below');
    expect(text).not.toContain('do NOT manufacture a gate proposal for a nit');
    expect(text).not.toMatch(/required for every finding at `?\w+`? or above/i);
  });

  it('the mandate still tells reviewers WHERE the bar bites — reporting is unconditional, blocking is not', () => {
    const text = buildSubjectMandate({ subjectNoun: 'diff', mandate: 'correctness' });
    expect(text).toContain(PREVENTION_IMPACT_BAR);
    expect(text).toContain('reporting is unconditional, BLOCKING is not');
    expect(text).toContain('BLOCKS acceptance');
  });
});

// ── #xdompzx review, blocker 2 — the rank tables are read with keys that arrive as FREE-FORM MODEL JSON. ──
// `Object.freeze` seals own properties but does not detach `Object.prototype`, so on a normal object literal a bare
// bracket read of an inherited key returns a function/object instead of `undefined`: a `!== undefined` membership
// test passes, and the value then compares as `NaN` — false in BOTH directions, i.e. the guard fails OPEN. These
// probe the actual prototype members, not a hand-picked non-adversarial invented word.
describe('rank tables are prototype-proof (#xdompzx review, blocker 2)', () => {
  const PROTO_KEYS = ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'propertyIsEnumerable'];
  const guarded = (extra = {}) => normalizeFinding({
    summary: 'a finding', prevention: 'some durable gate', preventionCaptured: false, outcome: 'fixed', ...extra,
  });

  it('both tables are NULL-PROTOTYPE, so an inherited key is genuinely absent', () => {
    expect(Object.getPrototypeOf(IMPACT_STRICTNESS)).toBe(null);
    expect(Object.getPrototypeOf(VERDICT_STRICTNESS)).toBe(null);
    for (const key of PROTO_KEYS) {
      expect(IMPACT_STRICTNESS[key]).toBeUndefined();
      expect(VERDICT_STRICTNESS[key]).toBeUndefined();
    }
  });

  it.each(PROTO_KEYS)('normalizeFinding DROPS impactIfUnfixed: "%s" (it is not an impact level)', (key) => {
    expect(guarded({ impactIfUnfixed: key })).not.toHaveProperty('impactIfUnfixed');
  });

  it.each(PROTO_KEYS)('an uncaptured guard declaring impactIfUnfixed: "%s" STILL BLOCKS — fails closed, not open', (key) => {
    const f = guarded({ impactIfUnfixed: key });
    expect(blocksAcceptance(f)).toBe(true);
    expect(deriveVerdict({ findings: [f] })).toBe(VERDICTS.PREVENTION_OUTSTANDING);
  });

  it.each(PROTO_KEYS)('impactStrictness("%s") THROWS rather than returning an inherited member', (key) => {
    expect(() => impactStrictness(key)).toThrow(/no rank for impact level/);
  });

  it.each(PROTO_KEYS)('verdictStrictness("%s") THROWS rather than returning an inherited member', (key) => {
    expect(() => verdictStrictness(key)).toThrow(/no strictness rank for verdict/);
  });

  it('a prototype-key BAR is rejected too — the dial cannot be turned to a non-level', () => {
    for (const key of PROTO_KEYS) {
      expect(() => blocksAcceptance(guarded({ impactIfUnfixed: 'broken' }), { bar: key })).toThrow(/no rank for impact level/);
    }
  });
});

describe('IMPACT_GLOSS — the level definitions are DATA, single-sourced (#xdompzx review, finding 6)', () => {
  it('is total over IMPACT_LEVELS, null-prototype, and every gloss is non-empty', () => {
    expect(Object.getPrototypeOf(IMPACT_GLOSS)).toBe(null);
    for (const level of Object.values(IMPACT_LEVELS)) {
      expect(Object.hasOwn(IMPACT_GLOSS, level)).toBe(true);
      expect(IMPACT_GLOSS[level].length).toBeGreaterThan(10);
    }
    expect(Object.keys(IMPACT_GLOSS).sort()).toEqual(Object.values(IMPACT_LEVELS).sort());
  });
});

// ── round-2 blocker 1 — THE COMPENSATING CONTROL MUST BE WIRED ON THE PATH THE RELAXATION OPENS. ───────
// `PREVENTION_IMPACT_BAR` un-blocks a below-bar uncaptured guard on the AUTO-LAND path. Round 1 built the renderer
// (`renderFindingLine`) and shipped prose claiming the guard was "always visible … including on a clean accept that
// auto-lands" — but the drain's `land` / `autoLand: true` branch posted nothing at all, so the renderer was never
// reached. A rendering function nobody calls is not a control. These pin BOTH halves: the drain skill instructs the
// emission on that branch, and no surface makes an unconditional visibility claim over a conditional emission.
//
// ROUND 4, finding 3 — HOW these are asserted matters as much as what. The conditional-guarantee test used to
// `toContain('no\n       > land that the bar un-blocked happens silently')`, pinning the line's wrap point and a
// 7-space blockquote indent; a harmless reflow would have failed the suite with a message reading "the safety
// control is missing". Every prose assertion here now goes through `proseContains` (whitespace-normalized,
// blockquote markers stripped), and the negative claim-check is SCOPED to the block that makes the claim instead
// of the whole 400-line skill.
describe('the below-bar prevention control is wired on the auto-land branch (round-2 blocker 1)', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const drainSkill = () => readFileSync(join(ROOT, 'skills-src/drain/SKILL.md'), 'utf8');
  const CHECK = 'BAR-UN-BLOCKED PREVENTION CHECK';

  it('the drain skill instructs the auto-land branch to POST the panel comment before the accept labels', () => {
    const md = drainSkill();
    const block = blockquoteBlockAt(md, CHECK);
    expect(block, `the "${CHECK}" block must exist in the drain skill`).not.toBe('');
    // it is defined in terms of the two predicates, not restated as prose the code cannot be checked against …
    expect(proseContains(block, 'hasUncapturedPrevention(f) === true')).toBe(true);
    expect(proseContains(block, 'blocksAcceptance(f) === false')).toBe(true);
    // … and it names the actual emitter, both as the function and as the command that runs it
    expect(proseContains(block, 'renderPanelComment(')).toBe(true);
    expect(proseContains(block, 'review-core-cli.mjs comment')).toBe(true);
  });

  it('the drain skill states the guarantee as CONDITIONAL — a clean accept with nothing un-blocked stays quiet', () => {
    const block = blockquoteBlockAt(drainSkill(), CHECK);
    expect(block).not.toBe('');
    // reflow-proof: the phrase is matched whitespace-normalized, not at the wrap point it happens to sit at today
    expect(proseContains(block, 'no land that the bar un-blocked happens silently')).toBe(true);
    // the emission must not be described as unconditional — that was the false claim round 1 shipped. Scoped to
    // THIS block: an unrelated future "always visible" elsewhere in the skill is not this control's problem.
    expect(block).not.toMatch(/always visible/i);
  });

  it('the reviewer-facing mandate makes no unconditional "always visible" claim', () => {
    const text = buildSubjectMandate({ subjectNoun: 'diff', mandate: 'correctness' });
    expect(text).not.toMatch(/always visible/i);
    expect(text).not.toContain('still named in the posted review');
    // what it DOES claim is the conditional truth
    expect(proseContains(text, 'when the bar is what un-blocked it')).toBe(true);
  });

  // ── round-4 finding 2 — A NAMED FUNCTION THE DOCUMENTED DOOR CANNOT REACH IS NOT A CONTROL. ──────────
  // The skill told the auto-land branch to test `blocksAcceptance(f)`, but `import { blocksAcceptance } from
  // 'scripts/lib/review-core.mjs'` — the facade the skill documents — threw. Same failure mode as the round-2
  // blocker, one layer out. This is the general guard, derived from both sides: extract every function name the
  // skill's BRANCH-ATTACHED blockquotes name in a code span, and require each to be a real export of a module the
  // skill points its reader at. No hand list on either side, so a future instruction naming an unreachable symbol
  // fails here rather than at 3am on a land.
  it('every function the branch blockquotes name is importable from a module the skill points at', async () => {
    const md = drainSkill();
    // Branch-attached blockquotes are the INDENTED ones (nested in a step); the column-0 blockquotes are
    // document-level callouts, not instructions to call something.
    // Normalized first, so a code span that happens to wrap across two lines is still read as one span.
    const branchQuotes = normalizeProse(md.split('\n').filter((l) => /^\s+>/.test(l)).join('\n'));
    const named = functionNamesInCodeSpans(branchQuotes);
    expect(named.length, 'expected the branch blockquotes to name at least one function').toBeGreaterThan(0);

    const doors = ['../review-core.mjs', '../review-render.mjs'];
    const reachable = new Set();
    for (const d of doors) for (const k of Object.keys(await import(d))) reachable.add(k);

    const unreachable = named.filter((n) => !reachable.has(n));
    expect(unreachable, `named in the drain skill but exported by neither ${doors.join(' nor ')}`).toEqual([]);
  });

  it('the two predicates the check is DEFINED by resolve from the facade specifically', async () => {
    // Tighter than the subset check above: whatever the blockquote states as `fn(f) === <bool>` is a predicate the
    // reader is told to evaluate, so it must come from the documented facade — not merely from somewhere.
    const block = blockquoteBlockAt(drainSkill(), CHECK);
    const predicates = [...normalizeProse(block).matchAll(/\b([a-z][A-Za-z0-9_$]*)\(f\)\s*===\s*(?:true|false)/g)].map((m) => m[1]);
    expect(predicates.length).toBeGreaterThan(0);
    const facade = await import('../review-core.mjs');
    for (const p of predicates) expect(typeof facade[p], `review-core.mjs must export ${p}`).toBe('function');
  });
});

// ── round-2 findings 5 + 6 — one lookup builder, one rank accessor. ────────────────────────────────────
describe('frozenLookup + the shared rank accessor', () => {
  it('frozenLookup is EXPORTED and produces a frozen null-prototype table', () => {
    const t = frozenLookup({ a: 1 });
    expect(Object.getPrototypeOf(t)).toBe(null);
    expect(Object.isFrozen(t)).toBe(true);
    expect(t.toString).toBeUndefined();
  });

  it('both rank accessors report the SAME shape of failure — one accessor, not a hand-copied twin', () => {
    // Same class of message (caller: no rank for <thing> "<key>" — …), differing only in the label each passes.
    expect(() => verdictStrictness('nope')).toThrow(/verdictStrictness: no strictness rank for verdict "nope"/);
    expect(() => impactStrictness('nope')).toThrow(/impactStrictness: no rank for impact level "nope"/);
    // and each names the members it DOES know, which the old hand-written messages did not
    expect(() => verdictStrictness('nope')).toThrow(/known: /);
    expect(() => impactStrictness('nope')).toThrow(/known: /);
  });
});
