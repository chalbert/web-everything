/**
 * @file scripts/conveyor/__tests__/jury-tree.test.mjs
 * @description Unit proof of the CONVEYOR LIVE JURY TREE renderer (WE #2641, epic #2636). Drives the PURE
 *   {@link renderJuryTree} / {@link renderAllJuryTrees} directly with folded-ledger fixtures (the shape the ONE
 *   shared fold `jury-ledger.foldJuryLedger` returns) — NO fs / clock. Confirms the tree shows each juror's
 *   status, verdict, charter and findings, that an empty / no-roster / no-run case degrades to one honest line,
 *   and that a null/partial ledger never throws.
 */
import { describe, it, expect } from 'vitest';
import { renderJuryTree, renderAllJuryTrees, STATUS_MARKERS, VERDICT_MARKERS } from '../jury-tree.mjs';

function ledger(overrides = {}) {
  return {
    rosterKnown: true,
    round: 1,
    counts: { pending: 0, running: 1, found: 1 },
    lensVerdicts: { correctness: 'accept', security: 'changes' },
    panelVerdict: 'changes',
    findingCount: 1,
    jurors: [
      { id: 'correctness#1', lens: 'correctness', charter: 'judge correctness', status: 'found', verdict: 'accept', findings: [] },
      { id: 'security#1', lens: 'security', charter: 'judge security', status: 'running', verdict: 'changes', findings: [{ summary: 'unsafe eval', file: 'x.mjs', line: 3 }] },
    ],
    ...overrides,
  };
}

describe('renderJuryTree — a /workflows-style subject tree', () => {
  const out = renderJuryTree('we#123', ledger());

  it('headline carries the round, juror counts, and panel verdict', () => {
    expect(out).toContain('JURY we#123 · round 1 · 2 jurors');
    expect(out).toContain('panel');
    expect(out).toContain('changes'); // panel verdict word
  });
  it('renders one branch per juror with its status marker + verdict + lens', () => {
    expect(out).toContain(`${STATUS_MARKERS.found} correctness [correctness#1]`);
    expect(out).toContain(`${STATUS_MARKERS.running} security [security#1]`);
  });
  it('shows each juror charter and its findings with file:line', () => {
    expect(out).toContain('charter: judge correctness');
    expect(out).toContain('unsafe eval (x.mjs:3)');
    expect(out).toContain('1 finding');
  });
  it('uses the verdict glyphs', () => {
    expect(out).toContain(VERDICT_MARKERS.accept);
    expect(out).toContain(VERDICT_MARKERS.changes);
  });
});

describe('renderJuryTree — graceful degradation', () => {
  it('no roster yet → one honest line, never throws', () => {
    expect(renderJuryTree('we#5', { rosterKnown: false, jurors: [] })).toContain('has not convened');
    expect(renderJuryTree('we#5', null)).toContain('has not convened');
    expect(renderJuryTree('we#5', undefined)).toContain('has not convened');
  });
});

describe('renderAllJuryTrees', () => {
  it('no logged subjects → one idle note', () => {
    expect(renderAllJuryTrees([])).toContain('no jury runs logged');
    expect(renderAllJuryTrees(null)).toContain('no jury runs logged');
  });
  it('renders every subject, separated', () => {
    const out = renderAllJuryTrees([
      { subject: 'we#1', ledger: ledger() },
      { subject: 'we#2', ledger: { rosterKnown: false, jurors: [] } },
    ]);
    expect(out).toContain('JURY we#1');
    expect(out).toContain('JURY we#2');
  });
});
