// Regression test for the per-item BUILD-STATE precedence (src/_data/backlog.js `deriveBuildState`), the
// first "backlog-driven console" increment (#2474 → #2472). The loader joins the batch skill's offline
// loop-state files (claims.json / queued.json) onto each item and derives where it sits in the LOCAL loop
// pipeline. This pins the PURE precedence — resolved > queued > claimed > the item's own status — and the
// purely-additive fallback (no lookups ⇒ every item's buildState is just its status, so nothing new
// renders). Exercises the exported pure function over SYNTHETIC items, the same approach tier.test.ts and
// d3-readiness.test.ts take, so the rule is pinned independently of whatever the live backlog holds.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type BuildState = { state: string; session?: string };
type Item = { id: string; num: string; status: string };
type Lookups = { claimedBy?: Map<string, string>; queuedNums?: Set<string> };
const { deriveBuildState } = require('../backlog.js') as {
  deriveBuildState: (item: Item, lookups?: Lookups) => BuildState;
};

const item = (over: Partial<Item> = {}): Item => ({
  id: '2472-example',
  num: '2472',
  status: 'open',
  ...over,
});

describe('deriveBuildState — local loop-pipeline precedence (#2472)', () => {
  it('falls back to the item status when NO loop-state is passed (purely additive)', () => {
    // No lookups at all — the absent-files case: buildState must equal the item's own status.
    expect(deriveBuildState(item({ status: 'open' }))).toEqual({ state: 'open' });
    expect(deriveBuildState(item({ status: 'active' }))).toEqual({ state: 'active' });
    expect(deriveBuildState(item({ status: 'preparing' }))).toEqual({ state: 'preparing' });
    expect(deriveBuildState(item({ status: 'parked' }))).toEqual({ state: 'parked' });
  });

  it('falls back cleanly when the lookups exist but hold nothing for this item', () => {
    const lookups = { claimedBy: new Map(), queuedNums: new Set<string>() };
    expect(deriveBuildState(item({ status: 'open' }), lookups)).toEqual({ state: 'open' });
  });

  it('marks an item CLAIMED (with its owning session) when a session holds it', () => {
    const lookups = { claimedBy: new Map([['2472-example', 'batch-2026-07-14-a']]), queuedNums: new Set<string>() };
    expect(deriveBuildState(item(), lookups)).toEqual({ state: 'claimed', session: 'batch-2026-07-14-a' });
  });

  it('matches a claim keyed by the leading num token, not only the full slug', () => {
    const lookups = { claimedBy: new Map([['2472', 'sess-x']]), queuedNums: new Set<string>() };
    expect(deriveBuildState(item(), lookups)).toEqual({ state: 'claimed', session: 'sess-x' });
  });

  it('marks an item QUEUED (ready-to-merge) — queued outranks a concurrent claim', () => {
    const lookups = {
      claimedBy: new Map([['2472-example', 'sess-x']]),
      queuedNums: new Set(['2472']),
    };
    expect(deriveBuildState(item(), lookups)).toEqual({ state: 'queued' });
  });

  it('matches queued nums tolerant of width-3 padding (queued-state.mjs pads short nums)', () => {
    const lookups = { queuedNums: new Set(['072']) };
    expect(deriveBuildState(item({ num: '72' }), lookups)).toEqual({ state: 'queued' });
  });

  it('RESOLVED wins over everything — a resolved item never mislabels as a stale claim/queue', () => {
    const lookups = {
      claimedBy: new Map([['2472-example', 'sess-x']]),
      queuedNums: new Set(['2472']),
    };
    expect(deriveBuildState(item({ status: 'resolved' }), lookups)).toEqual({ state: 'resolved' });
  });
});
