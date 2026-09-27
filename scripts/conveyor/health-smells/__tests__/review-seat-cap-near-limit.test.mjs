/**
 * @file scripts/conveyor/health-smells/__tests__/review-seat-cap-near-limit.test.mjs
 * @description Card xn2wf9t — the PURE `evaluate()` of `review-seat-cap-near-limit`: breaches once a provider's
 *   usedToday/cap fraction reaches 80%, names the exact numbers, and — critically — is registered but NEVER in
 *   `NOTIFY_EVEN_IN_SHADOW` (record-only, never notify, per this card's own ask).
 */
import { describe, it, expect } from 'vitest';
import smell, { WARN_FRACTION } from '../review-seat-cap-near-limit.mjs';
import { SMELLS } from '../index.mjs';
import { NOTIFY_EVEN_IN_SHADOW } from '../../health-smells-notify-list.mjs';

const NOW = Date.parse('2026-09-27T15:00:00Z');

describe('review-seat-cap-near-limit', () => {
  it('is registered but stays record-only (never in the notify-even-in-shadow set)', () => {
    expect(SMELLS.map((s) => s.id)).toContain('review-seat-cap-near-limit');
    expect(NOTIFY_EVEN_IN_SHADOW.has('review-seat-cap-near-limit')).toBe(false);
  });

  it('breaches at or above 80% of a provider\'s own cap, names the provider and the exact numbers', () => {
    const reviewSeatCaps = {
      codex: { usedToday: 68, cap: 80, fraction: 0.85 },
      'agy-claude': { usedToday: 40, cap: 300, fraction: 0.133 },
      'agy-gemini': { usedToday: 0, cap: 300, fraction: 0 },
    };
    const results = smell.evaluate({ reviewSeatCaps }, { now: NOW });
    expect(results).toHaveLength(3);
    const codex = results.find((r) => r.subject === 'review-seat-cap:codex');
    expect(codex.breach).toBe(true);
    expect(codex.measure).toEqual({ provider: 'codex', usedToday: 68, cap: 80, fraction: 0.85 });
    expect(codex.summary).toMatch(/68\/80/);
    expect(codex.recommendation).toMatch(/85%/);
    for (const id of ['agy-claude', 'agy-gemini']) {
      const r = results.find((x) => x.subject === `review-seat-cap:${id}`);
      expect(r.breach).toBe(false);
      expect(r.recommendation).toBe('ok');
    }
  });

  it('exactly at the warn fraction still breaches (>=, not >)', () => {
    const results = smell.evaluate({ reviewSeatCaps: { codex: { usedToday: 240, cap: 300, fraction: WARN_FRACTION } } }, { now: NOW });
    expect(results[0].breach).toBe(true);
  });

  it('a missing/unreadable probe reading names nothing and breaches nothing', () => {
    expect(smell.evaluate({ reviewSeatCaps: undefined }, { now: NOW })).toEqual([]);
    expect(smell.evaluate({ reviewSeatCaps: {} }, { now: NOW })).toEqual([]);
  });
});
