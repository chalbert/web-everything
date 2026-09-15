import { afterEach, describe, it, expect, vi } from 'vitest';
import { logDelegationTrial, main } from '../log-delegation-trial.mjs';
import { readStore } from '../run-scorecard-store.mjs';

const baseRow = () => ({
  provider: 'codex', model: 'gpt-6-astra', taskDescription: 'Fix a launch wrapper',
  taskType: 'bugfix', outcome: 'landed', verifiedBy: 'claude-subagent',
});

function memIo(initial = { version: 1, records: [] }) {
  let store = initial;
  return {
    read: () => JSON.stringify(store),
    write: (_p, s) => { store = JSON.parse(s); },
    exists: () => true,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('logDelegationTrial', () => {
  it('appends an unscored trial without replacing existing history', () => {
    const io = memIo({ version: 1, records: [{ existing: true }] });
    const input = {
      ...baseRow(), item: 3690, pr: 2223, findings: 'Review caught a quoting bug',
      outcome: 'reworked', verifiedBy: 'independent-claude', retroactive: true,
      scoredAt: '2026-09-15T01:00:00.000Z',
    };
    const stored = logDelegationTrial(input, io);
    expect(stored).toEqual({
      ...input, v: 1, subjectClass: 'work-agent', dispatchKind: 'session-delegation',
      rubricVersion: 'session-delegation.1', criteriaEvaluated: 0, score: null,
      deductions: [], handle: null,
    });
    expect(readStore(io).records).toEqual([{ existing: true }, stored]);
  });

  it('defaults findings/item/pr to null and retroactive to false, and stamps time', () => {
    const stored = logDelegationTrial(baseRow(), memIo());
    expect(stored.findings).toBeNull();
    expect(stored.item).toBeNull();
    expect(stored.pr).toBeNull();
    expect(stored.retroactive).toBe(false);
    expect(new Date(stored.scoredAt).toISOString()).toBe(stored.scoredAt);
  });

  it.each(['taskType', 'outcome', 'verifiedBy'])('rejects an invalid %s before writing', (field) => {
    const io = memIo();
    expect(() => logDelegationTrial({ ...baseRow(), [field]: 'invalid' }, io)).toThrow(field);
    expect(readStore(io).records).toEqual([]);
  });

  it.each(['provider', 'model', 'taskDescription'])('requires non-empty %s without coercion', (field) => {
    for (const value of [undefined, null, '', '  ', 123]) {
      const io = memIo();
      expect(() => logDelegationTrial({ ...baseRow(), [field]: value }, io)).toThrow(field);
      expect(readStore(io).records).toEqual([]);
    }
  });

  it.each(['item', 'pr'])('rejects invalid optional %s without coercion', (field) => {
    for (const value of [0, -1, 1.5, '2223', NaN, Infinity, false]) {
      expect(() => logDelegationTrial({ ...baseRow(), [field]: value }, memIo())).toThrow(field);
    }
  });

  it('rejects empty or non-string findings and non-boolean retroactive', () => {
    for (const findings of ['', '  ', 123, false]) {
      expect(() => logDelegationTrial({ ...baseRow(), findings }, memIo())).toThrow('findings');
    }
    for (const retroactive of [null, 'true', 0]) {
      expect(() => logDelegationTrial({ ...baseRow(), retroactive }, memIo())).toThrow('retroactive');
    }
  });

  it('accepts arbitrary provider/model identities and explicit null optional fields', () => {
    const input = { ...baseRow(), provider: 'future-provider', model: 'future-model', findings: null, item: null, pr: null };
    expect(logDelegationTrial(input, memIo())).toMatchObject(input);
  });

  it('rejects a missing or non-object row clearly', () => {
    for (const row of [undefined, null, 'trial', []]) {
      expect(() => logDelegationTrial(row, memIo())).toThrow('row must be an object');
    }
  });

  it('returns null on write failure, but still throws for invalid input', () => {
    const io = { ...memIo(), write: () => { throw new Error('disk full'); } };
    expect(logDelegationTrial(baseRow(), io)).toBeNull();
    expect(() => logDelegationTrial({ ...baseRow(), outcome: 'invalid' }, io)).toThrow('outcome');
  });
});

describe('log-delegation-trial CLI', () => {
  const args = ['--provider=codex', '--model=gpt-6-astra', '--task=Fix name=a b',
    '--task-type=bugfix', '--outcome=landed', '--verified-by=claude-subagent'];

  it('parses all flags and prints the stored JSON', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const io = memIo();
    expect(main([...args, '--findings=Fixed quoting', '--item=3690', '--pr=2223',
      '--scored-at=2026-09-15T01:00:00.000Z', '--retroactive'], io)).toBe(0);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual(readStore(io).records[0]);
    expect(readStore(io).records[0]).toMatchObject({
      taskDescription: 'Fix name=a b', item: 3690, pr: 2223, retroactive: true,
      findings: 'Fixed quoting', scoredAt: '2026-09-15T01:00:00.000Z',
    });
  });

  it('prints help without writing', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const io = memIo();
    expect(main(['--help'], io)).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    expect(readStore(io).records).toEqual([]);
  });

  it('reports invalid flags, invalid input, and failed writes with non-zero exits', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const extra of ['--pr=2oops', '--item=', '--pr=1.5', '--unknown=x', '--retroactive=false']) {
      const io = memIo();
      expect(main([...args, extra], io)).toBe(1);
      expect(readStore(io).records).toEqual([]);
    }
    expect(main([], memIo())).toBe(1);
    expect(main(args, { ...memIo(), write: () => { throw new Error('disk full'); } })).toBe(1);
    expect(error).toHaveBeenLastCalledWith(expect.stringContaining('could not write trial'));
  });
});
