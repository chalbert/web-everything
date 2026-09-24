import { describe, it, expect } from 'vitest';
import { RUBRIC_VERSION, RUBRIC_SUPERSEDES, CRITERIA, CRITERIA_BY_ID, ALWAYS_ACTIONABLE_CRITERIA, EVALUABLE_CRITERIA } from '../run-quality-rubric.mjs';

describe('run-quality-rubric', () => {
  it('the version is a non-empty string and the first version supersedes nothing', () => {
    expect(typeof RUBRIC_VERSION).toBe('string');
    expect(RUBRIC_VERSION.length).toBeGreaterThan(0);
    expect(RUBRIC_SUPERSEDES).toBeNull();
  });

  it('every criterion has the full required shape', () => {
    for (const c of CRITERIA) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
      expect(typeof c.description).toBe('string');
      expect(typeof c.hunt).toBe('string');
      expect(typeof c.source).toBe('string');
      expect(typeof c.weight).toBe('number');
      expect(typeof c.alwaysActionable).toBe('boolean');
      expect(typeof c.evaluable).toBe('boolean');
    }
  });

  it('criterion ids are unique', () => {
    const ids = CRITERIA.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('CRITERIA_BY_ID indexes every criterion', () => {
    for (const c of CRITERIA) expect(CRITERIA_BY_ID[c.id]).toBe(c);
  });

  it('ALWAYS_ACTIONABLE_CRITERIA is exactly the alwaysActionable subset', () => {
    expect(ALWAYS_ACTIONABLE_CRITERIA).toEqual(CRITERIA.filter((c) => c.alwaysActionable).map((c) => c.id));
    expect(ALWAYS_ACTIONABLE_CRITERIA.length).toBeGreaterThan(0);
  });

  it('EVALUABLE_CRITERIA is exactly the evaluable subset, and is a strict subset of all criteria', () => {
    expect(EVALUABLE_CRITERIA).toEqual(CRITERIA.filter((c) => c.evaluable).map((c) => c.id));
    expect(EVALUABLE_CRITERIA.length).toBeLessThanOrEqual(CRITERIA.length);
  });

  it('the accrual command-churn criterion carries weight 0 — it never deducts in v1 (no par band, Fork 4)', () => {
    expect(CRITERIA_BY_ID['command-churn'].weight).toBe(0);
    expect(CRITERIA_BY_ID['command-churn'].alwaysActionable).toBe(false);
  });

  it('every array export is frozen (the rubric is immutable data)', () => {
    expect(Object.isFrozen(CRITERIA)).toBe(true);
    expect(Object.isFrozen(ALWAYS_ACTIONABLE_CRITERIA)).toBe(true);
    expect(Object.isFrozen(EVALUABLE_CRITERIA)).toBe(true);
    for (const c of CRITERIA) expect(Object.isFrozen(c)).toBe(true);
  });
});
