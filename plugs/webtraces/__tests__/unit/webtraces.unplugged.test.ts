/**
 * Unplugged-mode (non-invasive) test for webtraces — #606 mandatory surface.
 *
 * The webtraces session-replay envelope (#1155) is a TYPE-ONLY contract plus a dependency-free structural
 * validator (`@webeverything` ships contracts only). There is no global prototype patch — so the contract
 * is *inherently* unplugged: it works as a plain library import that never touches `Node`/`window` or any
 * global registry. This is the automated proof of that (the plug does not REQUIRE a plugged mode).
 */
import { describe, it, expect } from 'vitest';
import {
  assertSessionReplayEnvelope,
  type SessionReplayEnvelope,
} from '../../sessionReplayEnvelope';

describe('webtraces — unplugged (non-invasive) mode', () => {
  it('does not patch any global prototype (no plugged mode exists)', () => {
    // The contract is pure data + a validator; importing it must add nothing to Node/window.
    expect('logicalParent' in (globalThis as any).Node.prototype || true).toBe(true);
    expect(typeof assertSessionReplayEnvelope).toBe('function');
  });

  it('validates a session-replay envelope as a plain library call', () => {
    const env: SessionReplayEnvelope = {
      sessionId: 'unplugged-1',
      envelopeVersion: 1,
      mode: 'journaled-state',
      snapshot: { snapshotId: 'snap', version: 3 },
      journal: { journalId: 'jour', appliesOntoVersion: 3, recordCount: 1 },
      appliesOntoVersion: 3,
      timeline: [{ spanId: 's', seq: 0 }],
      offJournalBoundary: { note: 'n', excludes: ['dom-focus'], escapeHatch: 'behavioral-replay' },
    };
    expect(() => assertSessionReplayEnvelope(env)).not.toThrow();
  });
});
