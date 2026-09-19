import { describe, it, expect } from 'vitest';
import { buildDelegationMarker, parseDelegationMarker, DELEGATION_TASK_TYPES } from '../delegation-marker.mjs';
import { TASK_TYPES } from '../../conveyor/log-delegation-trial.mjs';

const triple = { provider: 'codex', model: 'gpt-6-astra', taskType: 'bugfix' };
describe('delegation PR-body marker', () => {
  it('rejects an unclosed marker with 8000 spaces in under 100ms', () => {
    const body = `<!-- delegation:${' '.repeat(8000)}`;
    const start = performance.now();
    const result = parseDelegationMarker(body);
    const elapsed = performance.now() - start;
    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(100);
  });
  it('single-sources the enum and round-trips every task type', () => {
    expect(DELEGATION_TASK_TYPES).toBe(TASK_TYPES);
    for (const taskType of TASK_TYPES) {
      const row = { ...triple, taskType };
      expect(parseDelegationMarker(buildDelegationMarker(row))).toEqual(row);
    }
    expect(buildDelegationMarker(triple)).toBe('<!-- delegation: provider=codex model=gpt-6-astra taskType=bugfix -->');
  });
  it('keeps scanning after empty, oversized, or nonmatching occurrences', () => {
    const marker = buildDelegationMarker(triple);
    for (const skipped of ['<!-- delegation:-->', `<!-- delegation:${'x'.repeat(301)}-->`, '<!-- delegation: bad> -->']) {
      expect(parseDelegationMarker(`${marker}\n${skipped}\n${marker}`)).toEqual(triple);
    }
    expect(parseDelegationMarker(`<!-- delegation:${'x'.repeat(301)}${marker}`)).toEqual(triple);
    expect(parseDelegationMarker(`${marker}\n<!-- delegation:unclosed`)).toEqual(triple);
  });
  it('preserves whitespace padding and the 300-character content boundary', () => {
    const row = { ...triple, model: 'm'.repeat(263) };
    const marker = buildDelegationMarker(row);
    expect(`provider=${row.provider} model=${row.model} taskType=${row.taskType}`).toHaveLength(300);
    expect(parseDelegationMarker(marker.replace('delegation: ', 'delegation:\t\n').replace(' -->', '\t\n -->'))).toEqual(row);
    expect(parseDelegationMarker(`${buildDelegationMarker(triple)}\n<!-- delegation: \t -->`)).toBeNull();
  });
  it('rejects invalid task types and missing fields without throwing', () => {
    expect(buildDelegationMarker({ ...triple, taskType: 'invalid' })).toBe('');
    expect(buildDelegationMarker()).toBe('');
    for (const payload of ['provider=codex model=gpt-6-astra taskType=invalid', 'provider=codex taskType=bugfix', '']) {
      expect(parseDelegationMarker(`<!-- delegation: ${payload} -->`)).toBeNull();
    }
  });
  it('rejects invalid tokens and unreadably long payloads', () => {
    for (const field of ['provider', 'model']) {
      for (const value of ['', ' ', 'two words', 'codex\n', '<bad', 'bad>', null, 1, 'x'.repeat(301)]) {
        expect(buildDelegationMarker({ ...triple, [field]: value })).toBe('');
      }
    }
    expect(parseDelegationMarker('<!-- delegation: provider=<bad model=m taskType=bugfix -->')).toBeNull();
  });
  it('returns null when absent and ignores unrelated comment kinds', () => {
    for (const body of ['', null, undefined, 1, 'No stamp. <!-- authored-by-actor: author -->']) {
      expect(parseDelegationMarker(body)).toBeNull();
    }
    expect(parseDelegationMarker(`Summary\n<!-- authored-by-actor: author -->\n${buildDelegationMarker(triple)}\n<!-- other: note -->`)).toEqual(triple);
  });
  it('requires agreement between stamps, while repeated identical stamps resolve', () => {
    const marker = buildDelegationMarker(triple);
    expect(parseDelegationMarker(`${marker}\n${marker}`)).toEqual(triple);
    for (const field of ['provider', 'model', 'taskType']) {
      const other = buildDelegationMarker({ ...triple, [field]: 'other' });
      expect(parseDelegationMarker(`${marker}\n${other}`)).toBeNull();
      expect(parseDelegationMarker(`${other}\n${marker}`)).toBeNull();
    }
  });
  it('does not resolve partial, duplicate-field, or substring field names', () => {
    for (const payload of ['provider=codex provider=gemini model=m taskType=bugfix', 'notprovider=codex model=m taskType=bugfix']) {
      expect(parseDelegationMarker(`<!-- delegation: ${payload} -->`)).toBeNull();
    }
    expect(parseDelegationMarker(`${buildDelegationMarker(triple)}\n<!-- delegation: provider=codex -->`)).toBeNull();
  });
});
