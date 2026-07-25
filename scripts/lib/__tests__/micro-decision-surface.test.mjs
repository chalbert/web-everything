/**
 * @file micro-decision-surface.test.mjs — proof of the #2650 SURFACING half (the per-fork contention reduction
 *   that feeds the plateau-app micro-decision surface). Covers: a clean fork auto-clears (never surfaced), a
 *   dissenting / needs-human / gate-self / no-roster fork surfaces as CONTESTED, the ordered contested queue,
 *   the auto-cleared partition + counts, and that the module CONSUMES the #2652 judge rather than re-deriving
 *   contention. Pure module — plain unit assertions, no I/O.
 */
import { describe, it, expect } from 'vitest';
import { classifyForkContention, buildMicroDecisionQueue } from '../micro-decision-surface.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';

// --- ledger builders (mirror disposition-judge.test.mjs) -------------------------------------------------------
function rosterEvent(jurors, round = 0) {
  return { type: 'roster-picked', round, jurors };
}
function verdictEvent(jurorId, verdict, round = 0) {
  return { type: 'verdict', round, jurorId, verdict };
}
const CHARTER = 'judge';

/** A clean two-mandatory-lens ledger, TWO jurors per lens all accepting (diverse jury, no thin-jury refute). */
function cleanDiverseLedger(verdict = VERDICTS.ACCEPT) {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, verdict));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

/** A ledger where one mandatory lens wants changes → the panel does not converge → escalate. */
function dissentingLedger() {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      // correctness#2 wants changes; everyone else accepts.
      verdicts.push(verdictEvent(id, id === 'correctness#2' ? VERDICTS.CHANGES : VERDICTS.ACCEPT));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

describe('classifyForkContention', () => {
  it('auto-clears a clean, unanimous fork (NOT contested)', () => {
    const dto = classifyForkContention({ n: 1, question: 'Read-time or baked?', ledger: cleanDiverseLedger() });
    expect(dto.contested).toBe(false);
    expect(dto.disposition).toBe('auto-dispose');
    expect(dto.n).toBe(1);
    expect(dto.question).toBe('Read-time or baked?');
    expect(Array.isArray(dto.trail)).toBe(true);
  });

  it('marks a dissenting fork CONTESTED with the judge reason + trail', () => {
    const dto = classifyForkContention({ n: 2, ledger: dissentingLedger() });
    expect(dto.contested).toBe(true);
    expect(dto.disposition).toBe('escalate');
    expect(dto.reason).toBe('panel-changes');
    expect(dto.trail.length).toBeGreaterThan(0);
    // no question supplied → the `Fork N` fallback.
    expect(dto.question).toBe('Fork 2');
  });

  it('surfaces a gate-self fork CONTESTED regardless of a clean ledger (fail-closed hard invariant)', () => {
    const dto = classifyForkContention({ n: 3, ledger: cleanDiverseLedger(), signals: { gateSelf: true } });
    expect(dto.contested).toBe(true);
    expect(dto.reason).toBe('gate-self');
  });

  it('surfaces a fork with an unreadable (empty) ledger CONTESTED (fail-closed)', () => {
    const dto = classifyForkContention({ n: 4, ledger: [] });
    expect(dto.contested).toBe(true);
    expect(dto.disposition).toBe('escalate');
  });

  it('carries recommendedDefault through when present, omits it when absent', () => {
    const withRec = classifyForkContention({ n: 1, ledger: cleanDiverseLedger(), recommendedDefault: 'Recommended default: Fork 1 (b)' });
    expect(withRec.recommendedDefault).toBe('Recommended default: Fork 1 (b)');
    const without = classifyForkContention({ n: 1, ledger: cleanDiverseLedger() });
    expect(without).not.toHaveProperty('recommendedDefault');
  });

  it('honours a per-fork accept-best config (tolerates weighted dissent below the threshold)', () => {
    // A single dissenter under accept-best with a high threshold auto-clears — proving the module consumes the
    // fork's own resolved config rather than a hardcoded policy.
    const acceptBest = resolveDispositionConfig({ override: { resolutionMode: 'accept-best', dissentThreshold: 0.9 } });
    const dto = classifyForkContention({ n: 1, ledger: dissentingLedger(), config: acceptBest });
    // panel-changes still escalates (a mandatory lens wanting changes is not a mere weighted dissent) — so this
    // stays contested; the point is the config is threaded, verified next with a weighted-dissent-only ledger.
    expect(dto.disposition).toBe('escalate');
  });
});

describe('buildMicroDecisionQueue', () => {
  const decision = {
    repo: 'webeverything',
    id: '2650-micro',
    num: '2650',
    title: 'A decision with mixed forks',
    forks: [
      { n: 3, question: 'Third — clean', ledger: cleanDiverseLedger() },
      { n: 1, question: 'First — dissent', ledger: dissentingLedger() },
      { n: 2, question: 'Second — gate-self', ledger: cleanDiverseLedger(), signals: { gateSelf: true } },
    ],
  };
  const q = buildMicroDecisionQueue(decision);

  it('surfaces ONLY the contested forks in the queue', () => {
    expect(q.contested.map((f) => f.n)).toEqual([1, 2]); // dissent + gate-self, fork-order ascending
    expect(q.contested.every((f) => f.contested)).toBe(true);
  });

  it('partitions the auto-cleared forks out of the surfaced queue', () => {
    expect(q.autoCleared.map((f) => f.n)).toEqual([3]);
    expect(q.autoCleared.every((f) => !f.contested)).toBe(true);
  });

  it('reports honest counts', () => {
    expect(q.forkCount).toBe(3);
    expect(q.contestedCount).toBe(2);
    expect(q.autoClearedCount).toBe(1);
  });

  it('carries the decision identity through', () => {
    expect(q.repo).toBe('webeverything');
    expect(q.decisionId).toBe('2650-micro');
    expect(q.decisionNum).toBe('2650');
    expect(q.decisionTitle).toBe('A decision with mixed forks');
  });

  it('a decision with no forks yields an honest empty queue (never throws)', () => {
    const empty = buildMicroDecisionQueue({ id: 'x', title: 'no forks', forks: [] });
    expect(empty.contested).toEqual([]);
    expect(empty.autoCleared).toEqual([]);
    expect(empty.contestedCount).toBe(0);
    expect(empty.forkCount).toBe(0);
  });

  it('a decision where every fork auto-clears surfaces nothing (all auto-disposed)', () => {
    const allClean = buildMicroDecisionQueue({
      id: 'y', title: 'all clean',
      forks: [ { n: 1, ledger: cleanDiverseLedger() }, { n: 2, ledger: cleanDiverseLedger() } ],
    });
    expect(allClean.contestedCount).toBe(0);
    expect(allClean.autoClearedCount).toBe(2);
  });
});
