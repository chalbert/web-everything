/**
 * @file review-seat-caps.test.mjs — card xn2wf9t (#3383 follow-up): the declared `review-seat-caps` operation
 * (a `heavy-queue`-style one-liner naming each non-Claude review seat provider's OWN daily cap usage).
 */
import { describe, it, expect } from 'vitest';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning, runStatus } from '../engine.mjs';
import { reviewSeatCapsOperation, REVIEW_SEAT_CAPS_OP, assessReviewSeatCaps } from '../review-seat-caps.mjs';
import { OPERATIONS } from '../run.mjs';

function runReviewSeatCaps(usage) {
  const declaration = reviewSeatCapsOperation({ collect: () => usage });
  const registry = createRegistry();
  registry.register(declaration);
  const run = advanceWhileRunning(startRun({ op: REVIEW_SEAT_CAPS_OP, id: 'run-seatcaps-test', input: {}, registry }), { registry });
  return { run, status: runStatus(run, { registry }) };
}

describe('the operation is REGISTERED — it shipped callable by nothing', () => {
  it('run.mjs can resolve it', () => {
    expect(Object.keys(OPERATIONS)).toContain(REVIEW_SEAT_CAPS_OP);
    expect(typeof OPERATIONS[REVIEW_SEAT_CAPS_OP]).toBe('function');
  });
});

describe('assessReviewSeatCaps — pure', () => {
  it('names every provider\'s usedToday/cap and rounds a percent', () => {
    const out = assessReviewSeatCaps({
      codex: { usedToday: 20, cap: 80, fraction: 0.25 },
      'agy-claude': { usedToday: 0, cap: 300, fraction: 0 },
      'agy-gemini': { usedToday: 150, cap: 300, fraction: 0.5 },
    });
    expect(out.rows).toEqual([
      { provider: 'codex', usedToday: 20, cap: 80, percent: 25 },
      { provider: 'agy-claude', usedToday: 0, cap: 300, percent: 0 },
      { provider: 'agy-gemini', usedToday: 150, cap: 300, percent: 50 },
    ]);
    expect(out.headline).toBe('review seat calls used today: codex 20/80 (25%), agy-claude 0/300 (0%), agy-gemini 150/300 (50%)');
  });

  it('an empty snapshot never throws, just says so', () => {
    expect(assessReviewSeatCaps({}).headline).toBe('review seat calls used today: no review-seat providers configured');
  });

  it('refuses a non-object snapshot rather than silently reporting nothing', () => {
    expect(() => assessReviewSeatCaps(null)).toThrow(/unreadable/);
    expect(() => assessReviewSeatCaps(undefined)).toThrow(/unreadable/);
  });
});

describe('reviewSeatCapsOperation — through the real engine', () => {
  it('refuses a collect that is not a function', () => {
    expect(() => reviewSeatCapsOperation({})).toThrow(/collect reader/);
  });

  it('runs read → assess and the verdict IS the assessment (no sinks — read-only)', () => {
    const usage = { codex: { usedToday: 68, cap: 80, fraction: 0.85 } };
    const { run, status } = runReviewSeatCaps(usage);
    expect(status).toBe('complete');
    expect(run.findings.assess.headline).toMatch(/codex 68\/80 \(85%\)/);
    expect(run.verdict).toEqual(run.findings.assess);
    expect(run.effects ?? []).toEqual([]);
  });
});
