/**
 * @file disposition-judge.test.mjs — proof of the #2652 DISPOSITION LAYER (green judge + red judge over the jury
 *   ledger, core of epic #2636). Covers: the HARD gate-self invariant (never auto-dispose, regardless of verdict
 *   or red pass), the fail-closed ledger reads, mandatory-lens coverage, the panel-verdict reduction, both
 *   resolutionModes (present-unless-all-agree / accept-best) under lens weights + dissent threshold, and the red
 *   judge's refutation grounds. Pure module — no I/O, so these are plain unit assertions.
 */
import { describe, it, expect } from 'vitest';
import {
  DISPOSITIONS,
  reduceLedger,
  weightedDissentFraction,
  proposeDisposition,
  redRefute,
  disposeVerdict,
} from '../disposition-judge.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';

// --- ledger builders -------------------------------------------------------------------------------------------
// The mandatory lenses are correctness + security. A "clean" ledger: a roster of one juror per mandatory lens,
// each returning accept, no findings.
function rosterEvent(jurors, round = 0) {
  return { type: 'roster-picked', round, jurors };
}
function verdictEvent(jurorId, verdict, round = 0) {
  return { type: 'verdict', round, jurorId, verdict };
}
function findingEvent(jurorId, finding, round = 0) {
  return { type: 'finding', round, jurorId, finding };
}
const CHARTER = 'judge';

/** A ledger with one juror per given lens (id `${lens}#1`), each returning `verdict`. */
function singleJurorLedger(lenses, verdict = VERDICTS.ACCEPT) {
  const jurors = lenses.map((lens) => ({ id: `${lens}#1`, lens, charter: CHARTER }));
  return [rosterEvent(jurors), ...lenses.map((lens) => verdictEvent(`${lens}#1`, verdict))];
}

/** A clean two-mandatory-lens ledger, TWO jurors per lens all accepting (a diverse jury, no thin-jury ground). */
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
const ACCEPT_BEST = resolveDispositionConfig({ override: { resolutionMode: 'accept-best', dissentThreshold: 0.5 } });

describe('DISPOSITIONS enum', () => {
  it('names exactly the two dispositions, frozen', () => {
    expect(DISPOSITIONS).toEqual({ AUTO_DISPOSE: 'auto-dispose', ESCALATE: 'escalate' });
    expect(Object.isFrozen(DISPOSITIONS)).toBe(true);
  });
});

describe('reduceLedger', () => {
  it('reduces roster + per-juror verdicts to per-lens strictest verdicts', () => {
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'correctness#2', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('correctness#2', VERDICTS.CHANGES), // strictest for correctness
      verdictEvent('security#1', VERDICTS.ACCEPT),
    ];
    const r = reduceLedger(ledger);
    expect(r.rosterKnown).toBe(true);
    expect(r.lensVerdicts).toEqual({ correctness: VERDICTS.CHANGES, security: VERDICTS.ACCEPT });
    expect(r.jurorVerdicts.size).toBe(3);
  });

  it('keeps a juror\'s LATEST-round verdict', () => {
    const ledger = [
      rosterEvent([{ id: 'correctness#1', lens: 'correctness', charter: CHARTER }]),
      verdictEvent('correctness#1', VERDICTS.CHANGES, 0),
      verdictEvent('correctness#1', VERDICTS.ACCEPT, 1), // round 1 supersedes round 0
    ];
    expect(reduceLedger(ledger).lensVerdicts).toEqual({ correctness: VERDICTS.ACCEPT });
  });

  it('collects only OUTSTANDING findings (a fixed finding is resolved)', () => {
    const ledger = [
      rosterEvent([{ id: 'correctness#1', lens: 'correctness', charter: CHARTER }]),
      findingEvent('correctness#1', { summary: 'off-by-one', outcome: 'fixed' }),
      findingEvent('correctness#1', { summary: 'unhandled null' }), // no outcome → outstanding
    ];
    const r = reduceLedger(ledger);
    expect(r.outstandingFindings).toHaveLength(1);
    expect(r.outstandingFindings[0].summary).toBe('unhandled null');
  });

  it('a finding re-reported FIXED in a later round is no longer outstanding (latest state wins)', () => {
    const ledger = [
      rosterEvent([{ id: 'correctness#1', lens: 'correctness', charter: CHARTER }]),
      findingEvent('correctness#1', { summary: 'race in the fold', file: 'a.mjs', line: 10 }, 0), // raised, no outcome
      findingEvent('correctness#1', { summary: 'race in the fold', file: 'a.mjs', line: 10, outcome: 'fixed' }, 2), // fixed later
    ];
    expect(reduceLedger(ledger).outstandingFindings).toHaveLength(0);
  });

  it('never throws on garbage input', () => {
    for (const bad of [null, undefined, 42, 'x', [{}], [{ type: 'nope' }]]) {
      expect(() => reduceLedger(bad)).not.toThrow();
    }
    expect(reduceLedger(null).rosterKnown).toBe(false);
  });
});

