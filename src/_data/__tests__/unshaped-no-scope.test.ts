// Regression test for the has-predicted-scope readiness lens (#2618) — the pure `deriveUnshapedNoScope`
// predicate in src/_data/backlog.js. It flags an OPEN, unblocked, agent-ready (Tier-A) BUILD item that
// carries NO usable predicted `scope:`, mirroring the conveyor dispatcher's `unshaped-no-scope` /
// needs-probe hold (scripts/readiness/dispatch-plan.mjs). Exercised over SYNTHETIC items (the same approach
// tier.test.ts / d3-readiness.test.ts take) so the rule is pinned independently of the live backlog, and so
// the loader field, the /backlog badge, and the check:readiness note can never drift from one predicate.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deriveUnshapedNoScope } = require('../backlog.js') as {
  deriveUnshapedNoScope: (item: { tier?: string; kind?: string; scope?: unknown }) => boolean;
};

/** A loader-shaped item as it reaches the predicate: `tier` already derived, `scope` still raw frontmatter. */
const item = (over: { tier?: string; kind?: string; scope?: unknown }) => ({
  tier: 'A',
  kind: 'story',
  ...over,
});

describe('deriveUnshapedNoScope — the has-predicted-scope lens (#2618)', () => {
  it('an agent-ready (Tier A) build item with NO scope is unshaped', () => {
    expect(deriveUnshapedNoScope(item({}))).toBe(true);
    expect(deriveUnshapedNoScope(item({ kind: 'task' }))).toBe(true);
  });

  it('every "no usable scope" shape reads as unshaped — absent / non-array / empty / all-blank', () => {
    expect(deriveUnshapedNoScope(item({ scope: undefined }))).toBe(true);
    expect(deriveUnshapedNoScope(item({ scope: [] }))).toBe(true);
    expect(deriveUnshapedNoScope(item({ scope: 'we:src/' as unknown }))).toBe(true); // non-array
    expect(deriveUnshapedNoScope(item({ scope: ['', '  '] }))).toBe(true); // all-blank
  });

  it('a Tier-A item WITH a usable predicted scope is shaped — not flagged', () => {
    expect(deriveUnshapedNoScope(item({ scope: ['we:src/backlog.njk'] }))).toBe(false);
    expect(deriveUnshapedNoScope(item({ scope: ['  we:src/_data/  '] }))).toBe(false); // trims to a real entry
  });

  it('only Tier A applies — a not-ready (C) or decision-ready (B) unscoped item is NOT flagged', () => {
    expect(deriveUnshapedNoScope(item({ tier: 'C' }))).toBe(false);
    expect(deriveUnshapedNoScope(item({ tier: 'B', kind: 'decision' }))).toBe(false);
    expect(deriveUnshapedNoScope(item({ tier: undefined }))).toBe(false); // non-open items carry no tier
  });

  it('an epic (umbrella — never built directly) is excluded even when Tier A and unscoped', () => {
    expect(deriveUnshapedNoScope(item({ kind: 'epic' }))).toBe(false);
  });
});
