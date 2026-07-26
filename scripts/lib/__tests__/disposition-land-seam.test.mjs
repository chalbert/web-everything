/**
 * @file disposition-land-seam.test.mjs — proof of the #2674 SEAM that wires the #2652 disposition judge into the
 *   review land path. Covers: a clean-winner ledger → the auto-CLEAR (accept) intent; escalate / contested /
 *   red-refuted / gate-self → a KEEP-PARKED (review:human) intent, never an accept; the INVARIANT-2 refusal
 *   (a review:human PR is never laundered into an accept even on a survived auto-dispose); and the fail-closed
 *   judge-error ring (a bad config keeps the PR parked, never auto-accepts, never throws). Pure module.
 */
import { describe, it, expect } from 'vitest';
import { decideDispositionLabel, LAND_ACTIONS } from '../disposition-land-seam.mjs';
import { DISPOSITIONS } from '../disposition-judge.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { REVIEW_LABELS } from '../review-escalation.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';

// --- ledger builders (mirrors disposition-judge.test.mjs) ------------------------------------------------------
const CHARTER = 'judge';
function rosterEvent(jurors, round = 0) { return { type: 'roster-picked', round, jurors }; }
function verdictEvent(jurorId, verdict, round = 0) { return { type: 'verdict', round, jurorId, verdict }; }
function findingEvent(jurorId, finding, round = 0) { return { type: 'finding', round, jurorId, finding }; }

/** A ledger with ONE juror per lens (thin — a red-judge thin-jury ground), each returning `verdict`. */
function singleJurorLedger(lenses, verdict = VERDICTS.ACCEPT) {
  const jurors = lenses.map((lens) => ({ id: `${lens}#1`, lens, charter: CHARTER }));
  return [rosterEvent(jurors), ...lenses.map((lens) => verdictEvent(`${lens}#1`, verdict))];
}

/** A clean two-mandatory-lens ledger, TWO jurors per lens all accepting (a diverse jury, no thin-jury ground,
 *  no findings) — the clean-winner case: green auto-disposes AND red finds no grounds to refute. */
function cleanDiverseLedger() {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, VERDICTS.ACCEPT));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

const DEFAULT_CONFIG = resolveDispositionConfig(); // present-unless-all-agree, dissentThreshold 0, equal weights

describe('LAND_ACTIONS enum', () => {
  it('names exactly the two land actions, frozen', () => {
    expect(LAND_ACTIONS).toEqual({ CLEAR: 'clear', KEEP_PARKED: 'keep-parked' });
    expect(Object.isFrozen(LAND_ACTIONS)).toBe(true);
  });
});

describe('decideDispositionLabel — clear winner → auto-CLEAR (accept) intent', () => {
  it('a clean diverse unanimous-accept ledger yields the accept swap', () => {
    const intent = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    expect(intent.action).toBe(LAND_ACTIONS.CLEAR);
    expect(intent.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
    // the label intent is decideSetLabel's accept swap: add review:accepted, drop the parked review:pending
    expect(intent.setLabel.allowed).toBe(true);
    expect(intent.setLabel.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(intent.setLabel.removeLabels).toContain(REVIEW_LABELS.pending);
    expect(intent.verdict.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
  });
});

describe('decideDispositionLabel — escalate → KEEP-PARKED (review:human), never an accept', () => {
  it('gate-self is ALWAYS kept parked (the hard invariant), whatever the ledger says', () => {
    const intent = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { gateSelf: true } });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(intent.reason).toBe('gate-self');
    expect(intent.setLabel.addLabel).toBe(REVIEW_LABELS.human);
    expect(intent.setLabel.addLabel).not.toBe(REVIEW_LABELS.accepted);
  });

  it('a contested panel (a mandatory lens wants changes) is kept parked', () => {
    const ledger = singleJurorLedger(MANDATORY_LENSES, VERDICTS.CHANGES);
    const intent = decideDispositionLabel({ ledger, config: DEFAULT_CONFIG });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.setLabel.addLabel).toBe(REVIEW_LABELS.human);
  });

  it('keep-parked scrubs BOTH review:pending AND a stale review:accepted (never leaves it looking accepted)', () => {
    const ledger = singleJurorLedger(MANDATORY_LENSES, VERDICTS.CHANGES);
    const intent = decideDispositionLabel({ ledger, config: DEFAULT_CONFIG });
    expect(intent.setLabel.removeLabels).toContain(REVIEW_LABELS.pending);
    expect(intent.setLabel.removeLabels).toContain(REVIEW_LABELS.accepted);
  });

  it('a red-REFUTED auto-dispose (a thin single-juror mandatory lens) is kept parked, reason red-refuted', () => {
    // green proposes auto-dispose (unanimous accept, dissent 0) but the red adversary refutes the thin jury.
    const intent = decideDispositionLabel({ ledger: singleJurorLedger(MANDATORY_LENSES), config: DEFAULT_CONFIG });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.reason).toBe('red-refuted');
    expect(intent.setLabel.addLabel).toBe(REVIEW_LABELS.human);
  });

  it('an outstanding finding refutes the auto-dispose → kept parked', () => {
    const ledger = [
      ...cleanDiverseLedger(),
      findingEvent('correctness#1', { file: 'x.mjs', summary: 'a flaw no fix resolved', outcome: 'open' }),
    ];
    const intent = decideDispositionLabel({ ledger, config: DEFAULT_CONFIG });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.reason).toBe('red-refuted');
  });
});

describe('decideDispositionLabel — INVARIANT 2: a review:human PR is never laundered into an accept', () => {
  it('even a survived auto-dispose is refused an accept when the PR carries review:human', () => {
    const intent = decideDispositionLabel({
      ledger: cleanDiverseLedger(),
      config: DEFAULT_CONFIG,
      currentLabels: [REVIEW_LABELS.human],
    });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.reason).toMatch(/^refused-accept:/);
    expect(intent.setLabel.addLabel).toBe(REVIEW_LABELS.human);
    expect(intent.setLabel.addLabel).not.toBe(REVIEW_LABELS.accepted);
  });
});

describe('decideDispositionLabel — fail-closed judge-error ring', () => {
  it('a missing config keeps the PR parked (never auto-accepts) and never throws', () => {
    let intent;
    expect(() => { intent = decideDispositionLabel({ ledger: cleanDiverseLedger() }); }).not.toThrow();
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.reason).toMatch(/^judge-error:/);
    expect(intent.setLabel.addLabel).toBe(REVIEW_LABELS.human);
    expect(intent.verdict).toBeNull();
  });

  it('an empty ledger is fail-closed to parked (no-roster), never an accept', () => {
    const intent = decideDispositionLabel({ ledger: [], config: DEFAULT_CONFIG });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(intent.setLabel.addLabel).not.toBe(REVIEW_LABELS.accepted);
  });
});

describe('decideDispositionLabel — decision-only', () => {
  it('returns an intent and applies nothing (no thrown side-effect path)', () => {
    // The seam is pure: calling it many times with the same inputs yields identical intents.
    const a = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    const b = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    expect(a.action).toBe(b.action);
    expect(a.setLabel).toEqual(b.setLabel);
  });
});
