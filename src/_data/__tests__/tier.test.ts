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
const { deriveTier } = require('../backlog.js') as {
  deriveTier: (item: {
    status: string;
    kind: string;
    blockers: { status: string }[];
    projectPending?: boolean;
    humanGate?: { kind: string; what: string };
  }) => 'A' | 'B' | 'C' | undefined;
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
});
