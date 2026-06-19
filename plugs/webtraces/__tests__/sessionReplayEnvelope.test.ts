/**
 * Tests for the webtraces session-replay envelope contract + validator (#1155, #992 build).
 *
 * Covers the two #992-amendment invariants the structural validator enforces (the seam a replayer relies
 * on): the snapshot↔journal consistency precondition (drift refusal) and the off-journal boundary, plus
 * the timeline-ordering shape checks. Also asserts the shipped conformance suite is well-formed.
 */
import { describe, it, expect } from 'vitest';
import {
  assertSessionReplayEnvelope,
  SessionReplayEnvelopeError,
  type SessionReplayEnvelope,
} from '../sessionReplayEnvelope';
import { assertConformanceSuite } from '../../../conformance-vectors/schema';
import { sessionReplayEnvelopeSuite } from '../../../conformance-vectors/session-replay-envelope.vectors';

function makeEnvelope(overrides: Partial<SessionReplayEnvelope> = {}): SessionReplayEnvelope {
  return {
    sessionId: 's1',
    envelopeVersion: 1,
    mode: 'journaled-state',
    snapshot: { snapshotId: 'snap-A', version: 7 },
    journal: { journalId: 'jour-A', appliesOntoVersion: 7, recordCount: 3 },
    appliesOntoVersion: 7,
    timeline: [
      { spanId: 'span-0', seq: 0 },
      { spanId: 'span-1', seq: 1, action: { eventType: 'ClickEvent', traceparent: '00-aaa-bbb-01' } },
    ],
    offJournalBoundary: { note: 'focus/scroll out of scope', excludes: ['dom-focus', 'scroll'], escapeHatch: 'behavioral-replay' },
    ...overrides,
  };
}

describe('session-replay envelope contract (#1155 / #992)', () => {
  it('accepts a consistent, well-formed envelope', () => {
    expect(() => assertSessionReplayEnvelope(makeEnvelope())).not.toThrow();
  });

  it('§1 refuses snapshot↔journal drift (journal applies onto a different version)', () => {
    const drifted = makeEnvelope({
      snapshot: { snapshotId: 'snap-A', version: 7 },
      journal: { journalId: 'jour-A', appliesOntoVersion: 9, recordCount: 3 },
      appliesOntoVersion: 7,
    });
    expect(() => assertSessionReplayEnvelope(drifted)).toThrow(/drift/);
  });

  it('§1 refuses an envelope appliesOntoVersion that disagrees with the snapshot', () => {
    const drifted = makeEnvelope({ appliesOntoVersion: 8 });
    expect(() => assertSessionReplayEnvelope(drifted)).toThrow(SessionReplayEnvelopeError);
  });

  it('§2 requires the off-journal boundary with the behavioral escape hatch', () => {
    const noBoundary = makeEnvelope({ offJournalBoundary: undefined as any });
    expect(() => assertSessionReplayEnvelope(noBoundary)).toThrow(/offJournalBoundary/);

    const wrongHatch = makeEnvelope({
      offJournalBoundary: { note: 'x', excludes: [], escapeHatch: 'something-else' as any },
    });
    expect(() => assertSessionReplayEnvelope(wrongHatch)).toThrow(/behavioral-replay/);
  });

  it('rejects an out-of-order or duplicated timeline seq', () => {
    const outOfOrder = makeEnvelope({
      timeline: [
        { spanId: 'a', seq: 2 },
        { spanId: 'b', seq: 1 },
      ],
    });
    expect(() => assertSessionReplayEnvelope(outOfOrder)).toThrow(/ascending/);

    const dup = makeEnvelope({
      timeline: [
        { spanId: 'a', seq: 1 },
        { spanId: 'b', seq: 1 },
      ],
    });
    expect(() => assertSessionReplayEnvelope(dup)).toThrow(/duplicate/);
  });

  it('rejects an unknown replay mode', () => {
    expect(() => assertSessionReplayEnvelope(makeEnvelope({ mode: 'time-travel' as any }))).toThrow(/mode/);
  });

  it('accepts the behavioral escape-hatch mode', () => {
    expect(() => assertSessionReplayEnvelope(makeEnvelope({ mode: 'behavioral' }))).not.toThrow();
  });
});

describe('session-replay-envelope conformance suite (#1155)', () => {
  it('is a well-formed conformance vector suite', () => {
    expect(() => assertConformanceSuite(sessionReplayEnvelopeSuite)).not.toThrow();
  });

  it('ships the drift-refusal and off-journal-boundary vectors (the #992 amendment invariants)', () => {
    const ids = sessionReplayEnvelopeSuite.vectors.map((v) => v.id);
    expect(ids).toContain('session-replay-envelope/precondition/drift-refused');
    expect(ids).toContain('session-replay-envelope/boundary/off-journal-disclosed');
    const drift = sessionReplayEnvelopeSuite.vectors.find((v) => v.id.endsWith('drift-refused'))!;
    expect(drift.expect.neverObserved).toEqual([{ replayOutcome: 'applied' }]);
  });
});
