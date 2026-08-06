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
  it('#2823 — maps prevention-outstanding to its own glyph, NOT the neutral no-verdict dot', () => {
    expect(VERDICT_MARKERS['prevention-outstanding']).toBe('⚐');
    expect(VERDICT_MARKERS['prevention-outstanding']).not.toBe('·');
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

// ── round-2 finding 5 — VERDICT_MARKERS had the rank tables' prototype hole, one `||` away. ────────────
// A frozen NORMAL-prototype object read with `VERDICT_MARKERS[v] || '·'`: `||` only fires on a FALSY value, and an
// inherited `Object.prototype` member is a truthy function — so an unknown verdict rendered the native function
// into the live tree instead of the neutral dot. The table is now built through `frozenLookup` and keyed from the
// `VERDICTS` enum. These probe the real prototype members, not a hand-picked invented word.
describe('VERDICT_MARKERS is prototype-proof (round-2 finding 5)', () => {
  const PROTO_KEYS = ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'propertyIsEnumerable'];

  it('the table is NULL-PROTOTYPE, so an inherited key is genuinely absent', () => {
    expect(Object.getPrototypeOf(VERDICT_MARKERS)).toBe(null);
    for (const key of PROTO_KEYS) expect(VERDICT_MARKERS[key]).toBeUndefined();
  });

  it.each(PROTO_KEYS)('a panel verdict of "%s" renders the neutral dot, never an inherited member', (key) => {
    const out = renderJuryTree('we#1', ledger({ panelVerdict: key }));
    expect(out).toContain(`panel · ${key}`);
    expect(out).not.toContain('[native code]');
  });

  it('every real verdict still has its own glyph', () => {
    expect(VERDICT_MARKERS.accept).toBe('✓');
    expect(VERDICT_MARKERS['prevention-outstanding']).toBe('⚐');
  });
});

// ── round-4 finding 4 — STATUS_MARKERS was MISSED by the round-2 null-prototype sweep. ────────────────
// Same file, twenty lines above `VERDICT_MARKERS`, same defect: `STATUS_MARKERS[j.status] || '?'` on a normal
// prototype chain. `j.status` comes from the folded ledger, whose juror records originate as model-produced JSON,
// so a juror status of `'toString'` rendered the native function into the live conveyor tree. The round-2 prose
// claimed "every module-level lookup table on this path is null-prototype" while this one was not — hence this
// test asserts the CLASS (all exported tables in this module), not just the one table that was found.
describe('STATUS_MARKERS is prototype-proof (round-4 finding 4)', () => {
  const PROTO_KEYS = ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'propertyIsEnumerable'];

  it('every exported lookup table in this module is null-prototype — asserted as a class, not one table', async () => {
    // The table set is DERIVED from the module's own exports (every non-function export), not hand-listed: a
    // THIRD marker table added later is covered without anyone remembering to add it here — which is precisely
    // the omission that let `STATUS_MARKERS` through the round-2 sweep.
    const tables = Object.entries(await import('../jury-tree.mjs')).filter(([, v]) => v && typeof v === 'object');
    expect(tables.map(([n]) => n).sort()).toEqual(['STATUS_MARKERS', 'VERDICT_MARKERS']); // pins the derivation itself
    for (const [name, table] of tables) {
      expect(Object.getPrototypeOf(table), `${name} must be null-prototype`).toBe(null);
      for (const key of PROTO_KEYS) expect(table[key], `${name}.${key}`).toBeUndefined();
    }
  });

  it.each(PROTO_KEYS)('a juror status of "%s" renders the `?` fallback, never an inherited member', (key) => {
    const out = renderJuryTree('we#1', ledger({
      jurors: [{ id: 'correctness#1', lens: 'correctness', charter: 'c', status: key, verdict: 'accept', findings: [] }],
    }));
    expect(out).toContain('? correctness [correctness#1]');
    expect(out).not.toContain('[native code]');
  });

  it('the three real lifecycle statuses still render their own glyph', () => {
    expect(STATUS_MARKERS.pending).toBe('◷');
    expect(STATUS_MARKERS.running).toBe('⟳');
    expect(STATUS_MARKERS.found).toBe('✓');
  });
});
