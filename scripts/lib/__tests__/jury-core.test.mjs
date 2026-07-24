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
