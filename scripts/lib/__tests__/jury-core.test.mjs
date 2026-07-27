/**
 * @file jury-core.test.mjs — proof of the #2654 (S2 of epic #2649) append-only JURY-LEDGER EVENT VOCABULARY:
 *   the `JURY_EVENT_TYPES` / `JUROR_STATUSES` enums and the pure `validateJuryEvent` / `normalizeJuryEvent`
 *   schema validator. This is the SHAPE #2641's durable on-disk log appends and the #2642 console serializes;
 *   the on-disk log + fold are #2641, not covered here. New subject-agnostic consumers import from jury-core
 *   directly (these symbols are NOT re-exported through the PR-diff-specific review-core), so this file imports
 *   from '../jury-core.mjs' directly.
 */
import { describe, it, expect } from 'vitest';
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
