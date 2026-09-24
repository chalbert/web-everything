import { describe, it, expect, vi } from 'vitest';
import { routeScorecard, RUN_QUALITY_ROUTER_ARMED } from '../run-quality-route.mjs';

describe('RUN_QUALITY_ROUTER_ARMED — Fork 7, v1 is disarmed', () => {
  it('is a literal false', () => {
    expect(RUN_QUALITY_ROUTER_ARMED).toBe(false);
  });
});

describe('routeScorecard — a deduction with NO proposedFix never routes at all', () => {
  it('files nothing and applies nothing for a recording-only deduction', () => {
    const fileFinding = vi.fn();
    const applyThroughOperation = vi.fn();
    const out = routeScorecard(
      { item: '3388', subjectClass: 'work-agent', deductions: [{ criterion: 'command-churn', weight: 0, count: 20 }] },
      { fileFinding, applyThroughOperation },
    );
    expect(out.filed).toEqual([]);
    expect(out.applied).toEqual([]);
    expect(fileFinding).not.toHaveBeenCalled();
    expect(applyThroughOperation).not.toHaveBeenCalled();
  });
});

describe('routeScorecard — Fork 5 runs FIRST: a driver-class subject is ALWAYS report-only', () => {
  it('never applies for a driver-class subject even when armed and the fix would self-clear', () => {
    const applyThroughOperation = vi.fn();
    const fileFinding = vi.fn(() => ({ id: '1' }));
    const assessRisk = () => ({ selfClears: true, batched: false, escalate: false, reason: 'clean' });
    const out = routeScorecard(
      { item: 'driver-1', subjectClass: 'driver', deductions: [{ criterion: 'x', proposedFix: { operation: 'op', input: {}, flaggedCriteria: {} } }] },
      { armed: true, applyThroughOperation, fileFinding, assessRisk },
    );
    expect(applyThroughOperation).not.toHaveBeenCalled();
    expect(out.applied).toEqual([]);
    expect(fileFinding).toHaveBeenCalledTimes(1);
    expect(out.filed).toHaveLength(1);
  });
});

describe('routeScorecard — DISARMED (v1 real state): a work-agent finding is filed, never applied', () => {
  it('files rather than applies even when the risk would self-clear', () => {
    const applyThroughOperation = vi.fn();
    const fileFinding = vi.fn(() => ({ id: '1' }));
    const assessRisk = () => ({ selfClears: true, batched: false, escalate: false, reason: 'clean' });
    const out = routeScorecard(
      { item: '3388', subjectClass: 'work-agent', deductions: [{ criterion: 'x', proposedFix: { operation: 'op', input: {}, flaggedCriteria: {} } }] },
      { armed: false, applyThroughOperation, fileFinding, assessRisk },
    );
    expect(applyThroughOperation).not.toHaveBeenCalled();
    expect(out.applied).toEqual([]);
    expect(out.filed).toHaveLength(1);
  });
});

describe('routeScorecard — ARMED + work-agent + clean risk DOES apply (proves the router is real code, not a no-op)', () => {
  it('applies through the typed operation and never through a raw command', () => {
    const applyThroughOperation = vi.fn();
    const fileFinding = vi.fn();
    const assessRisk = () => ({ selfClears: true, batched: false, escalate: false, reason: 'clean' });
    const out = routeScorecard(
      { item: '3388', subjectClass: 'work-agent', deductions: [{ criterion: 'x', proposedFix: { operation: 'some-op', input: { a: 1 }, flaggedCriteria: {} } }] },
      { armed: true, applyThroughOperation, fileFinding, assessRisk },
    );
    expect(applyThroughOperation).toHaveBeenCalledWith('some-op', { a: 1 });
    expect(out.applied).toHaveLength(1);
    expect(fileFinding).not.toHaveBeenCalled();
  });

  it('armed + work-agent + a BLACKLISTED fix still files (never applies) — blacklist wins over armed', () => {
    const applyThroughOperation = vi.fn();
    const fileFinding = vi.fn(() => ({ id: '1' }));
    const assessRisk = () => ({ selfClears: false, batched: false, escalate: true, reason: 'blacklisted-call' });
    const out = routeScorecard(
      { item: '3388', subjectClass: 'work-agent', deductions: [{ criterion: 'x', proposedFix: { command: 'rm -rf /', operation: 'op', input: {}, flaggedCriteria: {} } }] },
      { armed: true, applyThroughOperation, fileFinding, assessRisk },
    );
    expect(applyThroughOperation).not.toHaveBeenCalled();
    expect(out.filed[0]).toBeTruthy();
  });
});

describe('routeScorecard — the real assessRisk/fileFinding defaults are wired (no proposedFix in today\'s rubric, so this never fires in practice)', () => {
  it('the default applyThroughOperation throws if ever actually reached — a guard against an accidental live apply', () => {
    expect(() => routeScorecard(
      { item: '3388', subjectClass: 'work-agent', deductions: [{ criterion: 'x', proposedFix: { operation: 'op', input: {}, flaggedCriteria: {} } }] },
      { armed: true, assessRisk: () => ({ selfClears: true }) },
    )).toThrow(/no real implementation/);
  });
});
