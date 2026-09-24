import { describe, it, expect } from 'vitest';
import { classifySubject, WORK_AGENT_KINDS } from '../run-quality-subject-class.mjs';

describe('classifySubject — Fork 5, stamped at launch, never inferred', () => {
  it('a known bounded one-off kind is work-agent', () => {
    for (const kind of WORK_AGENT_KINDS) expect(classifySubject({ kind })).toBe('work-agent');
  });
  it('review and investigation ARE work-agent, even though LAUNCH_KINDS omits them (the card\'s own named gap)', () => {
    expect(classifySubject({ kind: 'review' })).toBe('work-agent');
    expect(classifySubject({ kind: 'investigation' })).toBe('work-agent');
  });
  it('an unknown/absent kind fails CLOSED to driver-class', () => {
    expect(classifySubject({ kind: 'some-driver-loop' })).toBe('driver');
    expect(classifySubject({})).toBe('driver');
    expect(classifySubject()).toBe('driver');
    expect(classifySubject({ kind: null })).toBe('driver');
  });
});
