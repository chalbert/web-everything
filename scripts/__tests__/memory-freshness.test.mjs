/**
 * @file scripts/__tests__/memory-freshness.test.mjs
 * @description Pins the agent-memory freshness audit (#2087): the pure rules that flag a leaf citing a
 * dead backlog number, an unsettled decision, or an orphaned statute anchor. Fixture-tested so the rules
 * don't depend on the live memory/backlog tree, plus one smoke over the real corpus for the shapes.
 *
 * Also pins the #2921 citation-integrity ERROR signals (cite-resolution, relationship-claim,
 * quoted-section) — see the "citation-integrity signals (#2921)" describe blocks below.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  isLeaf, auditMemoryFreshness, runMemoryFreshnessCheck,
  auditCiteResolution, auditRelationshipClaims, auditQuotedSections, runMemoryCitationLintCheck,
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// citation-integrity signals (#2921) — ERRORS, not warnings. Fixtures reproduce the exact PR #1045 shape
// the item was written for (#2921 Why-now table): a wrong impl arm (signal 2) and a quoted guard section
// that exists in no cited document (signal 3), plus the PR-vs-backlog cite disambiguation (signal 1).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe('auditCiteResolution — signal 1: bare #NNNN must resolve to a real backlog item', () => {
  it('flags a dangling bare #NNNN', () => {
    const errors = auditCiteResolution([{ file: 'a.md', text: 'See #9999 for the ruling.' }], {});
    expect(errors).toHaveLength(1);
    expect(errors[0].descriptor.signal).toBe('cite-resolution');
    expect(errors[0].descriptor.num).toBe('9999');
  });

  it('does NOT flag a #NNNN that resolves', () => {
    const errors = auditCiteResolution(
      [{ file: 'a.md', text: 'See #100 for the ruling.' }],
      { 100: { kind: 'decision', status: 'resolved', file: '100-x.md', title: 'X', blockedBy: [] } },
    );
    expect(errors).toHaveLength(0);
  });

  it('does NOT treat "PR #NNNN" as a backlog cite, even when no such backlog item exists (#2921 signal 1)', () => {
    const errors = auditCiteResolution([{ file: 'a.md', text: 'Observed live: PR #9999 merged unreviewed.' }], {});
    expect(errors).toHaveLength(0);
  });

  it('still flags a bare #NNNN on the same line as an unrelated PR #NNNN', () => {
    const errors = auditCiteResolution(
      [{ file: 'a.md', text: 'PR #9999 landed the fix for #8888.' }],
      {},
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].descriptor.num).toBe('8888');
  });

  it('de-duplicates a repeated dangling cite in one leaf', () => {
    const errors = auditCiteResolution([{ file: 'a.md', text: '#9999 and again #9999.' }], {});
    expect(errors).toHaveLength(1);
  });
});

describe('auditRelationshipClaims — signal 2: a claimed edge must be real (#2921)', () => {
  // The PR #1045 shape (#2921 Why-now row 1): "#2785 (their impl arm) is offered as the impl arm of BOTH
  // #2771 and #2840. #2785's blockedBy is ["2771","2844"]; it never names #2840."
  const backlogIndex = {
    2785: { kind: 'story', status: 'resolved', file: '2785-x.md', title: 'Implement the narrowed review:human rubric', blockedBy: ['2771', '2844'] },
    2771: { kind: 'decision', status: 'resolved', file: '2771-x.md', title: 'Narrow the review:human escalation criteria', blockedBy: [] },
    2840: { kind: 'decision', status: 'resolved', file: '2840-x.md', title: 'Human = principle, not implementation', blockedBy: [] },
  };

  it('fires on the exact PR #1045 "impl arm" shape: #2785 is claimed as the impl arm of #2840, which its blockedBy never names', () => {
    const text = 'Provenance: #2771 and #2840 each ruled a narrowing; their impl arm (#2785) realizes both.';
    const errors = auditRelationshipClaims([{ file: 'a.md', text }], backlogIndex);
    expect(errors).toHaveLength(1);
    expect(errors[0].descriptor).toMatchObject({ verb: 'impl arm of', subj: '2785', obj: '2840' });
  });

  it('does NOT fire when the impl arm claim is limited to the decision actually in blockedBy', () => {
    const text = 'Provenance: #2771 ruled the narrowing; its impl arm (#2785) realizes it.';
    const errors = auditRelationshipClaims([{ file: 'a.md', text }], backlogIndex);
    expect(errors).toHaveLength(0);
  });

  it('fires on "#SUBJ enforces #OBJ" when #SUBJ\'s title does not name #OBJ', () => {
    const idx = {
      100: { kind: 'task', status: 'open', file: '100-x.md', title: 'Some task', blockedBy: [] },
      200: { kind: 'decision', status: 'resolved', file: '200-x.md', title: 'A ruling', blockedBy: [] },
    };
    const errors = auditRelationshipClaims([{ file: 'a.md', text: '#100 enforces #200 going forward.' }], idx);
    expect(errors).toHaveLength(1);
    expect(errors[0].descriptor).toMatchObject({ verb: 'enforces', subj: '100', obj: '200' });
  });

  it('does NOT fire when the title names the enforced decision (the real corpus convention: "(enforces #2840)")', () => {
    const idx = {
      2892: { kind: 'task', status: 'open', file: '2892-x.md', title: 'Impl: leash-pin gate (enforces #2840)', blockedBy: ['2785', '2890'] },
      2840: { kind: 'decision', status: 'resolved', file: '2840-x.md', title: 'Human = principle', blockedBy: [] },
    };
    const errors = auditRelationshipClaims([{ file: 'a.md', text: '#2892 enforces #2840, mechanically.' }], idx);
    expect(errors).toHaveLength(0);
  });

  it('fires on "#SUBJ implements #OBJ" and on "#SUBJ blocked by #OBJ" when the edge is absent', () => {
    const idx = {
      101: { kind: 'task', status: 'open', file: '101-x.md', title: 'A', blockedBy: [] },
      202: { kind: 'decision', status: 'resolved', file: '202-x.md', title: 'B', blockedBy: [] },
    };
    const e1 = auditRelationshipClaims([{ file: 'a.md', text: '#101 implements #202 fully.' }], idx);
    expect(e1).toHaveLength(1);
    const e2 = auditRelationshipClaims([{ file: 'a.md', text: '#101 blocked by #202 until it ships.' }], idx);
    expect(e2).toHaveLength(1);
    expect(e2[0].descriptor.verb).toBe('blocked by');
  });

  it('does NOT collide with the frontmatter field name `blockedBy` (camelCase, no space)', () => {
    const errors = auditRelationshipClaims(
      [{ file: 'a.md', text: 'The card sets `blockedBy: 2890` and does not exist yet.' }],
      {},
    );
    expect(errors).toHaveLength(0);
  });

  it('does not double-report a claim whose subject is itself dangling (signal 1 owns that)', () => {
    const errors = auditRelationshipClaims([{ file: 'a.md', text: '#9999 enforces #2840.' }], { 2840: { kind: 'decision', status: 'resolved', file: '2840-x.md', title: 'X', blockedBy: [] } });
    expect(errors).toHaveLength(0);
  });
});

describe('auditQuotedSections — signal 3: a quoted phrase attributed to a target must exist in it (#2921)', () => {
  const readers = (docText, bodyText) => ({
    readDoc: () => docText,
    readBacklogBody: () => bodyText,
  });

  // The PR #1045 shape (#2921 Why-now row 2): "the ruling's own \"retained invariants\" are the guard" —
  // `grep -c "retained invariant" docs/agent/platform-decisions.md` → 0; the phrase lives only in backlog bodies.
  it('fires on the exact PR #1045 "own" possessive shape when the phrase is absent from the cited doc', () => {
    const text = 'The `we:docs/agent/platform-decisions.md#human-is-principle-surface-not-path` ruling\'s ' +
      'own "retained invariants" are the guard.';
    const { readDoc, readBacklogBody } = readers('This anchor rules that principle-surface gating applies.', null);
    const errors = auditQuotedSections([{ file: 'a.md', text }], {}, { readDoc, readBacklogBody });
    expect(errors).toHaveLength(1);
    expect(errors[0].descriptor).toMatchObject({ signal: 'quoted-section', target: 'platform-decisions.md', phrase: 'retained invariants' });
  });

  it('does NOT fire once the quoted phrase actually occurs in the cited doc (the corrected text)', () => {
    const text = 'The `we:docs/agent/platform-decisions.md#human-is-principle-surface-not-path` ruling\'s ' +
      'own "retained invariants" are the guard.';
    const { readDoc, readBacklogBody } = readers('…this ruling\'s retained invariants must all still hold…', null);
    const errors = auditQuotedSections([{ file: 'a.md', text }], {}, { readDoc, readBacklogBody });
    expect(errors).toHaveLength(0);
  });

  it('is whitespace- and case-insensitive when matching the quoted phrase', () => {
    const text = 'See #100 — its own "Retained   Invariants" apply.';
    const idx = { 100: { kind: 'decision', status: 'resolved', file: '100-x.md', title: 'X', blockedBy: [] } };
    const { readDoc, readBacklogBody } = readers(null, 'body text: retained invariants stay in force.');
    const errors = auditQuotedSections([{ file: 'a.md', text }], idx, { readDoc, readBacklogBody });
    expect(errors).toHaveLength(0);
  });

  it('resolves against the backlog item body when the nearest cite is a #NNNN, not a doc anchor', () => {
    const text = 'Per #100, its own "narrow gate-self" framing governs.';
    const idx = { 100: { kind: 'decision', status: 'resolved', file: '100-x.md', title: 'X', blockedBy: [] } };
    const { readDoc, readBacklogBody } = readers(null, 'This item is about something else entirely.');
    const errors = auditQuotedSections([{ file: 'a.md', text }], idx, { readDoc, readBacklogBody });
    expect(errors).toHaveLength(1);
    expect(errors[0].descriptor.target).toBe('#100');
  });

  it('skips a dangling #NNNN target (signal 1 owns that) rather than double-reporting', () => {
    const text = 'Per #9999, its own "some phrase" governs.';
    const { readDoc, readBacklogBody } = readers(null, null);
    const errors = auditQuotedSections([{ file: 'a.md', text }], {}, { readDoc, readBacklogBody });
    expect(errors).toHaveLength(0);
  });

  it('does NOT fire on an ordinary quote with no "own" possessive attribution nearby', () => {
    const text = 'See #100 for the "some phrase" example, which is unrelated prose.';
    const idx = { 100: { kind: 'decision', status: 'resolved', file: '100-x.md', title: 'X', blockedBy: [] } };
    const { readDoc, readBacklogBody } = readers(null, 'nothing matching here');
    const errors = auditQuotedSections([{ file: 'a.md', text }], idx, { readDoc, readBacklogBody });
    expect(errors).toHaveLength(0);
  });
});

describe('runMemoryCitationLintCheck — smoke over the live corpus (#2921 Done-when: clean or triaged)', () => {
  it('returns the check-standards { errors } shape, and the live corpus is clean', () => {
    const { errors } = runMemoryCitationLintCheck();
    expect(Array.isArray(errors)).toBe(true);
    for (const e of errors) {
      expect(typeof e.message).toBe('string');
      expect(['cite-resolution', 'relationship-claim', 'quoted-section']).toContain(e.descriptor.signal);
    }
    expect(errors).toHaveLength(0);
  });
});
