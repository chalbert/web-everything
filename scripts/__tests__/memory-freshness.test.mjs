/**
 * @file scripts/__tests__/memory-freshness.test.mjs
 * @description Pins the agent-memory freshness audit (#2087): the pure rules that flag a leaf citing a
 * dead backlog number, an unsettled decision, or an orphaned statute anchor. Fixture-tested so the rules
 * don't depend on the live memory/backlog tree, plus one smoke over the real corpus for the shapes.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  isLeaf, auditMemoryFreshness, runMemoryFreshnessCheck,
} = require('../lib/memory-freshness.cjs');

describe('isLeaf — audits leaf topic files, not the aggregators', () => {
  it('accepts a plain leaf', () => expect(isLeaf('merit-forks-not-prioritization.md')).toBe(true));
  it('accepts a numbered leaf', () => expect(isLeaf('105-feedback_claim_ignores_git_state.md')).toBe(true));
  it('rejects the always-loaded map', () => expect(isLeaf('MEMORY.md')).toBe(false));
  it('rejects a category sub-index', () => expect(isLeaf('index-dec.md')).toBe(false));
  it('rejects non-markdown', () => expect(isLeaf('notes.txt')).toBe(false));
});

describe('auditMemoryFreshness — the three freshness signals', () => {
  const anchorIndex = { 'docs/agent/platform-decisions.md': new Set(['native-first', 'plug-is-proposed']) };

  it('flags a dangling backlog cite (no such item)', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [{ file: 'a.md', num: '9999' }], docCites: [] },
      {}, anchorIndex,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].descriptor.signal).toBe('dangling-cite');
    expect(warnings[0].message).toMatch(/no backlog item/);
  });

  it('flags a cite to a still-unsettled decision (open / preparing / active / parked)', () => {
    for (const status of ['open', 'preparing', 'active', 'parked']) {
      const { warnings } = auditMemoryFreshness(
        { backlogCites: [{ file: 'a.md', num: '100' }], docCites: [] },
        { 100: { kind: 'decision', status } }, anchorIndex,
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0].descriptor.signal).toBe('unsettled-decision');
      expect(warnings[0].descriptor.status).toBe(status);
    }
  });

  it('does NOT flag a cite to a resolved decision (the common born-from-ruling case)', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [{ file: 'a.md', num: '100' }], docCites: [] },
      { 100: { kind: 'decision', status: 'resolved' } }, anchorIndex,
    );
    expect(warnings).toHaveLength(0);
  });

  it('does NOT flag a cite to an unresolved NON-decision (story/epic/task in flight is normal)', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [{ file: 'a.md', num: '100' }], docCites: [] },
      { 100: { kind: 'story', status: 'open' } }, anchorIndex,
    );
    expect(warnings).toHaveLength(0);
  });

  it('flags an orphaned statute anchor cite', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [], docCites: [{ file: 'a.md', doc: 'platform-decisions.md', anchor: 'renamed-away' }] },
      {}, anchorIndex,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].descriptor.signal).toBe('orphaned-anchor');
  });

  it('does NOT flag a statute anchor that still resolves', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [], docCites: [{ file: 'a.md', doc: 'platform-decisions.md', anchor: 'native-first' }] },
      {}, anchorIndex,
    );
    expect(warnings).toHaveLength(0);
  });

  it('ignores a `<doc>.md#anchor` for a doc outside the governance anchor index (informal reference)', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [], docCites: [{ file: 'a.md', doc: 'backlog-workflow.md', anchor: 'whatever' }] },
      {}, anchorIndex,
    );
    expect(warnings).toHaveLength(0);
  });

  it('de-duplicates a leaf citing the same open decision twice', () => {
    const { warnings } = auditMemoryFreshness(
      { backlogCites: [{ file: 'a.md', num: '100' }, { file: 'a.md', num: '100' }], docCites: [] },
      { 100: { kind: 'decision', status: 'open' } }, anchorIndex,
    );
    expect(warnings).toHaveLength(1);
  });
});

describe('runMemoryFreshnessCheck — smoke over the live corpus', () => {
  it('returns the check-standards { warnings } shape with descriptors', () => {
    const { warnings } = runMemoryFreshnessCheck();
    expect(Array.isArray(warnings)).toBe(true);
    for (const w of warnings) {
      expect(typeof w.message).toBe('string');
      expect(['dangling-cite', 'unsettled-decision', 'orphaned-anchor']).toContain(w.descriptor.signal);
    }
  });
});