describe('weightedDissentFraction', () => {
  it('is 0 on weighted unanimity', () => {
    const r = reduceLedger(singleJurorLedger(MANDATORY_LENSES, VERDICTS.ACCEPT));
    expect(weightedDissentFraction(r, DEFAULT_CONFIG.lensWeights)).toBe(0);
  });

  it('weights a dissenting lens by its configured weight', () => {
    // correctness accepts, security dissents. Give security weight 3, correctness weight 1 → dissent 3/4.
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('security#1', VERDICTS.CHANGES),
    ];
    const cfg = resolveDispositionConfig({ override: { lensWeights: { values: { security: 3, correctness: 1 } } } });
    expect(weightedDissentFraction(reduceLedger(ledger), cfg.lensWeights)).toBeCloseTo(0.75, 5);
  });
});

describe('proposeDisposition — HARD gate-self invariant', () => {
  it('escalates gate-self BEFORE reading the ledger, even on a perfectly clean accept', () => {
    const p = proposeDisposition({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { gateSelf: true } });
    expect(p.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(p.reason).toBe('gate-self');
  });

  it('escalates gate-self even with an empty ledger (never falls through to a ledger read)', () => {
    const p = proposeDisposition({ ledger: [], config: DEFAULT_CONFIG, signals: { gateSelf: true } });
    expect(p.reason).toBe('gate-self');
  });

  it('escalates a caller humanRequired / nonConvergence deadlock', () => {
    expect(proposeDisposition({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { humanRequired: true } }).reason).toBe('human-required');
    expect(proposeDisposition({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { nonConvergence: true } }).reason).toBe('non-convergence');
  });
});

describe('proposeDisposition — fail-closed ledger reads', () => {
  it('escalates when no roster was picked', () => {
    const p = proposeDisposition({ ledger: [verdictEvent('x#1', VERDICTS.ACCEPT)], config: DEFAULT_CONFIG });
    expect(p.reason).toBe('no-roster');
  });

  it('escalates when the roster has no verdicts', () => {
    const p = proposeDisposition({ ledger: [rosterEvent([{ id: 'correctness#1', lens: 'correctness', charter: CHARTER }])], config: DEFAULT_CONFIG });
    expect(p.reason).toBe('no-verdicts');
  });

  it('escalates when a mandatory lens has no verdict', () => {
    // roster + verdict only for correctness; security (mandatory) missing.
    const p = proposeDisposition({ ledger: singleJurorLedger(['correctness']), config: DEFAULT_CONFIG });
    expect(p.reason).toBe('missing-mandatory-lens');
  });

  it('escalates on an unknown resolutionMode (never auto-disposes through a bad mode)', () => {
    const p = proposeDisposition({ ledger: cleanDiverseLedger(), config: { ...DEFAULT_CONFIG, resolutionMode: 'bogus' } });
    expect(p.reason).toBe('unknown-resolution-mode');
    expect(p.disposition).toBe(DISPOSITIONS.ESCALATE);
  });

  it('throws on a missing config (config is required)', () => {
    expect(() => proposeDisposition({ ledger: cleanDiverseLedger() })).toThrow(/config/);
  });

  it('throws on an empty mandatoryLenses set (never vacuously accepts)', () => {
    // A lone advisory juror must NOT auto-dispose with correctness/security unchecked.
    const ledger = [
      rosterEvent([{ id: 'simplicity#1', lens: 'simplicity', charter: CHARTER }]),
      verdictEvent('simplicity#1', VERDICTS.ACCEPT),
    ];
    expect(() => proposeDisposition({ ledger, config: DEFAULT_CONFIG, mandatoryLenses: [] })).toThrow(/non-empty/);
  });

  it('escalates a degenerate all-zero lens-weight config (absence of signal, not unanimity)', () => {
    // Mandatory lenses accept but a dissenting advisory juror exists; all weights 0 → zero weighted signal.
    const cfg = resolveDispositionConfig({ override: { lensWeights: { default: 0, values: {} } } });
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
        { id: 'simplicity#1', lens: 'simplicity', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('security#1', VERDICTS.ACCEPT),
      verdictEvent('simplicity#1', VERDICTS.CHANGES),
    ];
    const p = proposeDisposition({ ledger, config: cfg });
    expect(p.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(p.reason).toBe('degenerate-weights');
  });
});

describe('proposeDisposition — panel verdict', () => {
  it('escalates when a mandatory lens wants changes', () => {
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('security#1', VERDICTS.CHANGES),
    ];
    expect(proposeDisposition({ ledger, config: DEFAULT_CONFIG }).reason).toBe('panel-changes');
  });

  it('escalates when a mandatory lens returns needs-human', () => {
    const ledger = singleJurorLedger(MANDATORY_LENSES, VERDICTS.ACCEPT);
    ledger.push(verdictEvent('security#1', VERDICTS.NEEDS_HUMAN, 1)); // override security to needs-human
    expect(proposeDisposition({ ledger, config: DEFAULT_CONFIG }).reason).toBe('panel-needs-human');
  });
});

describe('proposeDisposition — resolutionMode', () => {
  it('present-unless-all-agree AUTO-DISPOSES on weighted unanimity', () => {
    const p = proposeDisposition({ ledger: singleJurorLedger(MANDATORY_LENSES), config: DEFAULT_CONFIG });
    expect(p.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
    expect(p.reason).toBe('unanimous-accept');
    expect(p.dissentFraction).toBe(0);
  });

  it('present-unless-all-agree ESCALATES on any dissent, even below an accept-best threshold', () => {
    // Add a third, non-mandatory advisory juror that dissents — mandatory lenses still both accept.
    const ledger = [
      ...singleJurorLedger(MANDATORY_LENSES),
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
        { id: 'simplicity#1', lens: 'simplicity', charter: CHARTER },
      ]),
      verdictEvent('simplicity#1', VERDICTS.CHANGES),
    ];
    const p = proposeDisposition({ ledger, config: DEFAULT_CONFIG });
    expect(p.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(p.reason).toBe('dissent-present');
  });

  it('accept-best AUTO-DISPOSES while dissent is within tolerance', () => {
    // 3 advisory jurors: 2 accept, 1 dissents → dissent 1/5 = 0.2 with the two mandatory accepts too. Threshold 0.5.
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
        { id: 'simplicity#1', lens: 'simplicity', charter: CHARTER },
        { id: 'simplicity#2', lens: 'simplicity', charter: CHARTER },
        { id: 'standards-conformance#1', lens: 'standards-conformance', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('security#1', VERDICTS.ACCEPT),
      verdictEvent('simplicity#1', VERDICTS.ACCEPT),
      verdictEvent('simplicity#2', VERDICTS.CHANGES),
      verdictEvent('standards-conformance#1', VERDICTS.ACCEPT),
    ];
    const p = proposeDisposition({ ledger, config: ACCEPT_BEST });
    expect(p.dissentFraction).toBeCloseTo(0.2, 5);
    expect(p.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
    expect(p.reason).toBe('accept-best-within-tolerance');
  });

  it('accept-best ESCALATES when dissent exceeds the threshold', () => {
    // one advisory dissenter out of three total jurors → 1/3 ≈ 0.333 > threshold 0.25
    const cfg = resolveDispositionConfig({ override: { resolutionMode: 'accept-best', dissentThreshold: 0.25 } });
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
        { id: 'simplicity#1', lens: 'simplicity', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('security#1', VERDICTS.ACCEPT),
      verdictEvent('simplicity#1', VERDICTS.CHANGES),
    ];
    const p = proposeDisposition({ ledger, config: cfg });
    expect(p.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(p.reason).toBe('dissent-over-threshold');
  });

  it('accept-best ESCALATES (never auto-disposes) on a degenerate dissentThreshold + a dissenting juror', () => {
    // A directly-invoked accept-best config whose dissentThreshold is NaN / missing must NOT fail open:
    // `dissentFraction > NaN` is false, so without the guard a contested review would auto-dispose. Fail-closed.
    const ledger = [
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
        { id: 'simplicity#1', lens: 'simplicity', charter: CHARTER },
      ]),
      verdictEvent('correctness#1', VERDICTS.ACCEPT),
      verdictEvent('security#1', VERDICTS.ACCEPT),
      verdictEvent('simplicity#1', VERDICTS.CHANGES),
    ];
    for (const dissentThreshold of [NaN, undefined]) {
      const p = proposeDisposition({ ledger, config: { ...ACCEPT_BEST, dissentThreshold } });
      expect(p.disposition).toBe(DISPOSITIONS.ESCALATE);
      expect(p.reason).toBe('degenerate-threshold');
    }
  });
});

describe('redRefute — the adversary', () => {
  it('does not engage a proposal that is not auto-dispose', () => {
    const r = redRefute({ ledger: [], config: DEFAULT_CONFIG, proposal: { disposition: DISPOSITIONS.ESCALATE } });
    expect(r.refuted).toBe(false);
    expect(r.grounds).toEqual([]);
  });

  it('does NOT refute a clean, diverse, unanimous auto-dispose', () => {
    const proposal = proposeDisposition({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    expect(proposal.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
    const r = redRefute({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, proposal });
    expect(r.refuted).toBe(false);
  });

  it('refutes gate-self unconditionally (independent enforcement of the hard invariant)', () => {
    const proposal = { disposition: DISPOSITIONS.AUTO_DISPOSE };
    const r = redRefute({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, proposal, signals: { gateSelf: true } });
    expect(r.refuted).toBe(true);
    expect(r.grounds.join(' ')).toMatch(/gate-self/);
  });

  it('refutes a thin (single-juror) mandatory lens', () => {
    const proposal = { disposition: DISPOSITIONS.AUTO_DISPOSE };
    const r = redRefute({ ledger: singleJurorLedger(MANDATORY_LENSES), config: DEFAULT_CONFIG, proposal });
    expect(r.refuted).toBe(true);
    expect(r.grounds.join(' ')).toMatch(/thin-jury/);
  });

  it('refutes an outstanding finding the accept glossed', () => {
    const ledger = [...cleanDiverseLedger(), findingEvent('security#1', { summary: 'timing side-channel' })];
    const proposal = { disposition: DISPOSITIONS.AUTO_DISPOSE };
    const r = redRefute({ ledger, config: DEFAULT_CONFIG, proposal });
    expect(r.refuted).toBe(true);
    expect(r.grounds.join(' ')).toMatch(/outstanding-finding/);
  });

  it('refutes a tolerated weighted dissent (accept-best smoothed it over)', () => {
    // Diverse mandatory accept + one advisory dissenter under accept-best threshold 0.5.
    const ledger = [
      ...cleanDiverseLedger(),
      rosterEvent([
        { id: 'correctness#1', lens: 'correctness', charter: CHARTER },
        { id: 'correctness#2', lens: 'correctness', charter: CHARTER },
        { id: 'security#1', lens: 'security', charter: CHARTER },
        { id: 'security#2', lens: 'security', charter: CHARTER },
        { id: 'simplicity#1', lens: 'simplicity', charter: CHARTER },
      ]),
      verdictEvent('simplicity#1', VERDICTS.CHANGES),
    ];
    const proposal = proposeDisposition({ ledger, config: ACCEPT_BEST });
    expect(proposal.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE); // green tolerated it (1/5 ≤ 0.5)
    const r = redRefute({ ledger, config: ACCEPT_BEST, proposal });
    expect(r.refuted).toBe(true);
    expect(r.grounds.join(' ')).toMatch(/tolerated-dissent/);
  });
});

describe('disposeVerdict — green + red combined', () => {
  it('AUTO-DISPOSES only when green proposes it AND red fails to refute', () => {
    const v = disposeVerdict({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    expect(v.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
    expect(v.red.refuted).toBe(false);
    expect(v.trail.length).toBeGreaterThan(0);
  });

  it('escalates when green escalates — red pass skipped', () => {
    const v = disposeVerdict({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { gateSelf: true } });
    expect(v.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(v.reason).toBe('gate-self');
    expect(v.red).toBeNull();
  });

  it('escalates when green proposes auto-dispose but red refutes (thin jury)', () => {
    const v = disposeVerdict({ ledger: singleJurorLedger(MANDATORY_LENSES), config: DEFAULT_CONFIG });
    expect(v.disposition).toBe(DISPOSITIONS.ESCALATE);
    expect(v.reason).toBe('red-refuted');
    expect(v.red.refuted).toBe(true);
  });

  it('gate-self NEVER auto-disposes regardless of a spotless verdict (the ratified carve-out)', () => {
    // A maximally-clean diverse ledger with gate-self set must still escalate.
    const v = disposeVerdict({ ledger: cleanDiverseLedger(), config: ACCEPT_BEST, signals: { gateSelf: true } });
    expect(v.disposition).toBe(DISPOSITIONS.ESCALATE);
  });
});
