import { describe, it, expect } from 'vitest';
import { readFindings, writeFindings, isUnresolvedDuplicate, fileRunQualityFinding } from '../run-quality-sink.mjs';

function memIo(initial = { version: 1, findings: [] }) {
  let store = initial;
  return {
    read: () => JSON.stringify(store),
    write: (_p, s) => { store = JSON.parse(s); },
    exists: () => true,
  };
}

describe('readFindings/writeFindings', () => {
  it('degrades to empty on a missing/malformed file', () => {
    expect(readFindings({ exists: () => false }).findings).toEqual([]);
    expect(readFindings({ exists: () => true, read: () => 'garbage' }).findings).toEqual([]);
  });
  it('round-trips', () => {
    const io = memIo();
    writeFindings({ version: 1, findings: [{ id: '1' }] }, io);
    expect(readFindings(io).findings).toHaveLength(1);
  });
});

describe('fileRunQualityFinding', () => {
  it('requires a dedupKey', () => {
    expect(() => fileRunQualityFinding({ summary: 'x' }, {}, memIo())).toThrow(/dedupKey/);
  });

  it('stores a well-formed finding, defaulting approvalPending true', () => {
    const io = memIo();
    const stored = fileRunQualityFinding({ summary: 's', area: 'a', dedupKey: '3388:redundant-command' }, { session: 'h1' }, io);
    expect(stored.approvalPending).toBe(true);
    expect(stored.blocking).toBe(false);
    expect(stored.session).toBe('h1');
    expect(readFindings(io).findings).toHaveLength(1);
  });

  it('dedups on (item:criterion), NEVER on summary text — two different summaries with the same dedupKey collide', () => {
    const io = memIo();
    fileRunQualityFinding({ summary: 'first wording', dedupKey: '3388:abandoned-failing-test' }, {}, io);
    const second = fileRunQualityFinding({ summary: 'completely different wording', dedupKey: '3388:abandoned-failing-test' }, {}, io);
    expect(second).toBeNull();
    expect(readFindings(io).findings).toHaveLength(1);
  });

  it('a RESOLVED prior finding does not block a new one with the same dedupKey', () => {
    const io = memIo({ version: 1, findings: [{ id: '1', dedupKey: '3388:x', approvalPending: true, resolvedAt: '2026-01-01T00:00:00Z' }] });
    expect(isUnresolvedDuplicate(readFindings(io), '3388:x')).toBe(false);
    const stored = fileRunQualityFinding({ summary: 's', dedupKey: '3388:x' }, {}, io);
    expect(stored).not.toBeNull();
  });

  it('a different dedupKey never collides', () => {
    const io = memIo();
    fileRunQualityFinding({ summary: 's', dedupKey: '3388:a' }, {}, io);
    const other = fileRunQualityFinding({ summary: 's', dedupKey: '3388:b' }, {}, io);
    expect(other).not.toBeNull();
    expect(readFindings(io).findings).toHaveLength(2);
  });
});
