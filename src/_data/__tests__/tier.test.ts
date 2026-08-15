// Regression test for the agent-readiness tier rubric (src/_data/backlog.js `deriveTier`), guarding
// the decision-with-open-blocker demotion against silent regressions. The original bug: a `decision`
// was assigned Tier B ("decision-ready / ✓ ready to ratify") purely on type, never consulting its
// `blockedBy` — so a decision gated on an unresolved prerequisite still showed as ready to ratify on
// the Prioritisation tab. Exercises the pure `deriveTier` over SYNTHETIC items (the same approach
// d3-readiness.test.ts and scripts/readiness/__tests__/engine.test.mjs take) so the rule is pinned
// independently of whatever the live backlog happens to hold.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deriveTier, deriveSliceable, deriveNotBatchableReason } = require('../backlog.js') as {
  deriveTier: (item: {
    status: string;
    kind: string;
    blockers: { status: string }[];
    projectPending?: boolean;
    humanGate?: { kind: string; what: string };
  }) => 'A' | 'B' | 'C' | undefined;
  deriveSliceable: (item: {
    status: string;
    kind: string;
    blockers: { status: string }[];
  }) => boolean;
  deriveNotBatchableReason: (item: {
    status: string;
    kind: string;
    batchable?: boolean;
    stopTheWorld?: boolean;
    humanGate?: { kind: string; what: string };
    openBlockers?: string[];
    projectPending?: boolean;
    size?: number;
  }) => string | null;
};

/** Build a loader-shaped item; `blockedBy` is the lightweight `[{ status }]` array the loader attaches. */
const item = (over: Partial<Parameters<typeof deriveTier>[0]>) => ({
  status: 'open',
  kind: 'story',
  blockers: [],
  projectPending: false,
  ...over,
});

describe('deriveTier — agent-readiness rubric', () => {
  describe('Tier B (decision-ready) gates on resolved blockers — the #779-class regression', () => {
    it('an open decision with NO blockers is B (ready to ratify)', () => {
      expect(deriveTier(item({ kind: 'decision' }))).toBe('B');
    });

    it('an open decision with every blocker RESOLVED is B', () => {
      expect(deriveTier(item({ kind: 'decision', blockers: [{ status: 'resolved' }] }))).toBe('B');
    });

    it('an open decision with an UNRESOLVED blocker is C, not B (the bug)', () => {
      expect(deriveTier(item({ kind: 'decision', blockers: [{ status: 'open' }] }))).toBe('C');
      expect(deriveTier(item({ kind: 'decision', blockers: [{ status: 'active' }] }))).toBe('C');
      // mixed: one resolved, one still open ⇒ still blocked ⇒ C
      expect(deriveTier(item({
        kind: 'decision',
        blockers: [{ status: 'resolved' }, { status: 'open' }],
      }))).toBe('C');
    });
  });

  describe('Tier A (agent-ready) — the sibling rule, unchanged', () => {
    it('an open issue/idea with all blockers resolved and project not pending is A', () => {
      expect(deriveTier(item({ kind: 'story', blockers: [{ status: 'resolved' }] }))).toBe('A');
      expect(deriveTier(item({ kind: 'story' }))).toBe('A');
    });

    it('an open issue/idea with an unresolved blocker is C', () => {
      expect(deriveTier(item({ kind: 'story', blockers: [{ status: 'open' }] }))).toBe('C');
    });

    it('an open issue whose relatedProject is pending (D3-readiness #608) is C, not A', () => {
      expect(deriveTier(item({ kind: 'story', projectPending: true }))).toBe('C');
    });

    it('an open issue held by a humanGate (#1137) is C, not A — even with every blocker resolved', () => {
      expect(deriveTier(item({
        kind: 'story', blockers: [{ status: 'resolved' }],
        humanGate: { kind: 'deploy', what: 'run the credentialed deploy from an authed session' },
      }))).toBe('C');
      // The gate alone demotes; project-pending is independent.
      expect(deriveTier(item({ kind: 'story', humanGate: { kind: 'feedback', what: 'collect training feedback' } }))).toBe('C');
    });
  });

  describe('only open items carry a tier', () => {
    it('non-open items get undefined regardless of type/blockers', () => {
      for (const status of ['active', 'resolved', 'parked']) {
        expect(deriveTier(item({ status, kind: 'decision' }))).toBeUndefined();
        expect(deriveTier(item({ status, kind: 'story' }))).toBeUndefined();
      }
    });
  });

  // `feature` (#2691/#2998) is the grouping tier ABOVE epic — epic-parity by design. These cases mirror
  // the decision/story ones above, but for the guard at backlog.js:186 (`if (item.kind === 'feature')
  // return undefined;`). MUTATION PROBE: temporarily deleting that guard makes an open, unblocked
  // feature fall into the `item.kind !== 'decision' && blockersClear …` branch and return Tier 'A' — the
  // first `it` below reddens on that mutation.
  describe('Tier — feature is epic-parity: NEVER Tier-A/buildable (#2998)', () => {
    it('an open feature with no blockers carries NO tier at all — not A, not B, not C', () => {
      expect(deriveTier(item({ kind: 'feature' }))).toBeUndefined();
    });

    it('an open feature with every blocker resolved still carries no tier', () => {
      expect(deriveTier(item({ kind: 'feature', blockers: [{ status: 'resolved' }] }))).toBeUndefined();
    });

    it('an open feature with an unresolved blocker still carries no tier — not demoted to C either', () => {
      expect(deriveTier(item({ kind: 'feature', blockers: [{ status: 'open' }] }))).toBeUndefined();
    });

    it('a non-open feature carries no tier, same as any other kind', () => {
      for (const status of ['active', 'resolved', 'parked']) {
        expect(deriveTier(item({ status, kind: 'feature' }))).toBeUndefined();
      }
    });
  });

  describe('sliceable — feature gets epic-like decomposition readiness (#2998)', () => {
    it('an open feature with every blocker resolved is sliceable, exactly like an epic', () => {
      expect(deriveSliceable(item({ kind: 'feature' }))).toBe(true);
      expect(deriveSliceable(item({ kind: 'epic' }))).toBe(true);
    });

    it('an open feature with an unresolved blocker is NOT sliceable — decomposition may turn on it', () => {
      expect(deriveSliceable(item({ kind: 'feature', blockers: [{ status: 'open' }] }))).toBe(false);
    });

    it('a non-open feature is not sliceable', () => {
      expect(deriveSliceable(item({ status: 'active', kind: 'feature' }))).toBe(false);
    });

    it('a feature is disjoint from non-grouping kinds — a story/decision is never sliceable', () => {
      expect(deriveSliceable(item({ kind: 'story' }))).toBe(false);
      expect(deriveSliceable(item({ kind: 'decision' }))).toBe(false);
    });
  });

  describe('notBatchableReason — feature is excluded up front, like an epic (#2998)', () => {
    it('an open feature never carries a batch-pool reason — it has its own slice pill instead', () => {
      expect(deriveNotBatchableReason(item({ kind: 'feature' }))).toBeNull();
      // Even shaped like it would otherwise read 'blocked' — the epic/feature short-circuit wins first.
      expect(deriveNotBatchableReason(item({
        kind: 'feature', openBlockers: ['1'], batchable: false,
      }))).toBeNull();
    });
  });
});
