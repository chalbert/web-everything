/**
 * @file scripts/conveyor/__tests__/hiccup-classify.test.mjs
 * @description Unit proof of the #3421 hiccup classifier — pure, no I/O. Pins the two named regression
 *   fixtures from #3422's own discussion: the #3416 guard-suppression case (a live dispatch guard held a
 *   launch) and the #3412 free-form-question case (a dispatched agent returned prose instead of a
 *   predefined structured response) — plus the #3421 addendum's confidence/blacklist axis for a
 *   missing-operation finding: clean-self-clears, flagged-criterion-batches, blacklisted-call-escalates.
 */
import { describe, it, expect } from 'vitest';
import {
  isStructuredReturn, classifySuppressedBuilds, classifyAgentReturn,
  assessMissingOperationConfidence, isBlacklistedOperation, CONFIDENCE_CRITERIA, DEFAULT_OPERATION_BLACKLIST,
} from '../hiccup-classify.mjs';

describe('classifySuppressedBuilds — #3416 guard-suppression fixture', () => {
  it('classifies a tick-core suppressedBuilds entry as a blocking guard-suppression hiccup', () => {
    const hiccups = classifySuppressedBuilds([{ num: 3416, lane: 5, by: 'num' }]);
    expect(hiccups).toHaveLength(1);
    expect(hiccups[0]).toMatchObject({ kind: 'guard-suppression', blocking: true, num: 3416, lane: 5, by: 'num' });
    expect(hiccups[0].proposedFix).toContain('3416');
  });

  it('one record per suppressed entry, and an empty/absent list classifies to nothing', () => {
    expect(classifySuppressedBuilds([{ num: 1, lane: 2, by: 'lane' }, { num: 3, lane: 4, by: 'num' }])).toHaveLength(2);
    expect(classifySuppressedBuilds([])).toEqual([]);
    expect(classifySuppressedBuilds(undefined)).toEqual([]);
    expect(classifySuppressedBuilds(null)).toEqual([]);
  });

  it('drops a malformed entry with no num rather than throwing', () => {
    expect(classifySuppressedBuilds([{ lane: 5, by: 'lane' }])).toEqual([]);
  });
});

describe('classifyAgentReturn — #3412 free-form-question fixture', () => {
  it('classifies an unstructured free-form return as a blocking hiccup', () => {
    const h = classifyAgentReturn({ num: 3412, text: 'What would you like me to do here?' });
    expect(h).toMatchObject({ kind: 'free-form-response', blocking: true, num: 3412 });
    expect(h.proposedFix).toContain('3412');
  });

  it('a recognized structured one-line return classifies to null (not a hiccup)', () => {
    expect(classifyAgentReturn({ num: 10, text: '#10 → PR #42 (ready-to-merge)' })).toBeNull();
    expect(classifyAgentReturn({ num: 10, text: '#10 → not-ready (stale/superseded)' })).toBeNull();
    expect(classifyAgentReturn({ num: 10, text: '#10 → blocked-on-infra (github outage)' })).toBeNull();
    expect(classifyAgentReturn({ num: 10, text: '#10 → escalated review:human' })).toBeNull();
    expect(classifyAgentReturn({ num: 10, text: '#10 → gate-red' })).toBeNull();
  });

  it('empty/absent text is nothing to classify yet, not a hiccup', () => {
    expect(classifyAgentReturn({ num: 10, text: '' })).toBeNull();
    expect(classifyAgentReturn({ num: 10 })).toBeNull();
    expect(classifyAgentReturn(undefined)).toBeNull();
  });

  it('isStructuredReturn matches case-insensitively and rejects plain prose', () => {
    expect(isStructuredReturn('#3 → pr #7 (ready-to-merge)')).toBe(true);
    expect(isStructuredReturn('I think this PR looks fine to me')).toBe(false);
  });
});

describe('assessMissingOperationConfidence — #3421 addendum axis', () => {
  const cleanCriteria = Object.fromEntries(CONFIDENCE_CRITERIA.map((k) => [k, false]));

  it('clean-self-clears: no flagged criterion, no blacklist hit', () => {
    const r = assessMissingOperationConfidence({ call: 'node scripts/backlog.mjs claim 42', criteria: cleanCriteria });
    expect(r).toEqual({ selfClears: true, batched: false, escalate: false, reason: 'clean' });
  });

  it('flagged-criterion-batches: any flagged named criterion joins the batch, not a self-clear', () => {
    const r = assessMissingOperationConfidence({ call: 'read a config file', criteria: { ...cleanCriteria, securityRisk: true } });
    expect(r).toEqual({ selfClears: false, batched: true, escalate: false, reason: 'flagged-criterion:securityRisk' });
  });

  it('blacklisted-call-escalates: a blacklisted call always escalates, independent of a clean criteria map', () => {
    const r = assessMissingOperationConfidence({ call: 'git push --force origin main', criteria: cleanCriteria });
    expect(r).toEqual({ selfClears: false, batched: false, escalate: true, reason: 'blacklisted-call' });
  });

  it('blacklist wins even over a flagged criterion (checked first, independently)', () => {
    const r = assessMissingOperationConfidence({ call: 'sudo rm -rf /', criteria: { ...cleanCriteria, dataLeakRisk: true } });
    expect(r.escalate).toBe(true);
    expect(r.reason).toBe('blacklisted-call');
  });

  it('a custom blacklist overrides the default', () => {
    expect(isBlacklistedOperation('deploy to prod', ['deploy'])).toBe(true);
    expect(isBlacklistedOperation('deploy to prod', DEFAULT_OPERATION_BLACKLIST)).toBe(false);
  });

  it('default export list is non-empty and case-insensitive', () => {
    expect(DEFAULT_OPERATION_BLACKLIST.length).toBeGreaterThan(0);
    expect(isBlacklistedOperation('GIT PUSH --FORCE origin main')).toBe(true);
  });

  it('an absent criteria map is treated as clean (no throw)', () => {
    expect(assessMissingOperationConfidence({ call: 'ls' })).toEqual({ selfClears: true, batched: false, escalate: false, reason: 'clean' });
  });
});
