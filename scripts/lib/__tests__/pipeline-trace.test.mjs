/**
 * @file pipeline-trace.test.mjs — proof of the #2818 per-step pipeline trace grammar: `normalizeStep` (the shared
 *   shape, tolerant of any input) and the three step builders (`reviewStepFromLedger`,
 *   `escalationStepFromReviewDetail`, `landStepFromHistoryEntries`), each pure and never-throwing.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeStep,
  reviewStepFromLedger,
  escalationStepFromReviewDetail,
  landStepFromHistoryEntries,
} from '../pipeline-trace.mjs';
import { buildReviewLedgerEvents, foldJuryLedger } from '../jury-ledger.mjs';

describe('normalizeStep — the shared shape, tolerant of any input', () => {
  it('degrades an empty/missing input to the all-defaults shape, never throws', () => {
    expect(() => normalizeStep()).not.toThrow();
    const s = normalizeStep();
    expect(s).toEqual({ name: '', status: 'unknown', verdict: null, reasons: [], actor: '', startedAt: null, endedAt: null });
  });

  it('does not throw on wildly malformed input (a string, a number, an array)', () => {
    expect(() => normalizeStep('nonsense')).not.toThrow();
    expect(() => normalizeStep(42)).not.toThrow();
    expect(() => normalizeStep([1, 2, 3])).not.toThrow();
    expect(normalizeStep('nonsense').status).toBe('unknown');
  });

  it('rejects a status not in the enum, degrading it to "unknown"', () => {
    expect(normalizeStep({ status: 'made-up' }).status).toBe('unknown');
    expect(normalizeStep({ status: 'landed' }).status).toBe('landed');
  });

  it('passes through valid fields and coerces reasons to a string-only array', () => {
    const s = normalizeStep({
      name: 'review', status: 'done', verdict: 'accept', reasons: ['a', 1, 'b', null],
      actor: 'jury', rounds: 3, startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-02T00:00:00Z',
      careLevel: 'elevated', detail: { x: 1 },
    });
    expect(s).toEqual({
      name: 'review', status: 'done', verdict: 'accept', reasons: ['a', 'b'],
      actor: 'jury', rounds: 3, startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-02T00:00:00Z',
      careLevel: 'elevated', detail: { x: 1 },
    });
  });

  it('omits rounds/careLevel/detail entirely when not given (no undefined-valued keys)', () => {
    const s = normalizeStep({ name: 'x' });
    expect('rounds' in s).toBe(false);
    expect('careLevel' in s).toBe(false);
    expect('detail' in s).toBe(false);
  });
});

describe('reviewStepFromLedger — folds a subject\'s raw jury-ledger event stream (#2818)', () => {
  it('calls foldJuryLedger unchanged (matches a direct fold call) and derives rounds = ledger.round + 1', () => {
    // The existing multi-round fixture (jury-ledger.test.mjs's own "maps rounds → round-advanced" case),
    // reused rather than inventing a new one, per this card's Done-when.
    const events = buildReviewLedgerEvents({
      activeLenses: ['correctness'],
      lensVerdicts: { correctness: 'accept' },
      rounds: 3,
    });
    const ledger = foldJuryLedger(events);
    const step = reviewStepFromLedger(events);
    expect(ledger.round).toBe(2);
    expect(step.rounds).toBe(ledger.round + 1);
    expect(step.verdict).toBe(ledger.panelVerdict);
    expect(step.actor).toBe('jury');
    expect(step.name).toBe('review');
    expect(step.status).toBe('done'); // panelVerdict is non-null (accept)
    expect(step.detail).toEqual(ledger);
  });

  it('startedAt/endedAt equal the min/max `at` across the raw fixture events (a new derivation, not a fold edit)', () => {
    const built = buildReviewLedgerEvents({
      activeLenses: ['correctness', 'security'],
      lensVerdicts: { correctness: 'accept', security: 'changes' },
      rounds: 3,
    });
    // Stamp increasing timestamps onto the built events (the builder itself is clock-free, per its own docblock —
    // this test supplies the timestamps a real durable log would carry).
    const events = built.map((e, i) => ({ ...e, at: `2026-08-0${i + 1}T00:00:00.000Z` }));
    const step = reviewStepFromLedger(events);
    expect(step.startedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(step.endedAt).toBe(`2026-08-0${events.length}T00:00:00.000Z`);
  });

  it('an empty stream degrades to a pending, unrostered step — never throws', () => {
    const step = reviewStepFromLedger([]);
    expect(step.status).toBe('pending');
    expect(step.rounds).toBe(1);
    expect(step.startedAt).toBeNull();
    expect(step.endedAt).toBeNull();
  });

  it('malformed input (not an array at all) degrades to status "unknown", never throws — per the Done-when contract', () => {
    expect(() => reviewStepFromLedger('nonsense')).not.toThrow();
    expect(() => reviewStepFromLedger(null)).not.toThrow();
    expect(() => reviewStepFromLedger(undefined)).not.toThrow();
    expect(reviewStepFromLedger('nonsense').status).toBe('unknown');
    expect(reviewStepFromLedger(null).status).toBe('unknown');
    expect(reviewStepFromLedger(undefined).status).toBe('unknown');
  });

  it('a rostered-but-not-yet-verdicted panel reads as "running"', () => {
    const events = buildReviewLedgerEvents({ activeLenses: ['correctness'], rounds: 1 }); // no lensVerdicts given
    const step = reviewStepFromLedger(events);
    expect(step.status).toBe('running');
    expect(step.verdict).toBeNull();
  });
});

describe('escalationStepFromReviewDetail — maps the widened assembleReviewDetail output (#2818)', () => {
  it('a parked PR: verdict from disposition.mode, reasons + careLevel carried through, endedAt prefers humanCommentAt', () => {
    const detail = {
      escalationReason: ['gate-self (x) — human review required'],
      disposition: { mode: 'converge', autoLand: false },
      careLevel: 'high',
      advisoryCommentAt: '2026-08-01T11:00:00Z',
      humanCommentAt: '2026-08-01T12:00:00Z',
    };
    const step = escalationStepFromReviewDetail(detail);
    expect(step).toEqual({
      name: 'escalation', status: 'parked', verdict: 'converge',
      reasons: ['gate-self (x) — human review required'], careLevel: 'high', actor: 'drain',
      startedAt: null, endedAt: '2026-08-01T12:00:00Z',
    });
  });

  it('falls back to advisoryCommentAt when there is no humanCommentAt', () => {
    const step = escalationStepFromReviewDetail({
      escalationReason: ['size (500 lines)'],
      disposition: { mode: 'converge', autoLand: true },
      careLevel: 'low',
      advisoryCommentAt: '2026-08-01T11:00:00Z',
      humanCommentAt: null,
    });
    expect(step.endedAt).toBe('2026-08-01T11:00:00Z');
  });

  it('an unparked PR (no escalation reasons) degrades to status "unknown", null verdict/endedAt', () => {
    const step = escalationStepFromReviewDetail({
      escalationReason: [], disposition: null, careLevel: 'none', advisoryCommentAt: null, humanCommentAt: null,
    });
    expect(step.status).toBe('unknown');
    expect(step.verdict).toBeNull();
    expect(step.endedAt).toBeNull();
    expect(step.careLevel).toBe('none');
  });

  it('missing/malformed input never throws, degrades to status "unknown"', () => {
    expect(() => escalationStepFromReviewDetail()).not.toThrow();
    expect(() => escalationStepFromReviewDetail(null)).not.toThrow();
    expect(() => escalationStepFromReviewDetail('nonsense')).not.toThrow();
    expect(escalationStepFromReviewDetail().status).toBe('unknown');
  });
});

describe('landStepFromHistoryEntries — filters plateau-app\'s already-parsed history rows (#2818)', () => {
  const rows = [
    { at: '2026-08-01T00:00:00Z', mergedPrs: [], consideredPrs: [100, 101], parked: [{ num: 101, reasons: ['size (500 lines)'] }] },
    { at: '2026-08-02T00:00:00Z', mergedPrs: [], consideredPrs: [101], parked: [{ num: 101, reasons: ['size (500 lines)', 'blast-radius (x)'] }] },
    { at: '2026-08-03T00:00:00Z', mergedPrs: [101], consideredPrs: [101], parked: [] },
    { at: '2026-08-04T00:00:00Z', mergedPrs: [102], consideredPrs: [102, 103], parked: [] },
  ];

  it('a landed PR reads "landed", spanning every row that references it', () => {
    const step = landStepFromHistoryEntries(rows, { pr: 101 });
    expect(step.status).toBe('landed');
    expect(step.startedAt).toBe('2026-08-01T00:00:00Z');
    expect(step.endedAt).toBe('2026-08-03T00:00:00Z');
    expect(step.actor).toBe('drain-daemon');
  });

  it('a still-parked (never merged) PR reads "parked", reasons from the LATEST matching parked entry', () => {
    const step = landStepFromHistoryEntries(rows, { pr: 101 }); // still true even though it later lands — reasons come from row order
    // Use a PR that never lands to isolate the parked-only path.
    const parkedOnlyRows = rows.slice(0, 2);
    const parkedStep = landStepFromHistoryEntries(parkedOnlyRows, { pr: 101 });
    expect(parkedStep.status).toBe('parked');
    expect(parkedStep.reasons).toEqual(['size (500 lines)', 'blast-radius (x)']);
    expect(step.status).toBe('landed'); // sanity: the full row set still resolves to landed (merge wins)
  });

  it('considered but never merged or parked reads "unknown"', () => {
    const step = landStepFromHistoryEntries(rows, { pr: 103 });
    expect(step.status).toBe('unknown');
    expect(step.reasons).toEqual([]);
  });

  it('a PR referenced by no row reads "unknown", never throws', () => {
    expect(() => landStepFromHistoryEntries(rows, { pr: 999 })).not.toThrow();
    expect(landStepFromHistoryEntries(rows, { pr: 999 }).status).toBe('unknown');
  });

  it('missing/malformed pr or entries never throws, degrades to "unknown"', () => {
    expect(() => landStepFromHistoryEntries(rows, {})).not.toThrow();
    expect(() => landStepFromHistoryEntries(null, { pr: 101 })).not.toThrow();
    expect(() => landStepFromHistoryEntries('nonsense', { pr: 101 })).not.toThrow();
    expect(landStepFromHistoryEntries(rows, {}).status).toBe('unknown');
    expect(landStepFromHistoryEntries(null, { pr: 101 }).status).toBe('unknown');
  });
});
