/**
 * @file scripts/__tests__/workflow-invariants.test.mjs
 * @description Pins the workflow-intent invariants (#2084) — the cross-item / clock-needing backlog rules
 * (sliced-epic sizing, born-active settlement) the per-item schema validator cannot see. Fixture-tested so
 * the pure rules don't depend on the live backlog tree.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateWorkflowInvariants } = require('../lib/workflow-invariants.cjs');

const msgs = (r) => r.errors.map((e) => e.message);
const warns = (r) => r.warnings.map((w) => w.message);

describe('validateWorkflowInvariants — sliced-epic sizing', () => {
  it('passes an unsliced (childless) epic that carries a size', () => {
    const r = validateWorkflowInvariants([{ id: 'e', num: '010', kind: 'epic', size: 5 }]);
    expect(r.errors).toHaveLength(0);
  });

  it('passes a sliced epic with children and no size', () => {
    const r = validateWorkflowInvariants([
      { id: 'e', num: '010', kind: 'epic' },
      { id: 'c', num: '011', kind: 'story', size: 3, parent: '010' },
    ]);
    expect(r.errors).toHaveLength(0);
  });

  it('does NOT require a childless epic to be sized (unsliced-awaiting-slice is valid)', () => {
    const r = validateWorkflowInvariants([{ id: 'e', num: '010', kind: 'epic' }]);
    expect(r.errors).toHaveLength(0);
  });

  it('flags a sized epic with a sized child (double-count) with the sharper message', () => {
    const r = validateWorkflowInvariants([
      { id: 'e', num: '010', kind: 'epic', size: 8 },
      { id: 'c', num: '011', kind: 'story', size: 3, parent: '010' },
    ]);
    expect(msgs(r)).toHaveLength(1);
    expect(msgs(r)[0]).toMatch(/double-counts/);
  });

  it('flags a sized epic with a sizeless (task) child as SLICED — no double-count message', () => {
    const r = validateWorkflowInvariants([
      { id: 'e', num: '010', kind: 'epic', size: 8 },
      { id: 'c', num: '011', kind: 'task', parent: '010' },
    ]);
    expect(msgs(r)).toHaveLength(1);
    expect(msgs(r)[0]).toMatch(/is SLICED and must carry no/);
    expect(msgs(r)[0]).not.toMatch(/double-counts/);
  });

  it('a single child of any kind flips the epic to sliced (the flip trigger)', () => {
    const r = validateWorkflowInvariants([
      { id: 'e', num: '010', kind: 'epic', size: 2 },
      { id: 'c', num: '011', kind: 'story', size: 1, parent: '010' },
    ]);
    expect(msgs(r)).toHaveLength(1);
  });
});

describe('validateWorkflowInvariants — born-active settlement TTL (#670)', () => {
  const born = (over) => ({
    id: 'x', num: '020', kind: 'story', size: 3, status: 'active',
    scaffoldedBy: 'batch-abc', dateScaffolded: '2026-07-01', ...over,
  });

  it('warns on a born-active scaffold left unsettled past its creating day', () => {
    const r = validateWorkflowInvariants([born()], { today: '2026-07-02' });
    expect(warns(r)).toHaveLength(1);
    expect(warns(r)[0]).toMatch(/born-active scaffold.*settle 020/s);
  });

  it('does not warn on the same day it was scaffolded (grace: its creating day)', () => {
    const r = validateWorkflowInvariants([born()], { today: '2026-07-01' });
    expect(r.warnings).toHaveLength(0);
  });

  it('does not warn once it has been claimed (dateStarted set)', () => {
    const r = validateWorkflowInvariants([born({ dateStarted: '2026-07-01' })], { today: '2026-07-09' });
    expect(r.warnings).toHaveLength(0);
  });

  it('does not warn on a normal active item (no scaffoldedBy)', () => {
    const r = validateWorkflowInvariants(
      [born({ scaffoldedBy: undefined, dateStarted: '2026-07-01' })], { today: '2026-07-09' });
    expect(r.warnings).toHaveLength(0);
  });

  it('is inert without a today (pure — never reads a clock itself)', () => {
    const r = validateWorkflowInvariants([born()]);
    expect(r.warnings).toHaveLength(0);
  });
});

describe('validateWorkflowInvariants — robustness', () => {
  it('tolerates an empty / non-array input', () => {
    expect(validateWorkflowInvariants(undefined).errors).toHaveLength(0);
    expect(validateWorkflowInvariants([]).errors).toHaveLength(0);
  });

  it('ignores non-epic items for the sizing rule', () => {
    const r = validateWorkflowInvariants([{ id: 's', num: '001', kind: 'story', size: 3, parent: '010' }]);
    expect(r.errors).toHaveLength(0);
  });
});
